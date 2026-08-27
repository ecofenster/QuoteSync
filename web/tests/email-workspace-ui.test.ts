import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildContextActions, deriveMailboxNavigation, deriveRelationshipSuggestions, formatMailboxDateTime, projectMailboxRow, resolveContextMenuAction, sanitizeEmailHtml } from "../src/features/communications/domain/emailPresentation.ts";
import type { CommunicationMessageView, MailboxCapability, MailboxLabelView } from "../src/services/communications/communicationsApi.ts";

const capabilities:MailboxCapability[]=["archive","trash","read_state","star","move","labels"].map(id=>({id:id as MailboxCapability["id"],available:true}));
const labels:MailboxLabelView[]=[
  {id:"INBOX",name:"INBOX",type:"system",messagesTotal:12,messagesUnread:4},
  {id:"SENT",name:"SENT",type:"system",messagesTotal:9,messagesUnread:0},
  {id:"DRAFT",name:"DRAFT",type:"system",messagesTotal:2,messagesUnread:0},
  {id:"STARRED",name:"STARRED",type:"system",messagesTotal:3,messagesUnread:0},
  {id:"SNOOZED",name:"SNOOZED",type:"system",messagesTotal:1,messagesUnread:0},
  {id:"CATEGORY_SOCIAL",name:"CATEGORY_SOCIAL",type:"system",messagesTotal:2,messagesUnread:1},
  {id:"CATEGORY_UPDATES",name:"CATEGORY_UPDATES",type:"system",messagesTotal:2,messagesUnread:0},
  {id:"Label_parent",name:"Suppliers",type:"user",messagesTotal:3,messagesUnread:1},
  {id:"Label_child",name:"Suppliers/Zyle Fenster",type:"user",messagesTotal:2,messagesUnread:1},
];
const message:CommunicationMessageView={id:"local-1",providerMessageId:"message-1",threadId:"thread-1",direction:"inbound",folder:"inbox",status:"received",from:["Zyle Fenster <quotes@zyle.example>"],to:["sales@example.com"],cc:[],bcc:[],subject:"Quotation 343718-1 for EF-EST-2026-041",snippet:"Please find the quotation attached",bodyHtml:'<p onclick="bad()">Quotation</p><img src="cid:logo-1"><img src="https://tracker.example/pixel"><script>alert(1)</script><a href="javascript:bad()">Bad</a>',bodyText:"Quotation 343718-1 for EF-EST-2026-041",attachments:[{id:"a1",fileName:"343718-1.pdf",mediaType:"application/pdf",sizeBytes:2048,providerAttachmentId:"attachment-1"}],sentAt:"2026-08-26T13:29:00.000Z",error:null,unread:true,starred:false,important:true,labels:[{id:"Label_child",name:"Suppliers/Zyle Fenster",system:false}],threadCount:3,links:[]};

test("mailbox navigation exposes counts, More, categories and nested user labels without inventing Scheduled",()=>{
  const nav=deriveMailboxNavigation(labels,capabilities);
  assert.deepEqual(nav.primary.map(item=>item.label),["Inbox","Starred","Sent","Drafts"]);
  assert.equal(nav.primary.find(item=>item.label==="Inbox")?.count,4);
  assert.equal(nav.primary.find(item=>item.label==="Drafts")?.count,2);
  assert.ok(nav.more.some(item=>item.label==="Snoozed"));
  assert.deepEqual(nav.category.map(item=>item.label),["Social","Updates"]);
  assert.deepEqual(nav.userLabels.map(item=>item.name),["Suppliers","Suppliers/Zyle Fenster"]);
  assert.equal(nav.primary.some(item=>item.label==="Scheduled"),false);
});

test("communication types separate canonical persisted folders from provider mailbox views",async()=>{
  const [api,domain]=await Promise.all([readFile("src/services/communications/communicationsApi.ts","utf8"),readFile("src/features/communications/domain/communications.ts","utf8")]);
  for(const source of [api,domain]){assert.match(source,/CommunicationFolder|CanonicalCommunicationFolder/);for(const folder of ["inbox","sent","drafts","trash","spam","other"])assert.match(source,new RegExp(`"${folder}"`));assert.match(source,/CommunicationMailboxView/);assert.match(source,/`label:\$\{string\}`/)}
});

test("message row projection keeps date and time, unread, labels, attachment and thread evidence",()=>{
  const row=projectMailboxRow(message,"inbox");
  assert.match(row.dateTime,/26 Aug 2026 · 14:29|26 Aug 2026 · 13:29/);
  assert.equal(row.sender,"Zyle Fenster <quotes@zyle.example>");
  assert.equal(row.unread,true);assert.equal(row.starred,false);assert.equal(row.attachmentCount,1);assert.equal(row.threadCount,3);assert.deepEqual(row.labels,["Suppliers/Zyle Fenster"]);
  assert.match(formatMailboxDateTime(message.sentAt),/26 Aug 2026 ·/);
});

test("HTML presentation prefers safe markup, resolves CID images and blocks active/remote content",()=>{
  const safe=sanitizeEmailHtml(message.bodyHtml,{resolveCid:id=>id==="logo-1"?"/controlled/inline/logo":null});
  assert.match(safe,/Quotation/);assert.match(safe,/\/controlled\/inline\/logo/);assert.doesNotMatch(safe,/<script|onclick|javascript:/i);assert.doesNotMatch(safe,/tracker\.example/);assert.match(safe,/data-qs-remote-image="blocked"/);assert.match(safe,/Content-Security-Policy/);assert.match(safe,/connect-src 'none'/);assert.match(safe,/sandbox|noopener|referrerpolicy/i);
  const remote=sanitizeEmailHtml('<img src="https://images.example/logo.png">',{allowRemoteImages:true});assert.match(remote,/https:\/\/images\.example\/logo\.png/);
});

test("HTML privacy removes CSS and secondary HTML resource-loading channels",()=>{
  const hostile='<style>@import "https://styles.example/a.css"; body{background:url(https://track.example/pixel)}</style><p style="color:red">Safe presentation</p><div style=background:url(https://inline.example/pixel)>Tracked</div><img srcset="https://srcset.example/a.png 1x" background="https://background.example/a.png"><picture><source srcset="https://source.example/a.webp"><img src="cid:logo-1"></picture><a ping="https://ping.example/collect" href="https://safe.example">Link</a>';
  const safe=sanitizeEmailHtml(hostile,{resolveCid:()=>"/api/controlled-inline"});
  for(const host of ["styles.example","track.example","inline.example","srcset.example","background.example","source.example","ping.example"])assert.doesNotMatch(safe,new RegExp(host.replace(".","\\.")));
  assert.match(safe,/Safe presentation/);assert.match(safe,/style="color:red"/);assert.match(safe,/\/api\/controlled-inline/);assert.match(safe,/default-src 'none'/);assert.match(safe,/form-action 'none'/);
});

test("context actions adapt to read/star/attachment state and stay provider capability-driven",()=>{
  const actions=buildContextActions(message,capabilities);
  assert.ok(actions.some(item=>item.id==="mark_read"&&!item.disabled));assert.ok(actions.some(item=>item.id==="star"&&!item.disabled));assert.ok(actions.some(item=>item.id==="import_supplier_quote"&&item.disabled&&item.label.includes("not yet available")));
  const limited=buildContextActions({...message,unread:false,starred:true,attachments:[]},[]);
  assert.ok(limited.some(item=>item.id==="mark_unread"&&item.disabled));assert.ok(limited.some(item=>item.id==="unstar"&&item.disabled));assert.ok(limited.some(item=>item.id==="save_attachments"&&item.disabled));
});

test("Move and Label submenu selections resolve to provider-neutral commands",()=>{
  const actions=buildContextActions(message,capabilities),move=actions.find(item=>item.id==="move")!,label=actions.find(item=>item.id==="label")!;
  assert.deepEqual(resolveContextMenuAction(move),{type:"submenu",submenu:"move"});
  assert.deepEqual(resolveContextMenuAction(move,"Label_archive"),{type:"command",command:"move",labelId:"Label_archive"});
  assert.deepEqual(resolveContextMenuAction(label,"Label_supplier"),{type:"command",command:"label",labelId:"Label_supplier"});
});

test("mailbox command failures remain recoverable and never optimistically rewrite message state",async()=>{
  const ui=await readFile("src/features/communications/EmailWorkspace.tsx","utf8"),runCommand=ui.match(/const runCommand=async[\s\S]*?;\n {2}const handleContextAction=/)?.[0]||"";
  assert.match(runCommand,/await communicationsApi\.command\(threadIds,command,labelId\);await load/);
  assert.match(runCommand,/catch\(reason\).*setError\(`Mailbox action could not be completed\./);
  assert.doesNotMatch(runCommand,/setMessages|unread\s*:|starred\s*:/);
  assert.match(ui,/runCommand\(resolution\.command,new Set\(\[message\.id\]\),resolution\.labelId\)/);
});

test("relationship suggestions use exact evidence but never auto-link provider labels",()=>{
  const suggestions=deriveRelationshipSuggestions(message);
  assert.ok(suggestions.some(item=>item.kind==="estimate_reference"&&item.label.includes("EF-EST-2026-041")));
  assert.ok(suggestions.some(item=>item.kind==="supplier_quotation_reference"&&item.label.includes("343718-1")));
  assert.ok(suggestions.some(item=>item.kind==="provider_label"&&item.label.includes("Zyle Fenster")));
  assert.ok(suggestions.every(item=>item.autoLinkAllowed===false));
});

test("Email UI exposes dense accessible state, threads, pagination, menus, selection and mobile equivalent",async()=>{
  const [ui,css,api]=await Promise.all([readFile("src/features/communications/EmailWorkspace.tsx","utf8"),readFile("src/features/communications/emailWorkspace.css","utf8"),readFile("src/services/communications/communicationsApi.ts","utf8")]);
  for(const phrase of ["Mailbox navigation","Starred","Drafts","Categories","QuoteSuite","aria-multiselectable","onContextMenu","preventDefault","ArrowDown","Escape","Reply all","Save Draft","BCC","nextPageToken","pageHistory","sandbox=\"\"","Remote images are blocked","Unlinked — review","Confirm relationship","More conversation actions","configuration is retained","recover automatically when the server encryption service is restored"])assert.match(ui,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
  for(const state of ["border-bottom:1px solid var(--qs-border-standard)",".email-message-row.is-unread",".email-message-row.is-selected",".email-message-row.is-selected.is-unread",".email-message-row:hover",".email-message-row:focus-visible","@media(max-width:560px)"])assert.ok(css.includes(state));
  assert.match(api,/page_token/);assert.match(api,/\/threads\//);assert.match(api,/\/commands/);assert.match(api,/\/links/);assert.match(ui,/communicationsApi\.link/);assert.doesNotMatch(ui,/gmail\.googleapis\.com|access_token|refresh_token/);
});

test("Administration exposes explicit Google Workspace re-consent without credential re-entry",async()=>{
  const panel=await readFile("src/features/admin/AdminIntegrationsPanel.tsx","utf8");
  assert.match(panel,/state==="reconnect_required"/);assert.match(panel,/additional Gmail mailbox permission/);assert.match(panel,/Existing credentials, folder settings and connection records are retained/);assert.match(panel,/google\?\.configured\?"Reconnect Google Workspace":"Connect Google Workspace"/);
});

test("conversation reader uses non-shrinking content geometry and bounded body presentation",async()=>{
  const [ui,css]=await Promise.all([readFile("src/features/communications/EmailWorkspace.tsx","utf8"),readFile("src/features/communications/emailWorkspace.css","utf8")]);
  assert.match(css,/\.email-reader\{display:flex;flex:1 1 auto;flex-direction:column;align-items:stretch/);
  assert.match(css,/\.email-reader__message\{flex:0 0 auto;[^}]*min-height:64px/);
  assert.match(css,/\.email-reader__message>summary\{[^}]*min-height:62px/);
  assert.match(css,/\.email-reader__message-content\{[^}]*min-width:0;[^}]*overflow:visible/);
  assert.match(css,/\.email-reader__body iframe\{[^}]*height:clamp\(28rem,62vh,52rem\);min-height:28rem/);
  assert.match(css,/\.email-reader__plain\{min-height:10rem;[^}]*white-space:pre-wrap/);
  assert.match(css,/\.email-attachments__grid\{[^}]*minmax\(min\(100%,28rem\),1fr\)[^}]*min-width:0/);
  assert.match(css,/\.email-reader__reply-actions\{display:flex;flex-wrap:wrap/);
  for(const token of ["--qs-bg-card","--qs-bg-hover","--qs-theme-text-muted","--qs-border-standard","--qs-border-focus"])assert.match(css,new RegExp(token));
  assert.match(ui,/function ConversationMessage/);assert.match(ui,/expanded\?<div className="email-reader__message-content"/);assert.match(ui,/previewLimit=8/);assert.match(ui,/Show \$\{remaining\} more/);
  for(const presentation of ["email-reader__message-addresses","email-reader__recipients","email-reader__body","email-reader__plain","email-attachments__grid","email-reader__reply-actions","Reply all","Forward"])assert.match(ui,new RegExp(presentation));
  assert.doesNotMatch(css,/\.email-reader__message\{[^}]*overflow:hidden/);
});

test("Client and Estimate Files share canonical component and theme-aware design-system controls",async()=>{
  const [panel,css,client,estimate]=await Promise.all([readFile("src/features/documents/CanonicalDocumentsPanel.tsx","utf8"),readFile("src/features/documents/canonicalDocuments.css","utf8"),readFile("src/features/estimatePicker/tabs/FilesTab.tsx","utf8"),readFile("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx","utf8")]);
  assert.match(client,/CanonicalDocumentsPanel clientId/);assert.match(estimate,/CanonicalDocumentsPanel estimateId/);assert.match(panel,/ui-button ui-button--ghost/);assert.match(panel,/Google Drive.*OneDrive.*SharePoint.*QuoteSuite managed/s);assert.match(panel,/data-label="Provider \/ Folder"/);
  for(const token of ["--qs-bg-card","--qs-bg-surface-elevated","--qs-theme-text","--qs-border-standard","--qs-bg-row-hover"])assert.match(css,new RegExp(token));
  assert.doesNotMatch(css,/#f2f4f7|#d0d5dd|background:\s*white|border-radius:\s*999px/i);assert.match(css,/@media\(max-width:760px\)/);
});

test("Email is cache-first, refreshes in the background and retains cached mail on provider failure",async()=>{
  const [ui,api,service,repository]=await Promise.all([readFile("src/features/communications/EmailWorkspace.tsx","utf8"),readFile("src/services/communications/communicationsApi.ts","utf8"),readFile("server/features/communications/communicationsService.js","utf8"),readFile("server/features/communications/communicationRepository.js","utf8")]);
  assert.match(ui,/mailboxMemoryCache/);assert.match(ui,/communicationsApi\.list[\s\S]*communicationsApi\.sync/);assert.match(ui,/Sync delayed — showing cached mail/);assert.match(ui,/Offline — showing mail synced at/);assert.match(ui,/Cached mail remains available/);assert.match(ui,/mailboxLoading&&!messages\.length/);
  assert.match(api,/\/api\/communications\/sync/);assert.match(service,/listCachedMailbox/);assert.match(service,/gmail\.listHistory/);assert.match(service,/expired_history_full_sync/);assert.match(repository,/communication_provider_sync_states/);assert.match(repository,/provider_state_json/);
  assert.match(ui,/setInterval\(\(\)=>void refresh\(\),90000\)/);assert.match(ui,/window\.addEventListener\("online"/);assert.match(ui,/visibilitychange/);assert.match(ui,/communicationsApi\.changeState/);
});

test("Email QuoteSuite views and reader relationships include canonical Project without pretending Gmail folders",async()=>{
  const [ui,api,service]=await Promise.all([readFile("src/features/communications/EmailWorkspace.tsx","utf8"),readFile("src/services/communications/communicationsApi.ts","utf8"),readFile("server/features/communications/communicationsService.js","utf8")]);
  for(const label of ["Clients","Projects","Estimates","Orders","Suppliers","Unlinked","Follow Up"])assert.match(ui,new RegExp(`label:"${label}"`));
  assert.doesNotMatch(ui,/label:"Linked to Clients"|label:"Linked to Estimates"/);assert.match(service,/projects: "project"/);assert.match(ui,/Add relationship/);assert.match(ui,/Confirm relationship/);assert.match(api,/unlink:/);assert.match(api,/method:"DELETE"/);
});

test("Email reuses one conversation reader across List, Right and Bottom preview layouts",async()=>{
  const [ui,css]=await Promise.all([readFile("src/features/communications/EmailWorkspace.tsx","utf8"),readFile("src/features/communications/emailWorkspace.css","utf8")]);
  assert.match(ui,/type EmailLayoutMode="list"\|"right"\|"bottom"/);assert.equal((ui.match(/function ConversationReader/g)||[]).length,1);assert.match(ui,/email-preview-layout--\$\{effectiveLayout\}/);assert.match(ui,/Open full reader/);assert.match(ui,/is-preview-selected/);
  assert.match(ui,/quotesuite\.email\.layout\.v1/);assert.match(ui,/quotesuite\.email\.right-size\.v1/);assert.match(ui,/quotesuite\.email\.bottom-size\.v1/);assert.match(ui,/beginResize/);assert.match(ui,/Math\.min\(max,Math\.max/);assert.match(ui,/matchMedia\("\(max-width: 760px\)"\)/);
  assert.match(css,/email-preview-layout--right/);assert.match(css,/email-preview-layout--bottom/);assert.match(css,/cursor:col-resize/);assert.match(css,/cursor:row-resize/);assert.match(css,/minmax\(320px/);assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/email-preview-layout--right \.email-message-row\{[^}]*grid-template-columns:30px 30px minmax\(0,1fr\) auto 32px/);assert.match(css,/grid-template-areas:"select star sender time more" "select star content content more"/);assert.match(css,/email-preview-layout--right \.email-message-row time\{[^}]*white-space:nowrap/);
});

test("Email and Files use QuoteSuite typography tokens and normal control hit targets",async()=>{
  const [emailCss,filesCss]=await Promise.all([readFile("src/features/communications/emailWorkspace.css","utf8"),readFile("src/features/documents/canonicalDocuments.css","utf8")]);
  assert.match(emailCss,/email-message-row__sender[^}]*var\(--qs-type-body\)/);assert.match(emailCss,/email-message-row__content small[^}]*var\(--qs-type-meta\)/);assert.match(emailCss,/email-toolbar__button\{width:var\(--qs-control-height\);min-width:var\(--qs-control-height\);min-height:var\(--qs-control-height\);font-size:var\(--qs-icon-size\)/);assert.match(emailCss,/email-mailnav__group>button[^}]*min-height:var\(--qs-control-height\)/);
  assert.match(filesCss,/file-explorer__primary strong\{font-size:var\(--qs-type-body\)/);assert.match(filesCss,/file-explorer__primary small\{font-size:var\(--qs-type-meta\)/);assert.match(filesCss,/file-explorer__navigation \.ui-button\{min-width:var\(--qs-control-height\);min-height:var\(--qs-control-height\)/);assert.match(filesCss,/file-explorer__breadcrumbs[^}]*font-size:var\(--qs-type-body\)/);
});
