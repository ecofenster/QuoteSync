import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveManagedPath, resolveAttachmentRoot } from "../supplierQuotes/managedAttachmentStorage.js";
import { createCommunicationRepository } from "./communicationRepository.js";
import { createGmailProvider } from "./gmailProvider.js";
import { createGoogleWorkspaceService } from "../integrations/googleWorkspaceService.js";

const decodeAttachment = (attachment, attachmentRoot) => {
  if (attachment.bytes) return Promise.resolve({ ...attachment, bytes: Buffer.from(attachment.bytes) });
  if (attachment.contentBase64) return Promise.resolve({ ...attachment, bytes: Buffer.from(attachment.contentBase64, "base64") });
  if (attachment.storageKey) return readFile(resolveManagedPath(attachment.storageKey, attachmentRoot)).then((bytes) => ({ ...attachment, bytes }));
  throw Object.assign(new Error(`Attachment ${attachment.fileName || "file"} has no content.`), { status: 400 });
};

export function createCommunicationsService(db, options = {}) {
  const repository = createCommunicationRepository(db), workspace = createGoogleWorkspaceService(db, options), gmail = createGmailProvider(workspace, options.gmailOptions), attachmentRoot = options.attachmentRoot ?? resolveAttachmentRoot(options.environment);

  async function persistProviderMessage(message) {
    const existing = message.providerMessageId ? await repository.findByProviderId("google_workspace", message.providerMessageId) : null;
    return repository.save({ ...message, id: existing?.id ?? randomUUID(), mailboxId: "me", attachments: (message.attachments || []).map((attachment) => ({ ...attachment, id: `${existing?.id ?? message.providerMessageId}_${attachment.providerAttachmentId || attachment.id}` })) });
  }

  async function listMailbox(input) {
    const result = await gmail.list(input);
    return { ...result, messages: await Promise.all(result.messages.map(persistProviderMessage)) };
  }

  async function readMessage(providerMessageId) { return persistProviderMessage(await gmail.readMessage(providerMessageId)); }

  async function createDraft(input) {
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot)));
    const localId = String(input.id || randomUUID()), provider = await gmail.createDraft({ ...input, attachments });
    return repository.save({ ...input, id: localId, provider: "google_workspace", providerMessageId: provider.providerMessageId, threadId: provider.threadId, mailboxId: "me", direction: "outbound", folder: "drafts", status: "draft", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
  }

  async function sendMessage(input) {
    const attachments = await Promise.all((input.attachments || []).map((item) => decodeAttachment(item, attachmentRoot))), id = String(input.id || randomUUID());
    await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "sending", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    try {
      const sent = await gmail.send({ ...input, attachments });
      return repository.save({ ...input, id, provider: "google_workspace", providerMessageId: sent.providerMessageId, threadId: sent.threadId, mailboxId: "me", direction: "outbound", folder: "sent", status: "sent", sentAt: new Date().toISOString(), attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
    } catch (error) {
      await repository.save({ ...input, id, provider: "google_workspace", mailboxId: "me", direction: "outbound", folder: "sent", status: "failed", error: error instanceof Error ? error.message : "Provider send failed.", attachments: attachments.map(({ bytes, ...item }) => ({ ...item, sizeBytes: item.sizeBytes ?? bytes.length })) });
      throw error;
    }
  }

  async function reply(input) {
    const original = await readMessage(input.providerMessageId);
    return sendMessage({ ...input, threadId: original.threadId, to: input.to?.length ? input.to : original.from, subject: /^re:/i.test(input.subject || "") ? input.subject : `Re: ${input.subject || original.subject}`, inReplyTo: original.providerMessageId, references: original.providerMessageId, inReplyToProviderMessageId: original.providerMessageId });
  }

  async function forward(input) {
    const original = await readMessage(input.providerMessageId);
    const forwarded = `<hr><p><strong>Forwarded message</strong></p><p>From: ${original.from.join(", ")}<br>Subject: ${original.subject}</p>${original.bodyHtml || `<pre>${original.bodyText}</pre>`}`;
    return sendMessage({ ...input, subject: /^fwd:/i.test(input.subject || "") ? input.subject : `Fwd: ${input.subject || original.subject}`, bodyHtml: `${input.bodyHtml || ""}${forwarded}` });
  }

  return { status: workspace.status, listMailbox, readMessage, createDraft, sendMessage, reply, forward, readAttachment: gmail.attachment, repository };
}
