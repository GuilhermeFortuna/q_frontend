# Q-122: Market chart crosshair and drawing tools

**Status:** written spec awaiting human review; the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2) is the status of record.
**Batch:** 29 — Market chart drawing
**Depends on:** the Chart Ruler (`feat/chart-ruler`, not a board task) reaching `development`
**Implementation plan:** [Plan](../plans/Q-122-market-chart-crosshair-and-drawing-tools-plan.md)

## Purpose

The Market page chart is where the user reads price action, but its crosshair and drawings cannot be trusted:

- The crosshair price label shows the hovered bar's **close**, not the price under the pointer, and always with two decimals (`CrosshairLayer` renders `activeBar.close.toFixed(2)`). The crosshair disappears while a drawing tool is armed, exactly when a precise price matters.
- A drawing cannot be selected, moved, edited or deleted once placed; **Clear all** is the only removal and it asks nothing.
- Drawings are stored per symbol **and timeframe** (`quant:drawings:<symbol>:<timeframe>`), so a line drawn on M10 is missing on H1. Anchors are bar timestamps: an anchor that is not a loaded bar snaps to the nearest later bar, or to the first loaded bar, so lines jump when history loads or the timeframe changes. Drawings are not clipped and bleed over the axes and oscillator panes.
- There are four tools (trend line, horizontal line, Fibonacci retracement, text), and text uses `window.prompt`.

After this task the crosshair reads the exact price at the pointer in the instrument's precision, and drawings are durable, symbol-scoped objects that can be selected, dragged, styled, undone and deleted, with a broader tool set.

## Behaviour

### Price precision

- The chart receives the instrument's `digits` and `tickSize` from instrument info (`useInstrumentInfo`), falling back to the snapshot's `digits`, and for `LOCAL` symbols to the largest number of decimals among the loaded closes (capped at 6). This precision formats the crosshair, the price axis ticks, the OHLC HUD, the last-price label, drawing labels and the ruler.

### Crosshair

- The price label on the price axis shows `priceScale.invert(pointerY)` at the pointer, formatted with the precision above. Its box is sized to its text and clamped inside the price pane.
- The vertical line spans the price pane, the volume band and every oscillator pane. The horizontal line and the axis label appear only in the pane under the pointer; oscillator panes keep their existing `OscillatorHoverLayer` readout.
- The crosshair stays visible while a drawing tool is armed and while the ruler is active.
- With **Magnet** on (rail toggle), the crosshair price and drawing anchors snap to the nearest open, high, low or close of the hovered bar when it is within 10 px; otherwise anchors snap to the instrument's tick size.

### Last price

- A dashed line at the latest bar's close crosses the price pane, with an axis label coloured by the latest bar's direction. It stays pinned to the axis edge, with an arrow, when the close is outside the visible price range.

### Drawing model and persistence

- An anchor is `{ time, price }`, where `time` is the epoch milliseconds of the instant it marks, not a bar key.
- Drawings belong to a **symbol** and are shown on every timeframe of that symbol. Switching symbol or timeframe, reloading the app or restarting it brings them back unchanged.
- Storage is one versioned local-storage entry per symbol (`quant:drawings:v2:<symbol>`, `{ version: 2, drawings: [...] }`). On first read, legacy `quant:drawings:<symbol>:<timeframe>` entries are converted (bar timestamps to epoch milliseconds), merged by id, written in v2 form and removed. An entry that fails validation is dropped and reported once in the chart notice; it never breaks the chart. A failed write (quota or unavailable storage) keeps the in-memory drawings and shows a notice.
- Every drawing carries an id, a tool type, its anchors, a style (`color`, `width` 1–4, `lineStyle` solid, dashed or dotted), `locked`, `hidden`, and tool-specific options listed below.

### Rendering

- Anchor time maps to x by bar position, not wall time, so session gaps do not distort lines: inside the loaded bars an anchor sits in the bar that contains it, interpolated by its offset within the bar's duration; on a finer timeframe it sits at the bar that opens at its time. Before the first or after the last loaded bar it extrapolates by the timeframe's nominal bar duration, including into the right-hand future padding. This function is shared by drawings and the ruler.
- A drawing with anchors off-screen still renders its visible part; all drawings are clipped to the price pane.
- Hidden drawings are not rendered; **Hide all** in the rail hides every drawing of the symbol without changing their own `hidden` flag.

### Interaction

- **Hover:** with the cursor tool, the pointer within 6 px of a drawing's line, edge, fill or label highlights it and shows a move cursor; over an anchor handle, a resize cursor.
- **Select:** a click on a drawing selects it and shows its anchor handles; a click on empty chart deselects. Pressing on a drawing never starts a pan; pressing on empty chart pans as today.
- **Move and reshape:** dragging a selected drawing moves all anchors by the same bar offset and price delta; dragging a handle moves that anchor. Shift constrains a trend line or channel edge to horizontal. Locked drawings select and show their toolbar but do not move. A drag commits on release; Escape during a drag restores the drawing.
- **Place:** each tool places its anchors by successive clicks or one press-drag-release (two-anchor tools). The draft follows the pointer; Escape cancels it. After placing, the tool returns to the cursor and the new drawing is selected, unless **Keep drawing** is on in the rail.
- **Toolbar:** a selected drawing shows a small floating toolbar beside it: colour swatches, width, line style, tool options, lock, hide, and delete. It stays inside the chart and never covers the drawing's handles.
- **Keyboard** (chart focused): Delete or Backspace removes the selection; Ctrl+Z undoes and Ctrl+Shift+Z or Ctrl+Y redoes creation, moves, edits and deletions for the current symbol (at least 50 steps per symbol, kept for the session); Escape cancels a draft or drag, then clears the selection.
- **Ruler:** the ruler's Ctrl toggle fires only when Ctrl is pressed and released with no other key, so Ctrl+Z and Ctrl+Y do not switch modes. In ruler mode drawings are not hit-tested.
- **Clear all** removes every drawing of the current symbol after a confirmation in the app's confirm dialog, and can be undone.

### Tools

The rail groups tools into flyouts; each group button shows the group's last-used tool.

| Group | Tool | Anchors | Options and labels |
|---|---|---|---|
| Lines | Trend line | 2 | extend left, extend right; optional angle and price-change label |
| Lines | Horizontal line | 1 | price label on the axis |
| Lines | Horizontal ray | 1 | extends right from its anchor; price label on the axis |
| Lines | Vertical line | 1 | time label on the time axis; spans all panes |
| Shapes | Parallel channel | 3 | the third anchor sets the parallel offset; optional middle line; fill |
| Shapes | Rectangle | 2 | fill colour with opacity |
| Fibonacci | Retracement | 2 | levels 0, 23.6, 38.2, 50, 61.8, 78.6, 100 % each with its price; levels can be toggled; extend right |
| Fibonacci | Trend-based extension | 3 | levels 0, 61.8, 100, 161.8, 261.8 % projected from the third anchor, each with its price |
| Positions | Long position, Short position | 3 (entry, stop, target) | profit and risk zones; labels with price, distance in ticks and percent, and reward-to-risk ratio |
| Text | Text note | 1 | edited inline (Enter commits, Shift+Enter breaks a line, Escape cancels; empty text deletes); double-click edits again |

`window.prompt` is no longer used on the Market page drawing path.

## Interfaces

- Drawing geometry, the tool registry (anchor count, render, hit test, handles, default options), storage and migration live in `src/components/charts/drawings/`, independent of React where possible.
- `DrawingTool` and `DrawingObject` in `src/components/charts/types/chart.ts` are replaced by the registry's types; `useDrawings` keeps its role and gains selection, update, delete and undo/redo.
- `CandlestickChart` and `ChartPanel` gain `priceFormat` (`digits`, `tickSize`) and selection props; `DrawingRail` gains the flyouts and the Magnet, Keep drawing and Hide all toggles.
- Reuse the shared `confirm-dialog`, `Popover` and `Menu` primitives. No backend, contract or `q_terminal` change.

## Focused acceptance

1. The crosshair price label equals `priceScale.invert(pointerY)` formatted with the instrument's digits (tested at 0, 2 and 5 digits), not the bar close; it stays visible with a drawing tool armed; its vertical line spans every pane.
2. Price axis ticks, HUD, last-price label and ruler labels use the instrument precision; `LOCAL` symbols infer it from the bars.
3. Magnet snaps an anchor to the nearest OHLC value within 10 px and to the tick size otherwise.
4. A drawing placed on one timeframe renders at the same instant and price on a coarser and a finer timeframe, persists across a symbol switch and a remount, and an anchor outside the loaded bars extrapolates instead of snapping to the first or last bar.
5. Legacy per-timeframe entries migrate into one v2 entry per symbol and are removed; malformed entries are dropped with a notice; a throwing `localStorage.setItem` keeps drawings in memory with a notice.
6. Hit testing selects lines within 6 px, rectangles and channels by edge or fill, and handles before bodies; pressing on a drawing does not pan.
7. Dragging moves a drawing; dragging a handle reshapes it; Shift constrains; locked drawings do not move; Escape during a drag restores it.
8. Delete removes the selection; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo create, move, style, delete and clear; Ctrl+Z does not toggle the ruler.
9. Each tool in the table places with its anchor count, renders its labels and options, and round-trips through storage; text edits inline without `window.prompt`.
10. Drawings are clipped to the price pane; hidden drawings and Hide all render nothing; Clear all asks for confirmation.
11. `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build` pass.

Verification uses unit tests for geometry, hit testing, migration and undo, component tests on `CandlestickChart` with pointer and keyboard events, and a browser check of the MSW web preview. No backend, Tauri, Docker or GPU run is required.

## Delivery boundary

- No backend-synced drawings, drawing templates, per-timeframe visibility, or alerts from drawings.
- No logarithmic or percentage price scale, session separators, chart screenshot export or multi-chart crosshair sync; these are follow-up candidates.
- No change to the Backtests trade chart (`LiveStrategyChart`) or to `q_terminal`.
