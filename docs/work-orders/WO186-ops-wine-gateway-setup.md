# WO186 — Ops: Wine MT5 gateway setup, systemd unit, E2E checklist

## Shared context (read first)

Part of the WO183–WO186 remote-gateway batch; read `docs/design/mt5-remote-gateway.md`
(in `q_frontend/docs/design/`). WO183–185 delivered the gateway server, the client, and the
routing. This WO delivers the operator side: getting the MT5 terminal + gateway running under
Wine on the user's Fedora machine, starting automatically, and a manual end-to-end
verification checklist. This WO is mostly docs + scripts; it is inherently **Linux-side**
(unlike most WOs, Windows paths do not apply here).

Backend repo: `q_backend` (`uv run pytest` for anything Python — never pip/poetry).

## Files to read

- `q_backend/gateway/mt5_gateway.py` (WO183) — launch command, `--host/--port/--token` flags
- `src/q_backend/storage/runtime_config.py` (WO184) — `remote_gateway_url` /
  `remote_gateway_token` keys, `Q_MT5_GATEWAY_URL` / `Q_MT5_GATEWAY_TOKEN` env vars
- `docs/design/mt5-remote-gateway.md` — §6 "Wine setup & operations" and the risk register

## Goal

A user on a fresh Linux boot runs one script (or has systemd do it), and within a minute:

```bash
$ curl -s http://127.0.0.1:18812/v1/health
{"status": "ok", "schema_version": "1.0", "mt5_connected": true, "terminal_build": 4620}
$ # backend on data_source=auto now serves fresh WIN$ bars via the gateway
```

## Tasks

1. `q_backend/gateway/setup_wine.sh` — idempotent, re-runnable setup script:
   - dedicated Wine prefix (default `~/.local/share/mt5-gateway-prefix`, overridable via
     `MT5_GATEWAY_PREFIX`), 64-bit, pinned: record the Wine version used at first setup in a
     marker file inside the prefix and warn loudly if the system Wine has since changed
     (design-doc risk (b) mitigation);
   - install the MT5 terminal (official installer URL, downloaded with checksum note) and a
     Windows Python (embeddable or full installer) into the prefix;
   - `pip install MetaTrader5==<pinned version>` inside the Wine Python — pin the exact
     version in the script, with a comment on how/when to bump;
   - print the resulting launch commands and where the terminal's login must be configured
     manually (broker credentials are entered in the terminal GUI once; the script never
     handles credentials).
2. `q_backend/gateway/systemd/mt5-gateway.service` — **systemd user unit** template that
   launches the terminal (headless-ish under the prefix) and then the gateway
   (`wine python.exe .../mt5_gateway.py --port 18812`), with `Restart=on-failure`, ordering
   (gateway after terminal + a health-wait loop), and an `EnvironmentFile` example for
   `MT5_GATEWAY_PREFIX`/port/token. Include the `systemctl --user enable --now mt5-gateway`
   instructions. Production trigger (cutover guardrail): this unit **is** the production
   trigger for WO183's server — the doc must state that explicitly.
3. `q_backend/docs/mt5-wine-gateway.md` — operator guide:
   - prerequisites (wine, winetricks if needed, disk space), setup script walkthrough,
     first-login-in-terminal step, backend configuration (`data_source=auto` or `remote`,
     `Q_MT5_GATEWAY_URL=http://127.0.0.1:18812`);
   - troubleshooting table: terminal won't start under Wine, `MetaTrader5` pip package fails
     to import, health shows `mt5_connected: false` (terminal not logged in / not running),
     schema-version mismatch after a repo update;
   - the fallback deployment: running the identical gateway on a Windows VM/machine and
     pointing `Q_MT5_GATEWAY_URL` at it (token required for non-localhost; recommend the
     `--token` flag and note the traffic is plain HTTP — LAN/VPN only, never the open
     internet);
   - **manual E2E checklist** (this is the batch's real verification, CI can't cover Wine):
     health OK → Storage-page ingest of `WIN$ M5` for the last week succeeds on Linux →
     Backtests Simulation runs on a range including yesterday → stop the gateway →
     backend degrades to `local` without errors and the just-ingested bars are still served.
4. Repo hygiene: `shellcheck` the script (add it to whatever lint path the backend repo uses,
   or at minimum record `shellcheck gateway/setup_wine.sh` clean output in the final message);
   the systemd unit and doc get no tests.

## Guardrails

> The setup script never stores, prompts for, or logs broker credentials — login happens once
> in the terminal GUI and lives in the Wine prefix.
> Gateway binds `127.0.0.1` by default; the doc must not casually suggest `0.0.0.0` without
> the token + LAN/VPN caveat in the same breath.
> Do not auto-update anything: Wine prefix, terminal build, `MetaTrader5` pip version are all
> pinned; upgrades are a deliberate, documented operator action.

## Tests

No pytest surface. Verification is the manual E2E checklist in the doc, executed once on the
real machine, with each step's observed output pasted into the final message. `shellcheck`
clean on `setup_wine.sh`. `systemd-analyze verify --user mt5-gateway.service` clean (or note
why it can't run in the environment).

## Docs

This WO _is_ docs: `q_backend/docs/mt5-wine-gateway.md` as described above, plus a pointer to
it from `q_backend/README.md` and from `docs/design/mt5-remote-gateway.md` §6.

## Definition of done

The manual E2E checklist has been executed on the target machine with all steps green — do not
report completion until it has (if the agent cannot run Wine steps itself, the DoD is:
artifacts complete + checklist handed to the user, explicitly flagged as awaiting the user's
run). Final message must include: the exact commands the user runs on a fresh boot, the pinned
versions (Wine noted, terminal build, `MetaTrader5` pip), and the E2E checklist results or
handoff.

## Out of scope

Any code change in `src/q_backend` (WO183–185 are complete before this runs). Windows-VM/VPS
automation (the doc describes it; scripting it is backlog). TLS for the gateway (LAN/VPN +
token is the accepted posture for now).
