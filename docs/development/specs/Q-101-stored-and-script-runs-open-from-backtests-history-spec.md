# Q-101: Stored and script runs open from Backtests history

**Status:** written spec awaiting human review; the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2) is the status of record.
**Batch:** 17 — Research script runs in the Research stack
**Depends on:** Q-097, Q-099
**Implementation plan:** [Plan](../plans/Q-101-stored-and-script-runs-open-from-backtests-history-plan.md)

## Purpose

Selecting a run in Backtests history shows its stored metrics and configuration and a warning that "Trade charts and indicator series are not persisted", with Re-run as the only way to see the charts. The backend has stored the full result of every completed run since backtests became jobs, and serves it from `GET /api/v1/backtest/{run_id}/result`. The warning is out of date, and Re-run is impossible for a run published from a research script (Q-100), because the stack does not hold that strategy.

After this task a completed run opens from history into the same results view a fresh simulation shows — Performance, Monthly, Trade Chart and Trade List — and script runs are marked, filterable and review-only.

## Behaviour

### Opening a stored run

- The detail panel of a completed run offers **Open results**. It loads the stored result and shows it in the existing results view, with the run's own initial capital and configuration driving the equity curve, the monthly statistics, the metrics bar and the chart header.
- All four tabs work as for a fresh simulation: the Trade Chart draws bars, the stored indicator series in their panes and the trade markers; the Trade List, focus and hover behaviour, the standalone chart window and both CSV exports are unchanged.
- The results view says which stored run it shows (strategy, symbol, timeframe, created time) and offers a way back to history.
- Opening a stored run does not start a job and does not poll job status.
- When the stored result is missing (`404`), a stack run keeps the Re-run callout with wording that says the result is no longer stored; a script run says the result is missing and offers no action.
- A running job is not disturbed: opening a stored run while a simulation is pending is refused with a short notice.

### Script runs

Using `origin` and `provenance` from Q-097:

- History rows show a **Script** badge for script runs. The history filters gain an origin choice of All, Stack and Script, sent as the `origin` query parameter.
- The detail panel of a script run shows the provenance: script path, strategy class, git revision with a marker when the working tree was dirty, the strategy parameters, and the strategy source in a collapsed block when present.
- A script run has no **Re-run simulation** action, and selecting it does not load its configuration into the setup form. A stack run keeps both behaviours.
- Bookmarking, deletion, bulk deletion and run comparison work for script runs as for stack runs.
- Any flow that starts a job from a past run — Re-run, the ML filter "Train ML filter" entry, and seeding Optimize or Validate from a run — is not offered for a script run.

### Unchanged for stack runs

Selecting a stack run still loads its configuration into the form, and Re-run still works. The empty-state text that says charts are not saved is corrected.

## Interfaces

- Vendor the published Q-097 contracts through `CONTRACTS_REV` and `make contracts`; `make contracts-check` must be clean.
- `src/types/backtesting.ts` and `src/api/queries/backtests.ts` gain `origin`, `provenance`, the list filter and a stored-result query keyed by run id.
- The backtest session slice records which stored run is open, separately from the id of a running job, so the two cannot be confused.
- MSW handlers and mock data gain script runs with provenance, a stored result for them, and a `404` case.

## Focused acceptance

1. Component tests: a completed stack run and a script run each open into the results view with the four tabs populated from the stored result; no start or status request is made.
2. The Trade Chart receives the stored bars, both panes of indicator series and the trades; the Monthly tab reflects the stored trades and the run's initial capital.
3. A script run shows the badge and its provenance, has no Re-run action, does not change the setup form when selected, and is not offered for ML filter training.
4. The origin filter sends `origin` and the list shows the filtered runs.
5. A `404` result shows the stack-run and script-run messages described above.
6. Opening a stored run is refused while a simulation is pending.
7. `pnpm lint`, `pnpm typecheck` and `TZ=America/Sao_Paulo pnpm test:run` pass for the changed areas, and `make contracts-check` is clean.

Verification uses component tests and MSW. No backend, Tauri, Docker or GPU run is required by automated checks. One manual step follows merge: publish from a research script against `./dev research` and open the run.

## Delivery boundary

- No change to the results views themselves, the optimisation, validation or discovery workflows, or `q_terminal`.
- No editing, re-running or uploading of script strategies from the desktop.
- No new chart types; a script run shows what its strategy declared (Q-098).
