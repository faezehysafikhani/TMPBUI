# UI workstreams: features that have a backend but no screen yet

Three independent tracks, each on its own branch from `feature/missing-capabilities`.
Full plan (features and endpoints per track): https://claude.ai/artifact/LJvotKtuE39dmP2zcQKri1

| Track | Branch | Folder | Service file | Types |
|---|---|---|---|---|
| 1. هستهٔ فعالیت | `feature/ui-tasks` | `src/components/tasks/` | `src/services/taskFeaturesApi.ts` | `src/components/tasks/types.ts` |
| 2. زمان، درخواست و اتوماسیون | `feature/ui-work-intake` | `src/components/work/` | `src/services/workApi.ts` | `src/components/work/types.ts` |
| 3. امنیت، حساب‌ها و مدیریت سیستم | `feature/ui-admin-security` | `src/components/security/` | `src/services/adminApi.ts` | `src/components/security/types.ts` |

## What step 0 already wired (do not edit these lines again)

- **Pages** (`ActiveTab` in `SandwichBar.tsx`, `App.tsx`, `DesktopSidebar.tsx`, mobile menu in `SandwichBar.tsx`,
  visibility in `utils/permissions.ts`):
  - `archive` → `components/tasks/ArchivedTasksView.tsx` (Track 1), needs `Tasks.View`
  - `requests` → `components/work/RequestsView.tsx` (Track 2), needs `Requests.Submit`, `Requests.Handle` or `Requests.Manage`
  - `timesheets` → `components/work/TimesheetsView.tsx` (Track 2), needs `Timesheets.Log` or `Timesheets.ViewAll`
- **Settings tabs** (`components/admin/SystemAdministration.tsx`). Each tab file exports the component and
  the function that decides who sees the tab; change only your own file:
  - «تنظیمات فعالیت» → `components/tasks/TaskSettingsTab.tsx` (Track 1)
  - «اتوماسیون و گزارش» → `components/work/AutomationSettingsTab.tsx` (Track 2)
  - «امنیت و حساب‌ها» → `components/security/SecuritySettingsTab.tsx` (Track 3)
- **Slots in Track 1's files for Track 2:**
  - `TaskDetailModal.tsx` renders `components/work/TaskTimePanel.tsx` (estimate, logged time, timer)
  - `TaskCard.tsx` renders `components/work/TaskSlaBadge.tsx`
- **New task fields:** `task.server` (`TaskServerFields` in `types.ts`) carries what the server sends and the
  old screens did not use: `rowVersion`, `archivedAtUtc`, `customStatusId`, `blockedReason`,
  `estimatedMinutes`, `slaDueAtUtc`, `slaBreachedAtUtc`, `sourceType`/`sourceId`, review fields.
- **Backend:** `TMPB-API` maps `MapCalendarTasksEndpoints` (meeting actions to tasks, Track 2).

## Rules

1. Call the backend from your track's service file with `apiRequest` (exported by `nexusApi.ts`). Do not add
   functions to `nexusApi.ts` and do not add types to `types.ts`.
2. A file outside your folder has one owner (below). Do not edit another track's files; use the slots above.
   If you really need a change in a shared file, agree on it with the others first.
3. Define your permission names in your own folder, not in `utils/permissions.ts`.
4. Only UI work in this phase: no changes to Core or `TMPB-API`.

## Owners of existing files

| Owner | Files |
|---|---|
| Track 1 | `TaskDetailModal.tsx`, `TaskFormModal.tsx`, `KanbanBoard.tsx`, `KanbanColumn.tsx`, `TaskCard.tsx`, `TaskCardList.tsx`, `TaskListView.tsx`, `TaskGroupColumn.tsx`, `FilterBar.tsx`, `BoardViewBar.tsx` |
| Track 2 | `TeamChatView.tsx`, `ChatExtras.tsx`, `MeetingDialog.tsx`, `MeetingFormModal.tsx`, `MeetingResolutionTasks.tsx`, `ReportsView.tsx`, `components/reports/*` |
| Track 3 | `AuthModal.tsx`, `SessionGuard.tsx`, `SettingsView.tsx`, `components/admin/*` (except the step-0 lines in `SystemAdministration.tsx`), `components/admin/orgStructure/*` |
| Nobody | `services/nexusApi.ts`, `types.ts`, `App.tsx`, `DesktopSidebar.tsx`, `SandwichBar.tsx`, `utils/permissions.ts` |

## Changes made to shared files (agreed exceptions)

- Track 1: `services/nexusApi.ts` exports `reloadTasksSoon()` (for changes the server does not announce) and
  `updateTask` sends `rowVersion` from `task.server`; `utils/errorMessages.ts` has Persian text for the new
  task refusals (dependencies, criteria, WIP, templates, concurrent edits); `App.tsx` undoes a refused status
  change in the open task detail and shows the reason as a toast.
- Track 2: `utils/errorMessages.ts` has Persian text for the timesheet, request, automation, report-digest and
  meeting-action refusals. It also touched its own files `ReportsPage.tsx` (the «ارسال خودکار گزارش» button) and
  Track 1's slots only through `TaskTimePanel` / `TaskSlaBadge`. Track 1's archive page and date fields now use a
  date-only Jalali format (`formatJalaliDay`), since `formatToJalali` always adds a time.
- Track 3: `services/nexusApi.ts` adds the SMS-code sign-in step (`MfaRequiredError`, `completeMfaLogin`), the
  session pickup after single sign-on (`completeSsoSignIn`) and `kind` / `mfaEnabled` on `AdminUser`;
  `services/orgStructureApi.ts` carries a node's `validFrom` / `validTo`; `utils/errorMessages.ts` has Persian text
  for the plan, CSV and LDAP refusals. Date pickers for future days no longer use `allowYearSelection` (it offers
  only past years, for birth dates).

## Not in these tracks

Review and approvals (CAT-79/80/81/126), weekly timesheet approval (CAT-160), approver delegation (CAT-118, CAT-4),
approval routing (CAT-123) and workflow (CAT-108) need the Workflow module, which `TMPB-API` does not include.
Webhooks (CAT-237) are switched off (`TaskManagement:Webhooks:Enabled=false`).
