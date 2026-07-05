# WO197 — Frontend: overlay system (Dialog / Popover / Menu / Tooltip / Toast primitives)

## Shared context (read first)

Fifth of the **WO193–WO199 premium-polish batch**; runs after 🔍 Checkpoint A (WO193–195
foundations). **May run in parallel with WO196 and WO198** — work on its own branch; the
only shared files are `/dev/ui`, `ui/index.ts`, and the design doc (append-only; merge in
numeric order). 🔍 Checkpoint B reviews the whole 196–198 lane together. The
transient layer — modals, popovers, menus, tooltips, notifications — is the thinnest part of
the design system: `ui/` contains only `confirm-dialog.tsx`, and pages hand-roll the rest
(`IndicatorsModal`, `IndicatorsPopover`, `ChartSettingsPopover` in `src/components/charts/`).
There is **no toast/notification system at all**. Overlays are where premium apps
differentiate hardest (perfect enter/exit motion, correct focus handling, consistent
materials), and ours are currently the least consistent layer.

This WO builds the overlay primitives on Radix behavior + our materials (+2 elevation) +
WO194 motion presets, then migrates the existing ad-hoc overlays.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest + Testing
Library. Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/components/ui/confirm-dialog.tsx` — the one existing overlay primitive; inspect how
  it portals/animates today; it will be rebuilt on the new `Dialog`.
- `src/components/charts/IndicatorsModal.tsx`, `IndicatorsPopover.tsx`,
  `ChartSettingsPopover.tsx` — the hand-rolled overlays to migrate.
- `src/styles/materials.css` — `surface-overlay`, `surface-overlay--hud`,
  `surface-overlay-scrim`, `surface-float`, `surface-float--blur` (+2 recipes; retouch on
  the WO195 vocabulary, keep the roles).
- `src/lib/motion/presets.ts` (from WO194) — `overlayEnter` / `overlayExit`,
  `useReducedMotion`.
- `package.json` — only `@radix-ui/react-slot` is present today; this WO adds the overlay
  primitives (see Guardrails for the sanctioned list).
- Search for current ad-hoc notification/error surfacing (inline `Callout`s, transient
  banners): `grep -rn "Callout" src/components | grep -v ui/` — inline callouts stay;
  the toast system is for _transient_ confirmations/failures that currently vanish into
  nothing (e.g. save confirmations, background-task completions).

## Goal

```tsx
// One overlay family, one material, one motion language:
<Dialog>…</Dialog>            // modal work: confirm, indicator config
<Popover>…</Popover>          // anchored panels: settings, filters
<Menu items={…} />            // context/dropdown actions
<Tooltip content="Sharpe, annualized">…</Tooltip>
toast.success('Strategy saved') // transient, top-right, self-dismissing
```

Every transient surface in the app enters, sits, and exits identically — +2 glass-over-
darkness with machined edges — and keyboard/focus behavior is flawless because Radix owns it.

## Tasks

1. **Dependencies.** Add exactly: `@radix-ui/react-dialog`, `@radix-ui/react-popover`,
   `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`. (Toast is built in-house —
   Task 6 — to keep the dependency small and the stacking/motion fully ours.)
2. **`ui/Dialog.tsx`.** Radix Dialog + `surface-overlay` material; scrim uses
   `surface-overlay-scrim` plus a `backdrop-filter: blur(2px)` darkening so the workspace
   recedes physically; enter/exit via `overlayEnter`/`overlayExit` presets (Radix
   `forceMount` + `motion` `AnimatePresence`); sizes `sm/md/lg`; a `DialogHeader` matching
   `PanelHeader` typography. Rebuild `ConfirmDialog` on it, preserving its exported API and
   testids exactly.
3. **`ui/Popover.tsx`.** Radix Popover + `surface-float` material, 8px collision padding,
   arrow-less (clean edge, premium apps don't draw arrows), origin-aware scale-in from the
   anchor side (Radix exposes `data-side`; wire transform-origin accordingly).
4. **`ui/Menu.tsx`.** Radix DropdownMenu; items with optional icon/shortcut/destructive
   tone; item hover = luminance lift (consistent with WO196 rows); separators as low-
   luminance hairlines; submenu support.
5. **`ui/Tooltip.tsx`.** Radix Tooltip with a global `TooltipProvider` (delay 350ms,
   skip-delay 100ms); `surface-float` at reduced padding; **text only, max-width 280px** —
   tooltips are for labels/definitions, not interactive content; instant-out
   (`--motion-fast` exit).
6. **`ui/toast.tsx` (in-house).** A small store (module-level, no new state lib) + `toast`
   API (`success/error/info(message, { description? })`) + a `<Toaster />` mounted once in
   the app shell. Visual: `surface-overlay` cards, top-right stack, max 3 visible (older
   collapse), auto-dismiss 5s (errors 8s, hover pauses), enter = `fadeRise`, exit =
   `overlayExit`; tier-3 gold left-edge for success, existing negative tone for errors.
   Fully reduced-motion aware. Wire the obvious first consumers: strategy save/duplicate
   confirmations and background task completion/failure notifications where the app
   currently gives no feedback — **only** where feedback is currently missing; do not
   convert existing inline `Callout` error surfaces.
7. **Migrate the ad-hoc overlays**: `IndicatorsModal` → `Dialog`, `IndicatorsPopover` and
   `ChartSettingsPopover` → `Popover`. Behavior-preserving (same trigger elements, same
   content, same testids).
8. **Materials retouch.** Re-tune `surface-overlay`/`surface-float` on the WO195 vocabulary:
   luminance edges (not warm-tint borders), a crisper top lip, and shadow depth that
   separates +2 clearly from the frosted 0-level panels behind it. Values as custom
   properties.
9. **Gallery**: overlay section in `/dev/ui` — all five primitives, all states.

## Guardrails

> **Dependency ceiling**: exactly the four Radix packages in Task 1, nothing else (no
> sonner, no react-hot-toast, no floating-ui direct dep — Radix brings its own).
> **Radix owns behavior, we own pixels**: no re-implementing focus traps, dismiss logic, or
> positioning; no `!important` fights with Radix data-attributes — style via the documented
> attribute hooks.
> **One motion language**: every overlay uses the WO194 presets; no bespoke keyframes.
> Exits are **always faster than entrances**.
> **Toast discipline**: transient feedback only — never errors that require action (those
> stay inline per existing patterns); max 3 visible; no persistent toasts.
> **Migrations are behavior-preserving** — same triggers, contents, testids; chart settings
> state management untouched.
> **Accessibility**: Tooltip content must also be reachable for keyboard users (Radix
> handles focus-trigger display — verify, don't assume); dialogs restore focus on close.

## Tests

- `src/components/ui/__tests__/Dialog.test.tsx`: open/close, focus trap + restore, Escape
  and scrim-click dismiss, `ConfirmDialog` API unchanged.
- `__tests__/Menu.test.tsx`: keyboard navigation, destructive tone, submenu.
- `__tests__/toast.test.tsx`: stacking cap at 3, auto-dismiss timing (fake timers), hover
  pause, error duration, reduced-motion static rendering.
- `__tests__/Tooltip.test.tsx`: delayed show, instant hide, provider delay-skip.
- Migrated chart overlay suites (if any exist) stay green; if none exist, add smoke tests
  that each migrated overlay opens and renders its content.

## Docs

Extend `docs/design/visual-design-system.md`: overlay layer section — the five primitives,
+2 material recipes, motion contract (enter slow-ish, exit fast), and the toast-vs-inline
feedback decision rule.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the exact dependency additions with versions, the toast API as shipped, the
list of migrated overlays with preserved testids, and where `<Toaster />` +
`TooltipProvider` mount. Production trigger: `Toaster`/`TooltipProvider` mount in the app
shell (name the file) — they must be wired there in this WO, not left for consumers.

## Out of scope

Command palette (future candidate, not this batch); Select/Combobox rebuild (native selects
keep their WO116 well styling for now — note as a follow-up if they look out of place at
Checkpoint review); notification center/history; converting existing inline error Callouts;
chart tooltip styling (WO198 — chart tooltips are SVG-adjacent, not DOM overlays).
