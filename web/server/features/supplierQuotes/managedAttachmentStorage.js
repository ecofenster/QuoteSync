import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const ROOT_ENVIRONMENT_VARIABLE = 'QUOTESYNC_ATTACHMENT_ROOT';

export function resolveAttachmentRoot(environment = process.env) {
  const configured = String(environment[ROOT_ENVIRONMENT_VARIABLE] || '').trim();
  if (configured) return path.resolve(configured);
  const localBase = String(environment.LOCALAPPDATA || '').trim() || os.tmpdir();
  return path.resolve(localBase, 'QuoteSync', 'managed-attachments');
}

export async function ensureAttachmentRoot(root = resolveAttachmentRoot()) {
  const resolved = path.resolve(root);
  await mkdir(resolved, { recursive: true });
  return resolved;
}

export function generateManagedStorageKey({ estimateId, revisionId, attachmentId = randomUUID() }) {
  const safe = [estimateId, revisionId, attachmentId].map((segment) => {
    const value = String(segment || '');
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Managed storage key IDs contain unsafe characters.');
    return value;
  });
  return ['estimates', safe[0], 'supplier-quotes', safe[1], safe[2]].join('/');
}

export function generateLabManagedStorageKey({ sessionId, attachmentId = randomUUID(), fileKey = randomUUID() }) {
  const safe = [sessionId, attachmentId, fileKey].map((segment) => {
    const value = String(segment || '');
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Managed storage key IDs contain unsafe characters.');
    return value;
  });
  return ['lab', safe[0], safe[1], safe[2]].join('/');
}

export function resolveManagedPath(storageKey, root = resolveAttachmentRoot()) {
  if (typeof storageKey !== 'string' || !storageKey.trim()) throw new Error('Storage key is required.');
  if (path.isAbsolute(storageKey) || /^[A-Za-z]:[\\/]/.test(storageKey)) throw new Error('Absolute storage keys are forbidden.');
  const segments = storageKey.replaceAll('\\', '/').split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('Storage key traversal is forbidden.');
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Storage key must resolve to a managed child path.');
  return resolvedPath;
}

export function isManagedPath(candidatePath, root = resolveAttachmentRoot()) {
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, path.resolve(candidatePath));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function ensureManagedParent(storageKey, root = resolveAttachmentRoot()) {
  const target = resolveManagedPath(storageKey, root);
  await mkdir(path.dirname(target), { recursive: true });
  return target;
}

export async function calculateFileSha256(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export async function readFileIntegrity(filename) {
  const metadata = await stat(filename);
  if (!metadata.isFile()) throw new Error('Managed attachment path is not a file.');
  return { sizeBytes: metadata.size, sha256: await calculateFileSha256(filename) };
}

export async function verifyFileIntegrity(filename, expected) {
  const actual = await readFileIntegrity(filename);
  return {
    valid: actual.sizeBytes === expected.sizeBytes && actual.sha256 === String(expected.sha256).toLowerCase(),
    actual,
  };
}

export const attachmentStorageEnvironmentVariable = ROOT_ENVIRONMENT_VARIABLE;
