# Workflow (approvals) — progress

Kept up to date after every step that is pushed, so the work can be picked up from here at any time.
Branch: `feature/missing-capabilities` in both repositories.

## Scope

CAT-79/80/81/126 (task review), CAT-160 (weekly timesheet approval), CAT-118 + CAT-4 (approver delegation /
temporary delegation), CAT-123 (approval routing), CAT-108 (approval chains per kind of work).

## Steps

| # | Step | Status |
|---|---|---|
| 1 | Core / TMPB-API: Workflow added (services, `/api/workflow/*` endpoints, schema at start-up) | ✅ pushed (Core `3806036`); round trip checked: chain → submit task review → Approval Center → approve → task completed |
| 2 | UI service + types (`services/approvalsApi.ts`, `components/approvals/types.ts`) | ✅ pushed |
| 3 | «کارتابل تأیید» page: pending approvals with titles, approve / reject with a comment (menu item, `Workflow.View`) | ✅ pushed |
| 4 | Task detail: «ارسال برای بازبینی» and the review status (pending / rejected with reason / approved) | ✅ pushed |
| 5 | Timesheet: submission says whether it went for approval; rejected entries editable and resendable | ✅ pushed |
| 6 | Settings «اتوماسیون و گزارش» → «مسیرهای تأیید»: steps per kind, by chart role (direct manager, one level up, owner) or a person; optional steps; order | ✅ pushed |
| 7 | Approver delegation (period, kind, reason; revoke) — tab «جانشینی تأیید» on the approvals page | ✅ pushed |
| 8 | End-to-end check in the real app | ✅ chains saved; task submitted → rejected with a reason (shown in the detail, task back to «در حال اجرا») → resent → approved (task completed); timesheet week submitted → approved; delegation recorded; no page errors, no 5xx |

## Facts the UI relies on

- With no chain (definition) for a kind of approval, nothing changes: the module applies its own rule
  (task review completes the task at once; a timesheet week is accepted at once).
- Subject types: `TaskReview` (Nexus.TaskManagement TaskReviewService), `Timesheet` (TimesheetService).
- Participants given by those modules: `Owner`, `Manager` / `Approver1` (direct manager in the chart),
  `Approver2` (the manager above).
- Permissions: `Workflow.View`, `Workflow.Configure`, `Workflow.Approve`, `Workflow.Reject`.
- Titles for the Approval Center list: `POST /api/task-management/tasks/in-review` (TaskReview ids) and
  `POST /api/task-management/timesheets/in-review` (Timesheet ids).

## Done — follow-ups

- **Load on the board:** every board reload reads each task's detail, comments and history (3 requests per task).
  A burst of changes can hit the server's rate limit (600 requests a minute per user), and the screen then keeps
  stale data until the next reload. Not caused by this work; worth a list endpoint that returns what the board needs.
- Approvals by «مدیر مستقیم» need the person to have a post with a manager in the chart; otherwise use an optional
  step or a named person.

# Work calendar (CAT-85) — done

| # | Step | Status |
|---|---|---|
| 1 | TMPB-API: `/api/calendar/work-calendars` mapped, Iranian official holidays installed, tables created at start-up, `db/upgrade-20-work-calendars.sql` (+ rollback) | ✅ pushed (Core `629791b`) |
| 2 | UI: settings «اتوماسیون و گزارش» → «تقویم کاری»: working week, hours per day, official holidays, default, date exceptions, month preview | ✅ pushed, checked in the browser |
| 3 | Core: SLA «فقط روزهای کاری» follows the default work calendar (`ISlaWorkingDays`, calendar-tasks integration); without one, the old rule | ✅ pushed; checked: a non-working exception tomorrow → a 48 h SLA comes out at 72 h |

Not changed on purpose: the rule that no task can be due on a Friday or an official holiday (task and meeting
dates) still uses the fixed Iranian rule, not the work calendar, so an organization's own days off do not block
due dates. Moving that rule to the work calendar too is a product decision.

# Command palette (CAT-107) — done

Ctrl+K / ⌘K anywhere: go to any page the user may open, «فعالیت جدید», settings sections, and find a task by
title (opens its detail). Arrow keys / Enter / Esc. `components/palette/CommandPalette.tsx`, mounted once in
`App.tsx` (shared file: one import, one callback, one element). ✅ pushed, checked in the browser.

# Workflow DB script — done

Core `TMPB-API/db/upgrade-21-workflow.sql` (+ `upgrade-21-rollback.sql`) for databases managed by scripts:
idempotent, same schema as the API builds at start-up (checked column by column), also brings an older Workflow
schema up to date. `db/check-upgrades.sql` and `DEPLOYMENT-CONFIG.md` now list steps 19-21. ✅ pushed.
