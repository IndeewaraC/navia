# Release history

## 0.1.1 — 2026-10-21

Tracking: [release #10](https://github.com/IndeewaraC/navia/issues/10).

- [#11](https://github.com/IndeewaraC/navia/issues/11): Display the recorded receipt date in both the list and detail, without shifting to the previous day in Winnipeg. Ledger and history use the same calendar-date formatter. Existing stored records are preserved.
- [#12](https://github.com/IndeewaraC/navia/issues/12): Record project contributions without checking an account balance or deducting funds. Update saved project progress only; no artificial ledger transfer is created. Ownership and positive currency amounts are validated, and concurrent updates return a conflict instead of overwriting the newer total.
- Correct the Vault balance display to use the fetched `current_statement_balance` field.

The linked release tracker records the deployed commit and production verification. No database migration is required.

## Previous production budget-cycle hotfixes — 2026-10-21

Tracking: [release tracker #6](https://github.com/IndeewaraC/navia/issues/6). These fixes shipped before release numbering and issue tracking were introduced.

- [#7](https://github.com/IndeewaraC/navia/issues/7): Align budget and new transaction dates with Winnipeg midnight; fix production build directive ordering. Commit [5faabcd](https://github.com/IndeewaraC/navia/commit/5faabcd).
- [#8](https://github.com/IndeewaraC/navia/issues/8): Use the exact monthly reset selected by the user, retain the current start, and remove inferred 14-day resets. Commit [ac98ae0](https://github.com/IndeewaraC/navia/commit/ac98ae0).
- [#9](https://github.com/IndeewaraC/navia/issues/9): Honor past anchors such as October 2 for operational usage and funding-source availability; allow correcting the current cycle start. Commit [e5cc8bd](https://github.com/IndeewaraC/navia/commit/e5cc8bd).

Reset dates are selected manually. Changing a future reset replaces the scheduled date; it does not queue both dates. The user selects the following reset after the current one is reached.
