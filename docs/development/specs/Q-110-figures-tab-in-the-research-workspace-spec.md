# Q-110: Figures tab in the Research workspace

**Status:** written spec awaiting human review; the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2) is the status of record.
**Batch:** 22 — Research figures
**Depends on:** Q-109
**Implementation plan:** [Plan](../plans/Q-110-figures-tab-in-the-research-workspace-plan.md)

## Purpose

Q-109 lets a research script send Matplotlib and Plotly figures to the Research stack. This task shows them: a **Figures** tab, first in the Research workspace and the one it opens on, where a figure appears within seconds of the script publishing it.

## Behaviour

### Tab and routing

- `figures` is the first entry of the Research tab bar, labelled **Figures**. `/research` with no `tab`, or an unknown one, opens it. The other six tabs keep their order and behaviour.
- The open figure is URL state (`?tab=figures&figure=<id>`), so the viewer survives a reload. An id that no longer exists closes the viewer with a short notice.
- The workspace description mentions figures.

### Layout

- **Collections rail:** **All figures** and one entry per collection with its count and last update, most recently updated first. **Delete collection** asks for confirmation and uses bulk delete.
- **Figure grid:** cards for the selected collection, newest update first, one to three columns by width. A card shows the preview, title, collection (under **All figures**), relative update time and an **Image** or **Interactive** badge. A title filter narrows the loaded cards. **Load more** pages past the first 100.
- **Viewer:** the figure at the largest size the workspace allows, with title, notes, created and updated times and provenance (script path, git revision, a marker when the tree was dirty). Left/Right move through the current list, Escape closes. Actions: fullscreen, download and delete with confirmation.

### Rendering

- **Images** (PNG, SVG) are `<img>` elements pointing at the content route with the revision in the URL. SVG markup is never injected into the document. Cards reserve the figure's aspect ratio from `width` and `height`, so nothing shifts when the image loads. In the viewer an image fits the available area; clicking toggles actual size with scrolling.
- **Plotly** figures are drawn as authored, with their own template and colours. `plotly.js-dist-min` loads as a separate chunk the first time a Plotly figure is on screen. A card mounts a non-interactive (`staticPlot`) plot when it scrolls into view and purges it when it leaves. The viewer plot is interactive, resizes with its container and hides the Plotly logo. Download exports a PNG.
- Figures are shown on a neutral backing so a light figure is not clipped into the dark surface.

### Freshness

- The list is polled every 2 seconds while the tab is mounted and the window is visible, and not otherwise.
- A figure that arrives or changes revision while the tab is open is marked **New** or **Updated** until it is opened or the tab is left. A replaced figure reloads its content, also when it is open in the viewer. The highlight does not animate under reduced motion.

### States

- Loading skeletons; an API error with **Retry**; a per-card message when content is missing (`404`).
- With no figures, the tab explains the feature and shows the three-line script snippet (`from q_backend import research`, build a figure, `research.publish_figure(fig, title=...)`).

## Interfaces

- Vendor the published Q-109 contracts through `CONTRACTS_REV` and `make contracts`; `make contracts-check` must be clean.
- `ResearchTab` gains `figures`; a new query module holds the list, metadata, delete and bulk-delete calls and the content URL builder.
- MSW handlers and fixtures cover every route with a PNG, an SVG and a Plotly figure in two collections, plus a missing-content case.
- Use the shared Panel, Dialog, SegmentedToggle, confirm dialog and typography tokens; no new visual primitives where one exists.

## Focused acceptance

1. `/research` and an unknown `tab` render the Figures tab; it is first in the tab bar; every other tab still opens by its value.
2. The grid renders PNG, SVG and Plotly cards from the list; selecting a collection sends `collection` and updates the grid; counts come from `collections`.
3. An image card requests the content URL with its revision and reserves its aspect ratio; no SVG markup is injected.
4. The Plotly chunk is not requested when no Plotly figure is on screen; a card plot is static, the viewer plot is interactive, and leaving purges the plot.
5. A figure added to a later poll shows **New**; a higher revision shows **Updated** and changes the content URL; polling stops while the document is hidden.
6. The viewer opens from a card and from `?figure=`, shows notes and provenance, moves with the arrow keys and closes with Escape; an unknown id closes with the notice.
7. Delete and Delete collection confirm, call the right route and refresh the list.
8. Empty, loading, error-with-retry and missing-content states render as specified.
9. `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `make contracts-check` pass.

Verification uses component tests and MSW, and a browser check of the MSW web preview at desktop and narrow widths. No backend, Tauri, Docker or GPU run is required by automated checks. One manual step follows merge: run the Q-109 example script against `./dev research` with the tab open.

## Delivery boundary

- No editing of titles or notes in the desktop, no figure comparison, no export other than download.
- No stream topic; freshness is the poll.
- No change to the other Research tabs or to `q_terminal`.
