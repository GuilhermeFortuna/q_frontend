# Gateway app-wide validation (WO190)

Proves the Wine MT5 remote gateway feeds **every** consumer surface with fresh
`WIN$` / `WDO$` data on Linux, that WO188 coverage planning keeps gateway traffic to
actual gaps only, and that offline degrade remains honest.

**Prerequisites:** WO183–WO189 landed; `mt5-gateway.service` running on
`127.0.0.1:18812` (see [`q_backend/docs/mt5-wine-gateway.md`](https://github.com/GuilhermeFortuna/q_backend/blob/144345acc68ed1586f7e17ea2b2a119cb1195d08/docs/mt5-wine-gateway.md));
backend on `data_source=auto` with `Q_MT5_GATEWAY_URL` set; `./dev.sh` stack up
(Postgres :5432, Redis :6380, API + worker).

**Automated smoke (fake gateway, CI):**

```bash
cd q_backend
uv run pytest tests/integration_smoke/test_gateway_app_wide.py -v
```

**Automated smoke (live gateway, opt-in):**

```bash
cd q_backend
Q_MT5_GATEWAY_URL=http://127.0.0.1:18812 \
  uv run pytest tests/integration_smoke/test_gateway_app_wide.py -m live_gateway -v
```

**Gateway traffic meter:** each `/v1/ohlcv` hit is one `copy_rates_range` call in the
gateway process (count via `journalctl --user -u mt5-gateway.service` during manual
steps, or the fake-gateway `rates_calls` list in the scripted smoke).

---

## Live pass checklist

Record results inline after executing on the target Linux machine.

| Date | 2026-07-04 |
| Gateway | `http://127.0.0.1:18812` (schema from `/v1/health`) |
| Executor | _agent fake-gateway pass + user live pass pending_ |

| #   | Surface                  | Steps                                                                                                                 | Expected                                                                                       | Result                                    |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **Health**               | `curl -s http://127.0.0.1:18812/v1/health`                                                                            | `status=ok`, `mt5_connected=true`, `schema_version` major `1`                                  | **SKIP (live)** — not run in this session |
| 2   | **Market page**          | Open Market → `WIN$` → M5 chart; extend range to include today                                                        | Today's session visible; available-range picker reaches today                                  | **SKIP (live)**                           |
| 3   | **Backtests Simulation** | Run a simulation on `WIN$` M5 with end date = today                                                                   | Job completes; trades appear in the fresh tail                                                 | **SKIP (live)**                           |
| 4   | **Optimization**         | Short optimization job, range ending today                                                                            | Completes; gateway log shows **one** OHLCV fetch for the job's cached range (not per trial)    | **SKIP (live)**                           |
| 5   | **Discovery**            | Short discovery job, range ending today                                                                               | Completes; gateway log shows **one** OHLCV fetch per distinct cached range (not per candidate) | **SKIP (live)**                           |
| 6   | **Feature evaluation**   | Launch a feature evaluation over `WIN$` ending today                                                                  | Completes; bars include today (WO189 read-through)                                             | **SKIP (live)**                           |
| 7   | **Neural gate**          | Run latent evaluation for a trained model through today                                                               | Completes using fresh bars                                                                     | **SKIP (live)**                           |
| 8   | **Alpha preflight**      | Start alpha-research experiment; inspect preflight stage                                                              | Preflight completes with today's coverage                                                      | **SKIP (live)**                           |
| 9   | **Storage page**         | Open Storage → bars inventory for `WIN$` M5                                                                           | Rows reflect bars persisted by fetch-through from steps above                                  | **SKIP (live)**                           |
| 10  | **Offline degrade**      | `systemctl --user stop mt5-gateway.service`; reload Market + rerun a covered backtest; check Storage acquisition flag | Covered ranges still load from parquet; acquisition reports unavailable; no 500s               | **SKIP (live)**                           |

### Scripted fake-gateway results (2026-07-04)

Executed via `uv run pytest tests/integration_smoke/test_gateway_app_wide.py -v`
(without `-m live_gateway`):

| Case                                                    | Result   | Gateway requests                                    |
| ------------------------------------------------------- | -------- | --------------------------------------------------- |
| Tail gap-fill extends local envelope                    | **PASS** | **1** on first read, **0** on second identical read |
| `read_ohlcv_fresh` matches service freshness            | **PASS** | (same service path)                                 |
| Offline covered range still served                      | **PASS** | 0 after gateway marked unavailable                  |
| Offline uncovered → `ConnectionError` (`remote` source) | **PASS** | n/a                                                 |
| `read_ohlcv_fresh` offline fallback                     | **PASS** | n/a                                                 |

---

## Follow-up

- Execute rows 1–10 on the Wine machine when the gateway is up; paste observed
  `journalctl` OHLCV counts next to rows 4–5.
- If Wine flakiness causes a red row, note it as infrastructure — not a code defect —
  per WO190 guardrails.
