# Phase 4 acceptance record (Q-050)

**Written against commits:** see [Repository pins](#repository-pins) (branch tips at handoff)  
**Branch:** `Q-050-execution-workspace-leaves-q-frontend`  
**Scope:** Q-039 through Q-050 — execution edge, stream, terminal operations, frontend removal

## Parity gate (Q-050 criterion 1)

Terminal parity document read at `q_terminal` `development` commit **`1a71d3f01913e81b3935cea163adb039d7370506`**
(`docs/ops-parity.md`). Every row is `[x]` mapped or carries an explicit omission rationale
(external monitor link, manual refresh automated by stream).

## Environment

- Host: local development (Linux)
- Research UI: `q_frontend` Tauri 2 + React 19 (`pnpm`, Node 20+)
- Operations UI: `q_terminal` Qt 6 / QML
- Backend: `q_backend` FastAPI + execution worker + Wine edge (`./research` or `./dev`)
- Contracts pin: `q_contracts` at `CONTRACTS_REV` in each consumer

## Repository pins

| Repository    | Commit (development / task branch tip at handoff) |
| ------------- | ------------------------------------------------- |
| `q_contracts` | `03214a0760945120c56c2af97a542fcb26da2f1e`        |
| `q_backend`   | `95ee34debb6f99bf483b751e8f904c6693af2d4f`        |
| `q_terminal`  | `1a71d3f01913e81b3935cea163adb039d7370506`        |
| `q_frontend`  | `3391ebe157b689e8f8a5132755ca06c5767eaccb`        |

## Automated validation

| Group                    | Command                                                                                                                                                                   | Result                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Frontend notice + routes | `TZ=America/Sao_Paulo pnpm test:run src/app/__tests__/MovedToTerminalNotice.test.tsx src/app/__tests__/executionRoute.test.ts src/app/__tests__/executionHygiene.test.ts` | pass                                 |
| Frontend full suite      | `TZ=America/Sao_Paulo pnpm test:run`                                                                                                                                      | pass (913 tests)                     |
| Frontend typecheck       | `pnpm typecheck`                                                                                                                                                          | pass                                 |
| Frontend lint            | `pnpm lint`                                                                                                                                                               | pass (warnings only)                 |
| Frontend build + bundle  | `pnpm bundle:report`                                                                                                                                                      | pass                                 |
| Frontend CI              | `CONTRACTS_REPO=/path/to/q_contracts TZ=America/Sao_Paulo scripts/ci.sh`                                                                                                  | pass (913 tests, build, Tauri stage) |
| Backend idempotency      | `uv run pytest tests/api/test_execution_idempotency.py -q`                                                                                                                | pass (includes default-refusal test) |
| Backend CI               | `scripts/ci.sh`                                                                                                                                                           | pass (2032 passed, 15 skipped)       |
| Hygiene                  | `grep -rn "queries/execution\|types/execution\|workspaces/execution\|components/execution" src`                                                                           | no matches                           |

## Derived figures (Q-050 bundle removal)

`pnpm bundle:report` before deleting the execution surface (commit `9904226` parent tree):

| Chunk                          | Size (minified) |
| ------------------------------ | --------------: |
| `ExecutionWorkspace-*.js`      |         38.2 KB |
| `ExecutionLiveChartPanel-*.js` |         20.1 KB |
| `ExecutionLiveWorkspace-*.js`  |         10.7 KB |
| `index-*.js` (startup entry)   |        422.4 KB |
| Startup-related total          |       1752.7 KB |

After removal (same command on Q-050 branch):

| Chunk                        | Size (minified) |
| ---------------------------- | --------------: |
| execution workspace chunks   |        _absent_ |
| `index-*.js` (startup entry) |        421.6 KB |
| Startup-related total        |       1747.2 KB |

**Delta:** ~70 KB of deferred execution chunks removed; startup entry −0.8 KB; startup total −5.5 KB.

## Manual acceptance (pending)

| Task  | Criterion                                                | Command                                                              | Compare against          |
| ----- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| Q-039 | Six payload schemas carry every frontend execution field | `$EDITOR q_contracts/schema/stream/payloads/execution-*.schema.json` | backend execution tables |
| Q-039 | Edge derivation leaves no dual-intent path               | `$EDITOR q_contracts/schema/edge/execution.yaml`                     | architecture §6.2        |
| Q-040 | Edge health, quote age, positions/deals match terminal   | `systemctl --user start mt5-edge && curl …`                          | terminal tabs            |
| Q-040 | Submit + duplicate_intent + lookup on demo account       | `curl -s -X POST 127.0.0.1:18813/v1/submit …`                        | one terminal order       |
| Q-041 | Paper MACrossover + trailing stop exits on `trailing`    | `uv run q-execution --log-level INFO run` + decisions API            | decision log             |
| Q-042 | Demo `mt5_live` entry with ledger ticket                 | worker log + fills API                                               | terminal position        |
| Q-042 | Crash at `after_broker_response` then recovery           | `uv run q-execution run --crash-at after_broker_response`            | no duplicate order       |
| Q-042 | API flatten closes demo position                         | curl flatten with Idempotency-Key                                    | flat ledger              |
| Q-043 | Stream topics match paged routes per bar/trade           | `websocat` subscribe + snapshot curl                                 | row counts               |
| Q-044 | Idempotent flatten replay                                | curl twice with one key                                              | one audit flatten        |
| Q-045 | Worker health, edge down, STOP watchdog                  | `systemctl --user start q-execution-worker` + health curl            | stale + restart          |
| Q-046 | Headless store counts match snapshot; API restart        | `cargo run -- --headless-report --execution`                         | snapshot jq              |
| Q-047 | 30 min parity + p95 frame time                           | `make run` + `BENCH_EXECUTION_ROWS=10000 make bench-frames`          | < 16 ms p95              |
| Q-047 | Dependency stop/start §8.1 states + recovery             | `systemctl --user stop q-redis` (etc.)                               | screenshots              |
| Q-048 | Full paper control session from terminal                 | `make run` + audit-events curl                                       | one command each         |
| Q-048 | Kill switch rejects next signal                          | terminal controls                                                    | risk table `kill_switch` |
| Q-048 | Edge/worker down disables controls                       | stop edge/worker                                                     | UI disabled state        |
| Q-049 | Two deployments chart switch + markers                   | `make run`                                                           | tables + p95 < 16 ms     |
| Q-049 | Terminal vs former frontend marker parity                | screenshot compare                                                   | same bars                |
| Q-050 | Research UI workspaces work; `/execution` notice         | `pnpm tauri dev`                                                     | notice only              |
| Q-050 | Full paper session terminal-only                         | `cd q_terminal && make run`                                          | no frontend needed       |
| Q-050 | Fill this record from Q-039–Q-050 human results          | `$EDITOR docs/development/baselines/Q-050/phase-4-acceptance.md`     | all rows checked         |

**Phase 4 status:** pending manual entries above.

## Deferred follow-ups

| Follow-up                                  | Measurement or event that would justify it                         |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Real-money activation                      | Controlled-account validation record with gates opened per account |
| FINDINGS #3 (live holding-period matching) | Live activation safety review                                      |
| Invariant-3 residual in research client    | Research stream consumer ships without paged-route fallback        |
| Research-job idempotency                   | Second research client sends keyless commands in production        |
| `q_core` pin / `COMPAT.md` contracts drift | Cross-repo pin bump with empty `make contracts-check`              |
| Streamed indicator topic                   | Terminal chart needs sub-bar indicator refresh                     |
