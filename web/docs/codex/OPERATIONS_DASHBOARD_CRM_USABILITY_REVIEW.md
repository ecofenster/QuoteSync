# Operations Dashboard and core CRM usability review

Date: 11 September 2026

Status: bounded review complete; implementation and ordinary-user acceptance are not complete.

## Scope and method

This review covers the Operations Dashboard, Enquiries, Clients/Contacts, Projects as customer context, Email/Communications, Follow Ups, pipeline/status visibility, activity history, search, ownership and handover. Estimate and Order data is considered only as lifecycle status or follow-up evidence. Project Costing, pricing, Configurator and technical supplier comparison are excluded.

QuoteSuite evidence comes from its current code, normal UI routes, the live workspace read-only, and disposable service tests. The normal browser run made no mutation or email request and verified zero owned Chrome processes and zero owned profiles after cleanup. Competitor observations below are documentation benchmarks only; they are not hands-on usability ratings, and availability varies by edition, plan, seat and configuration.

## Outcome

The dashboard is visually legible and its main areas are easy to scan, but it is not yet a dependable start-of-day CRM workspace. An ordinary user cannot reliably answer “what needs my attention, why, who owns it and what do I do next?” without navigating into several other areas or knowing implementation details.

The most serious issue is truth ownership. The dashboard reads Follow Ups and some Estimate outcomes from browser `localStorage`, while the Follow Ups workspace uses canonical API records. It then labels all open Estimates as “Quotes Sent”, uses due follow-ups as “In Negotiation”, and synthesises Recent Activity from order dates and follow-up due dates. This can disagree with lists and records and must not be treated as operational truth.

## Acceptance questions

| Question | Current evidence | Assessment |
| --- | --- | --- |
| Understand the dashboard without developer guidance? | Clear headings and cards exist, but “Lead source not wired”, a generic “Priority Actions” callout and misleading KPI labels require system knowledge. | Blocked |
| Today's work, overdue, unanswered, waiting and stalled? | Today schedule exists. Global overdue follow-ups, unanswered enquiries, customer/supplier waiting and stalled opportunities are absent. | Incomplete |
| Actionable item opens the record and next action? | Cards and schedule items open broad workspaces. `onOpenEstimate` is passed but unused; Recent Activity “View all” opens Orders. | Blocked |
| Ownership, stage, last contact, next action and due date clear? | Some due dates/statuses exist in Follow Ups. Owner, handover, last contact and canonical next action are not consistently displayed. | Incomplete |
| Enquiry to existing customer and follow-up without re-entry? | Enquiry creation and explicit Existing/New Client qualification exist. There is no automatic evidence-backed match, responsible-person assignment or follow-up handoff; Project information may be re-entered/reviewed. | Incomplete |
| Understandable customer history? | Notes, files, Email, Follow Ups and lifecycle records exist in separate workspaces. There is no unified customer activity timeline. | Blocked |
| Search, filters, duplicate handling and read state consistent? | Client and Email searches exist; mailbox pagination/read state are bounded. Dashboard search is inert, Enquiries have no search, and existing-record/conflict detection is unfinished. | Incomplete |
| Progress, outcome and recovery clear? | Current Email filing and some creation flows show progress/results. Coverage is inconsistent; Follow Up errors use brief generic toasts and the dashboard offers no recovery context. | Incomplete |
| Statuses agree everywhere? | Dashboard local data and synthetic stage mappings can disagree with canonical Follow Ups, Estimates and Orders. | Blocked |
| Readable in current and Legacy themes? | Normal-browser checks found the dashboard heading, copy and cards visible in QuoteSuite V2 Light/Dark and Legacy Light/Dark with the same Segoe UI family. Legacy dashboard headings use weight 900 and remain visually heavy. Accessibility beyond this bounded visibility check is unverified. | Technically visible; not user-accepted |

## Representative journeys

### New enquiry → existing record → owner → follow-up

Available: `+ New Enquiry`, one form, saved EF-ENQ identity, explicit Existing Client/New Client qualification and reviewed Project creation.

Dead ends/friction: the form exposes Source and Lead source together without guidance; qualification offers a full Client selector rather than evidence-backed likely matches; no owner/responsible-person field exists; no follow-up is created or offered at qualification; there is no Enquiry search. The user must leave the journey to continue in Follow Ups.

### Existing customer email → Project context → reply/task

Available: individual-message mailbox rows, exact selected-message body/attachments, reviewed Client/Project/Estimate linkage, filing feedback, and a Follow Up workspace link.

Dead ends/friction: record-match and file-conflict review remain incomplete; communications are not projected into one customer history; selected-message filing context and a subsequent task are separate actions; no email was sent in this review.

### Start the day → overdue work → complete → next action

Available: a dashboard schedule and Follow Ups calendar; a selected follow-up can be marked done, linked notes can be saved, and an issued-quotation follow-up can propose another follow-up.

Dead ends/friction: the dashboard may show zero because it reads legacy browser storage, even while the server-backed Follow Ups workspace has records. Its card opens the whole calendar, not the exact item. Overdue work is not an explicit global queue; ownership and handover are absent.

### Customer/staff/supplier waiting state

No coherent waiting-state queue was found. Some detailed lifecycle/procurement states exist elsewhere, but the dashboard cannot distinguish awaiting customer, awaiting staff or awaiting supplier and cannot deep-link to the relevant action.

### Estimate sent → follow-up → won/lost/on-hold

Issuing/follow-up and Estimate outcome foundations exist, but the dashboard calls all open Estimates “Quotes Sent” and treats due follow-ups as “In Negotiation”. Won/Lost views exist separately; a clear on-hold CRM outcome and one canonical status projection across dashboard/list/detail were not verified.

## Normal-browser evidence

- Dashboard primary action: `Add Client`, although the governed lifecycle says Enquiry is first.
- Dashboard search retained typed `EF-CL-028`, produced no result and did not navigate.
- Dashboard priority cards opened broad workspaces.
- Enquiries route exposed no search or owner field and used the technical explanation “Unqualified opportunities retain permanent EF-ENQ identity”.
- Client Database search worked as a discoverable local control, but visible rows did not expose owner, Last contact or Next action.
- The active Estimate list described EF-EST-2026-053 as `Issued — locked revision`, displayed `Cannot delete · archive only`, and exposed an `Archive EF-EST-2026-053` action whose help text states that issued evidence and relationships are preserved. The browser did not invoke it.
- All four tested appearance combinations rendered the sampled dashboard text/cards. V2 heading weight was 720; Legacy heading weight was 900.
- No browser console error or non-read request was recorded. Exact profile cleanup passed with 0 processes and 0 profiles.

## Official CRM documentation benchmark

| Product | Documented relevant capability | Useful comparison for QuoteSuite | Qualification |
| --- | --- | --- | --- |
| Salesforce | [Activities](https://help.salesforce.com/s/articleView?id=sales.activities.htm&language=en_US&type=5) relate tasks/events to leads, contacts and opportunities and expose activity timelines, lists and reminders. | Canonical activity ownership and record-linked work queues. | Documentation, not hands-on observation; edition/configuration details apply. |
| HubSpot | The [updated Sales Workspace](https://knowledge.hubspot.com/sales-workspace/manage-sales-activities-in-the-updated-sales-workspace) documents task summaries, suggested tasks, record tabs and filters; [record pages](https://knowledge.hubspot.com/records/work-with-records) combine overview, chronological activity and associations. | A focused “today” queue plus contextual record history, without forcing workspace switching. | Sales Workspace access depends on documented subscription/seat/permissions. |
| monday CRM | [Lead management](https://support.monday.com/hc/en-us/articles/360008648359-Lead-management-with-monday-CRM) documents owner, status and last update; [Timeline Overview](https://support.monday.com/hc/en-us/articles/25770383733266-Timeline-Overview) documents unread/attention cues; [Contacts](https://support.monday.com/hc/en-us/articles/115005311909-Manage-your-contacts-with-monday-CRM) documents email-domain association and a communication timeline. | Put owner, status and last touch together; offer reviewable matching rather than re-entry. | Some Emails & Activities features are limited to specified plans. Automatic domain association is not a safe substitute for QuoteSuite's explicit conflict review. |
| Zoho CRM | [CRM account structure](https://help.zoho.com/portal/en/kb/crm/crm-reference/introduction-to-zoho-crm/articles/understand-crm-account) documents a Home overview and multiple module views; [Home Tab](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-home-tabs/articles/customize-home-tab) documents open activities, dashboards and quick links; [Interactions](https://help.zoho.com/portal/en/kb/crm/using-crm-for-everyone/interactions-tab) documents a cross-channel customer-interaction view. | Separate a concise personal work view from management analytics and provide customer context. | Availability and customisation depend on account configuration and permissions. |
| Pipedrive | [Activities](https://support.pipedrive.com/en/article/activities) link work to people, organisations, leads, deals and projects and expose last/next activity; [Pipeline](https://support.pipedrive.com/en/article/pipeline-view) shows owner, upcoming activity, stale/“rotting” deals and detailed notes/email/files; [Contacts timeline](https://support.pipedrive.com/en/article/contacts-timeline) combines deal and interaction history. | Make next activity the prioritisation unit and provide a simple stalled-opportunity signal with exact record drill-down. | Contacts timeline is documented for Growth and higher; no assumption is made about other subscriptions. |

QuoteSuite should not copy competitor breadth. The relevant common pattern is narrower: one canonical activity/status source, a personal attention queue, exact record context, and a visible next action.

## What QuoteSuite already does well

- Canonical Enquiry, Client and Project identities and explicit qualification avoid silent fuzzy merges.
- Individual-message Email selection, read/unread state, bounded pagination and selected-attachment filing preserve message identity.
- Follow Ups can link Client, Estimate, issued quotation, communication and notes, and completion can propose the next quotation follow-up.
- Client, Project, Estimate, Files and communication foundations already provide most of the raw context needed for a useful CRM projection.
- Current and Legacy appearances preserved sampled essential dashboard visibility.

## Exists but is difficult to discover or use

- Follow-up completion and next-follow-up proposal are only discoverable inside the calendar/detail flow.
- Client context is spread across Client tabs and separate Email/Follow Up/Files areas.
- Estimate/Order lifecycle evidence exists, but dashboard labels are synthetic and navigation is workspace-level.
- Search is inconsistent by workspace; the dashboard control looks functional but is not wired.
- Failure and recovery wording has improved in Email filing but is not a uniform application contract yet.

## Missing, incomplete or unverified

- Canonical dashboard query/projection and consistent status definitions.
- Global overdue, unanswered enquiry/email, awaiting customer, awaiting supplier and stalled opportunity queues.
- Responsible owner, team queue, reassignment/handover history and filters.
- Last contact, next action and due date on dashboard/list/record surfaces.
- Exact deep links from dashboard items.
- Unified customer history for communications, notes, files and relevant lifecycle events.
- Evidence-backed duplicate/existing-record detection throughout intake.
- Ordinary-user acceptance across all representative journeys and accessibility validation.

## Proposed simple dashboard hierarchy

1. **Today** — date, current owner/team filter, one primary `New Enquiry` action and a working global search.
2. **Needs attention** — Overdue, Unanswered, Waiting for us/customer/supplier and Stalled. Each row shows customer/project, owner, stage, last contact, next action, due state and one contextual action.
3. **Today's schedule** — tasks/follow-ups due today, ordered by urgency, with direct completion/open actions.
4. **Pipeline snapshot** — truthful canonical stages and counts; management value totals remain secondary and only appear when their data authority is defined.
5. **Recent customer activity** — a short, canonical feed with `View customer history`; analytics/customisation belongs behind optional detail.

This preserves the approved V2 design system: the change is content hierarchy, state authority and navigation, not new component geometry or tenant-specific styling.

## Prioritised bounded work

### Immediate acceptance blockers

1. Replace dashboard `localStorage` and synthetic labels with one server-backed CRM projection; define status terms shared by dashboard, lists and records.
2. Make every actionable card/row open the exact record and next action; wire or remove the inert search field.
3. Add explicit overdue, unanswered, waiting and stalled queues with owner, last contact, next action and due date.
4. Complete evidence-backed existing-record matching and preserve intake data through Client/Project qualification and Follow Up creation.
5. Project communications, notes, files and lifecycle events into one customer-safe staff history.

### Next improvements

1. Add ownership/team queues, reassignment and handover evidence.
2. Provide consistent search/filter behaviour and saved personal/team views over canonical data.
3. Apply the guided progress/result/recovery contract to Follow Ups and CRM mutations.
4. Reduce technical wording and make `New Enquiry` the dashboard primary action.

### Later enhancements

1. User-configurable dashboard modules after the default journey is accepted.
2. Evidence-based reminders/automation and broader communication channels after ownership, permissions and tenant isolation exist.
3. Management analytics after operational event and value authority is canonical.

## Roadmap mapping

No duplicate feature programme was added. Findings map to existing entries:

- `crm-lifecycle`: intake, Client/Project reuse, ownership and handover.
- `crm-pipeline`: canonical stages, stalled opportunities, next action and outcomes.
- `communications`: Email linkage, unanswered state and unified activity history.
- `workflow-orchestration`: cross-workspace progress, outcomes and safe continuation.
- `guided-ux-staged-review` and `guided-ux-staged-review-2`: bounded usability evidence; still not user-accepted.
- `cleanup-immediate-5`, `cleanup-immediate-7` and `cleanup-immediate-8`: Client Database, communication adapter and navigation extraction dependencies.
- `saas` and `saas-tenant-isolation-acceptance`: owner/team and customer history must become tenant-scoped before release.
