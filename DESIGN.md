# Q Research design context

## North Star

A precise desktop research workspace: readable quantitative data, clear editing
boundaries, and a restrained carbon/brass visual identity. Existing screens and
shared controls determine the visual language; feature work refines that language.

## Register

Product tool for quantitative research. Favor clear labels, consistent controls,
real data, and compact but readable density. Avoid marketing layouts, decorative
animation, and visual treatments that obscure chart meaning.

## Canonical sources and token ownership

[`docs/design/visual-design-system.md`](docs/design/visual-design-system.md) is the
maintained source for surface elevation, accent hierarchy, component ownership,
and workflow-specific conventions. This file indexes that system; it does not
introduce a second token source.

Runtime colors and typography are owned by `src/styles/globals.css` (`@theme`).
Surface materials are implemented in `src/styles/materials.css`. Shared components
under `src/components/ui` consume those classes and tokens. Change the maintained
system documentation alongside any durable runtime token change.

## Visual language

- Carbon and graphite surfaces, smoked silver text, brass/gold for meaningful
  selection, focus, and primary actions. Semantic chart colors retain their meaning.
- Inter Display for prominent headings, Inter Variable for labels and prose,
  and the existing monospace stack for numeric data and calculations.
- Raised surfaces gain depth through edge light and shadow; nested content stays
  quiet. Dialogs use the shared overlay material and do not gain pointer glow.

## Behavior and accessibility

Reuse the shared Radix-backed dialogs, buttons, field wrappers, and numeric
inputs. Keep keyboard focus visible, describe errors in text, associate field help,
restore trigger focus, and respect reduced motion. Search clearing is immediate.
Layouts must preserve reachable actions in narrow and short desktop windows.

## Indicator workbench

See the **Indicator workbench** section in the maintained design-system document
for catalog/detail scrolling, staged edits, parameter-select ownership, guides,
preview states, and verification. Documentation is editorial frontend content;
API metadata remains authoritative for calculation inputs and output structure.

## Anti-references

Avoid low-contrast microcopy for essential explanations, raw implementation keys
in normal configuration flows, nested interactive controls, decorative fabricated
chart data, and unrelated design-system migrations for a single feature.
