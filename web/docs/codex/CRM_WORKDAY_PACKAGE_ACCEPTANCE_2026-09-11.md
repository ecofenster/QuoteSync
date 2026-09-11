# CRM workday package — implementation and acceptance status

## Implemented

- Dashboard reads one bounded server projection instead of browser-local follow-up/outcome data.
- Needs-attention and today queues distinguish overdue follow-ups, unanswered Enquiries and explicit waiting-on-customer/supplier states.
- Pipeline labels use canonical Enquiry, active Estimate, issued customer review and Order evidence; they no longer call every open Estimate “sent” or every due follow-up “in negotiation”.
- Search is bounded and covers active Clients, Enquiries, Projects, Estimates and Orders.
- Dashboard work rows show owner, stage, next action and due date and retain exact record identity.
- New Enquiry is the Dashboard’s primary action. Enquiry review shows likely existing Clients with supporting email/name/Project evidence and explains name conflicts.
- Enquiry next-action changes show immediate progress, clear success/failure, preserve entered data after failure and support safe retry.

## Technically verified

An isolated normal-browser journey created disposable records and passed:

1. Dashboard canonical overdue count and functional search.
2. Dashboard → New Enquiry through the normal route.
3. Existing-Client suggestion with exact email evidence.
4. Next-action/waiting-state save and Dashboard projection.
5. Temporary API failure, explicit unchanged/retry feedback, retained input and successful retry.
6. Dashboard → exact Enquiry and exact dated follow-up navigation.
7. The pre-existing user API instance stayed unchanged.
8. Owned Chrome processes/profile after cleanup: `0 / 0`; disposable API/Vite processes and database were removed.

Focused API/commercial-identity tests, TypeScript and the production build also pass.

## Still in progress

- Authenticated multi-user/team assignment, reassignment and handover audit.
- Configurable stalled-opportunity/SLA policy rather than invented thresholds.
- One customer history spanning communications, notes, files and commercial lifecycle events.
- Waiting/next-action editors in Project, Estimate and Order contexts (the canonical API boundary exists; only Enquiry has the guided editor in this pass).
- User acceptance. Technical/browser verification does not mark this workflow accepted.

## Short user-acceptance checklist

1. Open **Main Dashboard** and confirm the “Needs attention” order makes sense.
2. Select **New Enquiry**, enter a known existing customer’s email and confirm the suggested Client and evidence are understandable.
3. Set a next action, due date and “Waiting on”, save it, then return to Main Dashboard.
4. Search by the Client or Estimate reference and open the result.
5. Open the Enquiry and follow-up rows from the Dashboard and confirm each lands on the exact selected work.

Do not mark the workflow user-accepted until an ordinary user completes this checklist without developer guidance.
