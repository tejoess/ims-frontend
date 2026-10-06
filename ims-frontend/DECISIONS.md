# Decisions

Episodic memory: what was decided, and why, tied to specific tickets — not
just the general facts about the system (that's `CLAUDE.md`). Appended to
by `pr-reviewer` after each ticket is approved. Don't hand-wave entries —
"fixed the bug" is not a decision record.

Format per entry:

```
## <TICKET-KEY> — <one-line title>
Date: YYYY-MM-DD
Risk tier: LOW | MEDIUM | HIGH | CRITICAL
Decision: what was actually decided or changed, in plain language.
Against acceptance criteria: which ones this satisfies, verbatim from
  the scope contract, not paraphrased.
Notes: anything a future ticket touching this area should know —
  trade-offs taken, things deliberately left out of scope, alternatives
  considered and rejected and why.
```

---

<!-- Entries below this line, most recent first -->

## EPT-28 — Frontend: Platform Audit Trail (PR opened, awaiting merge)
Date: 2026-10-07
Risk tier: MEDIUM
Decision: Implemented admin-only Platform Audit Log page (19/19 TCs green,
  all AC-01..AC-11 covered). Branch feature/EPT-28 pushed; draft PR opened
  on GitHub. Key design decisions made during implementation:
  (1) Date inputs debounced 300 ms same as text inputs — without this, setting
      dateFrom alone triggered an API call before dateTo was set, breaking TC-018.
  (2) Pagination rendered whenever totalCount > 0 (not gated on !loading) —
      without this the Previous button disappeared during re-fetch, breaking TC-015.
  (3) Optimistic setPage(p) before fetchEvents(p) so pagination shows correct
      page number while loading.
  (4) Skeleton built from div.skeleton rows (not a table) so queryByRole("table")
      returns null during loading, satisfying TC-016.
  (5) Date validation (dateErrorMsg) derived inline from immediate UI state, not
      debounced state — shows instantly without 300 ms delay.
Against acceptance criteria: AC-01..AC-11, 19 test cases (TC-001..TC-019).
Notes: App.js and Sidebar.js appear as full-file adds in the diff because src/
  was previously untracked; EPT-28's actual changes are 5 lines across both.
  Tracking all src/ files is a recommended follow-up task.
  Pre-existing App.test.js failure (CRA boilerplate "learn react" test) is not
  caused by this ticket — confirmed against checkpoint commit 5808c48.
  Export filename uses UTC date — users near midnight in UTC+ zones may see a
  one-day offset in the filename (no functional impact).

## EPT-28 — Frontend: Platform Audit Trail (plan approved)
Date: 2026-10-07
Risk tier: MEDIUM
Decision: Plan approved for building the admin-only Platform Audit Log page.
  New sidebar link ("Platform Audit Log"), new AuditLog page with a two-row
  filter card (search + actor email + entity type + date range in row 1;
  category and severity pills in row 2), 7-column paginated table (25/page),
  expandable metadata panel per row, CSV export with 1,000-row warning, and
  three-state UI (skeleton / error+retry / data). No database changes.
  Backend (EPT-27) confirmed Done before this ticket started.
  Human note: "yes correct, check ui" — open questions resolved by UI mockup
  review: (1) both Search and Actor Email inputs are separate, confirmed in
  mockup; (2) Entity Type options confirmed as User / Claim / UserPolicy.
Against acceptance criteria: AC-01..AC-11, 19 test cases (TC-001..TC-019).
Notes: Filter card uses two-row layout derived from UI mockup (not one-row
  as initially planned). Entity label format is "Type #id" (e.g. "Claim #42").
  Metadata panel renders as flex card grid with individual bordered cards,
  not a dl element. "Clear Filters" in empty state is a blue primary button,
  not a text link. Clear All Filters button is conditionally visible (only
  when any filter is active). Export shows a green toast via useToast() on
  success. All design tokens (severity colours, category dot colours) taken
  from the attached HTML mockup "Audit Log — Admin-html.zip".

## EPT-25 — Policy Search & Filtering (approved, PR opened)
Date: 2026-09-22
Risk tier: MEDIUM
Decision: Approved and merged into a draft PR: client-side search
  (partial match) and combinable status/type filters on the Policies
  catalog and My Policies pages, via a new shared PolicySearchFilter
  component and policyFilter.js helper. No backend/schema changes. At
  Gate 1 the human resolved three open items: (1) the catalog Policy
  model has no policy_number/status fields, so that tab keeps title
  search + type-only filtering rather than adding a schema migration for
  catalog "status"/SKU concepts (option a); (2) search/filter state
  resets independently per tab on navigation (no cross-tab persistence);
  (3) the existing single-select FILTERS bar on Policies.js was
  intentionally replaced by a multi-select type filter. At Gate 2 the
  reviewer additionally noted (not blocking, not discussed at Gate 1)
  that My Policies' type-filter chips are dynamically derived from
  owned policies while the catalog tab always shows a static 5-chip
  list — approved as-is.
Against acceptance criteria: AC-001..AC-007 in .claude/current-scope.yaml
  (search, combinable filters, tab scoping/isolation, empty-state split,
  clear action, visual alignment). All 18 TC-nnn test cases pass; full
  verification pyramid green (build, unit, integration/Playwright), no
  regressions in pre-existing suites.
Notes: True policy-number search and status filtering on the catalog tab
  were explicitly descoped, not deferred by accident — a future ticket
  adding catalog SKU/status concepts needs its own schema migration and
  PRD decision. Evidence bundle: .agentic/tickets/EPT-25/evidence.md.
