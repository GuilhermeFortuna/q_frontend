# WO60 — Backend: storage & news routers + news service (extract from `main.py`)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context:** batch "API decomposition" (read **WO56** for the package skeleton + conventions). This
WO migrates the last two domains and **empties `main.py` of business routes**: **storage** (thin,
delegates to `storage_jobs.py`) and **news** (a self-contained RSS subsystem embedded inline —
`urllib`/`xml`/`base64`/`email.utils` — that should become a proper service). After this WO,
`main.py` is the ~50-line app-assembly file WO56 targeted. **No API change.** Depends on WO56;
sequence after the other domain WOs so it's the one that removes the final routes.

---

## How the pieces work today (read these in `main.py`)

**Storage** (`/api/v1/storage/*`): `get_storage_inventory`, `start_storage_ingest`,
`get_storage_ingest_status`, `delete_storage_series` → delegate to `storage_jobs.py`
(`IngestJobRequest`). Schemas: `StorageInventoryItem`, `StorageInventoryResponse`,
`StorageIngestStartResponse`, `StorageIngestStatusResponse`, `StorageDeleteResponse`.

**News** (`/api/v1/news`, `/api/v1/news/{article_id}`): `get_news_articles`, `get_news_article` —
inline logic fetches a hard-coded list of RSS feeds (`valor.globo.com` x3, `cnbc.com`) via
`urllib.request` with a 3s timeout, parses XML with `xml.etree.ElementTree`, derives an
`article_id` as `base64.urlsafe_b64encode(link)`, parses dates with `email.utils.parsedate_to_datetime`,
sorts desc, returns top 25. Schema: `NewsArticleResponse`. The feed list is duplicated across the
two handlers.

Top-level imports presently only `main.py` needs (`urllib.request`, `xml.etree.ElementTree as ET`,
`email.utils`, `base64`) move out with the news service.

---

## Goal

```python
# routers/news.py — thin
@router.get("/api/v1/news", response_model=list[NewsArticleResponse])
def get_news_articles():
    return news_service.latest_articles(limit=25)

# services/news.py — the RSS subsystem, testable without the network
NEWS_FEEDS = (...)                       # single source of truth (was duplicated)
def latest_articles(limit, *, fetch=_default_fetch): ...
def get_article(article_id, *, fetch=_default_fetch): ...
```

## Tasks

### 1. Schema modules

`schemas/storage.py` (the five storage models) and `schemas/news.py` (`NewsArticleResponse`) —
move verbatim.

### 2. News service (`services/news.py` or `market_data/news.py`)

Lift the RSS logic into one module: a **single** `NEWS_FEEDS` constant (de-duplicate the two
copies), `latest_articles(limit)` and `get_article(article_id)`, with the HTTP fetch behind a small
injectable seam (default uses `urllib` + 3s timeout) so tests can supply canned feed XML — **no
real network in tests**. Keep article-id base64 scheme, date parsing, sort, and the 25-item cap
identical. Per-feed failures stay isolated and logged (current behavior).

### 3. Routers

`routers/storage.py` (`tags=["storage"]`) delegating to `storage_jobs`; `routers/news.py`
(`tags=["news"]`) delegating to the news service. Exact original paths.

### 4. Wire + delete — and finish the assembly

Add the two `include_router` lines; remove the migrated routes/schemas/helpers **and the now-unused
`urllib`/`ET`/`email.utils`/`base64` imports** from `main.py`. Verify `main.py` now contains only:
imports, `app = FastAPI(lifespan=...)`, CORS, and the `include_router` block (target ~50 lines).

## Guardrails

> **Zero API change.** Same paths/methods/status/models; OpenAPI paths for storage + news
> unchanged.

> **No network in tests.** The news fetch is injectable; tests pass canned RSS XML. Never hit the
> live feeds in CI.

> **Behavior verbatim.** Feed list, base64 ids, date parsing, desc sort, 25-cap, isolated per-feed
> error handling — all identical. De-duplicating `NEWS_FEEDS` must not change which feeds are used.

> **Storage job layer frozen.** `storage_jobs.py` unedited; router delegates as before.

> **`main.py` is now assembly-only.** After this WO it defines no `@app.<verb>` business route
> except possibly `/` if WO56 kept it there (prefer it in `routers/system.py`). A test asserts the
> full pre-split route inventory is present across all routers.

## Tests — `tests/api/test_storage_router.py`, `tests/api/test_news_service.py`

- Storage routes exist with original paths+methods; delegation to `storage_jobs` intact (port
  existing storage tests).
- News service: with canned feed XML, `latest_articles` returns parsed/sorted/capped items and
  stable base64 ids; `get_article` round-trips an id; a failing feed is skipped, not fatal.
- **Full route-inventory test (capstone):** assert every path+method from the original `main.py`
  (all domains) is registered on `app` — proves the whole decomposition is complete and lossless.
- Full suite green and unmodified.

## Docs

`q_backend/README.md` API-layout section: storage + news router modules; news RSS logic now a
service with an injectable fetch seam. Note `main.py` is assembly-only.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `main.py` is assembly-only (~50 lines); storage + news served from their routers; news RSS in a
  testable service; stray stdlib imports removed.
- Paste the final `main.py` in full, plus the news service public surface and the capstone
  route-inventory assertion.

## Out of scope

- Other domains (WO56–59). Editing `storage_jobs.py`. Changing feeds, auth, or any contract.
- A real news cache/provider abstraction beyond the injectable fetch seam (future work).
