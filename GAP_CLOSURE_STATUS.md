# BYE PRO FINANCE — Gap Closure Status

This document records implementation state only. It does not mark CI or Production as successful until those systems report success.

## Closed in this phase

- Category reference data: 12 system categories seeded in Supabase; user-owned categories can be created, edited, and deleted from the Transactions section.
- Debt payments: existing payment history and atomic `register_debt_payment` flow retained and verified in the live database.
- Notifications: secure authenticated `refresh_finance_notifications()` refreshes bill, debt, and budget alerts with dedupe keys; Notifications now invokes it before loading the inbox.
- Currency safety: Transactions, Dashboard, and Reports no longer aggregate different currencies into a single monetary total.
- Responsive layout: explicit Mobile / Tablet / Desktop contract remains active; category management is responsive inside the Transactions section.
- Import/export: existing JSON backup validation, account ownership checks, and duplicate skipping remain in place.
- Smart Scan: existing local OCR flow remains review-before-save and creates the document + transaction only after user confirmation.
- API ownership audit completed: ordinary account, transaction, and budget CRUD remains user-scoped Supabase work in the web app; redundant REST wrappers and duplicate server CRUD handlers were removed.
- Server API retained only where server-side behavior adds value: session verification, idempotent transfer creation, AI assistant, admin/audit endpoints, and health.
- Transfer creation remains protected by bearer authentication, account ownership/RLS, same-currency validation, input validation, and `Idempotency-Key` handling.

## API financial route matrix

| Area | Web/Supabase canonical path | Server API | Action |
|---|---|---|---|
| Session | Supabase Auth | `GET /api/v1/session` | Keep |
| Accounts | Direct user-scoped Supabase CRUD | None | Remove duplicate REST CRUD |
| Transactions | Direct user-scoped Supabase CRUD | None | Remove duplicate REST CRUD |
| Budgets | Direct user-scoped Supabase CRUD | None | Remove duplicate REST CRUD |
| Transfers | Direct Supabase reads/listing | `POST /api/v1/transfers` | Keep server route for idempotency + validation |
| AI assistant | N/A | `POST /api/v1/ai` | Keep server route |
| Admin/audit | N/A | `/api/v1/admin/*` | Keep server route |
| Health | N/A | `GET /health` | Keep |

This deliberately avoids creating REST endpoints that merely proxy the same browser-to-Supabase operations. If a future integration needs a public API for accounts, transactions, or budgets, it must be introduced as a separately defined API contract rather than duplicating the current web data layer implicitly.

## Still requiring final verification

- CI must pass for the final verification commit.
- Production deployment of the latest code must be READY. A previous Vercel deployment limit returned HTTP 402; no paid-plan change is authorized.
- Manual device pass on real Mobile / Tablet / Desktop widths.
- Two-user isolation tests for Storage and all critical financial tables.
- Production endpoint tests for valid, missing, and invalid authentication plus unsupported methods and invalid payloads.
- Accessibility pass across all 18 navigation sections.
- Leaked Password Protection status in Supabase Auth remains to be confirmed/enabled.

## Navigation scope

The application keeps the existing 18 primary navigation sections. Category management is deliberately embedded in Transactions rather than adding a random 19th section.
