# ADR-0002: Canonical QuoteSync Design System

- Status: Accepted
- Date: 2026-08-08
- Scope: Live QuoteSync application chrome

## Decision

QuoteSync has one application design system. Its canonical sources are:

- `src/theme/themes.ts` for structured Ecofenster defaults, named-theme resolution, persistence normalization, and runtime token application;
- `src/styles/tokens.css` for safe startup values and canonical `--qs-*` design tokens;
- `src/styles/base.css` for application-wide baseline element behavior;
- `src/styles/ui.css` for shared visual primitives;
- feature stylesheets only for feature-specific structure, consuming canonical tokens.

Project Costing, especially Dark mode, is the quality reference for layered charcoal surfaces, polished commercial density, tables, controls, typography, monetary hierarchy, and green commercial emphasis. The Operational Dashboard is the reference for semantic tinted cards, KPI hierarchy, restrained depth, and distinct attention, installation, finance, success, and pipeline colours. New screens must feel like the same application without copying either feature's specialised layout.

## Theme ownership and precedence

The built-in **Ecofenster Default** theme is immutable and always recoverable. A company may create named custom themes and select its active/default theme. Administration → Branding is the sole administrative owner of theme colours, typography, component appearance, and company theme selection.

User Light/Dark/System preference is separate from company configuration and must never mutate the company theme. Resolution is:

1. explicit user display preference;
2. selected company theme and its default mode;
3. immutable Ecofenster defaults.

The selected Google Font is company/theme configurable, loaded once with a safe system fallback, and applied through `--qs-font-family`.

## Mandatory styling rule

Normal live application UI must not use:

- inline CSS, React `style` props, or component-local visual `CSSProperties` objects;
- hard-coded application colours or feature-owned Light/Dark palettes;
- CSS-in-JS, dynamically injected application styles, or runtime-generated stylesheet strings;
- independent visual systems or unresolved compatibility theme aliases.

Normal application appearance must use canonical `--qs-*` tokens, shared stylesheet/component primitives, and feature CSS using canonical tokens where specialised structure is necessary. If an existing token or primitive is insufficient, extend the shared design system instead of introducing a local workaround. Temporary production inline styling is not permitted.

Every new component, feature, workspace, dialog, Admin page, calculator, configurator shell, or workflow must inspect and reuse the shared primitives first, must not create its own theme, and must pass `npm run check:design-system` before completion.

## Shared visual language

The canonical system owns:

- a layered page → surface → elevated/card → control hierarchy in both Light and Dark modes;
- standard borders, focus rings, radii, elevation, spacing, restrained motion, and typography roles;
- buttons, icon buttons, inputs, selects, textareas, tabs, segmented controls, tables, list rows, cards, KPI/stat cards, semantic attention cards, badges, statuses, dialogs, scrims, empty states, navigation, toolbars, action rows, and property/form sections;
- visible `focus-visible` states, readable disabled states, short hover/selection transitions, and reduced-motion behavior;
- distinct semantic treatments for success, warning, error/attention, information, quotes/follow-up, installation/schedule, finance/invoices, pipeline stages, and commercial selling values.

Dark mode consistency is paramount: near-black page background, layered charcoal surfaces, restrained borders/elevation, high-contrast text, Ecofenster green actions, and meaningful semantic colour. Light mode uses the same hierarchy through deliberately differentiated light surfaces rather than nested undifferentiated white panels.

## Explicit separate domains

The following are data/rendering domains rather than application-theme styling:

- product, RAL, material, glazing, finish, and manufacturer colours;
- technical SVG/canvas geometry and render data;
- technical drawing/proof colours required for legibility;
- map coordinates and technical geometry/data;
- generated print/document-output CSS.

Application chrome surrounding those domains still follows this ADR. These exceptions must remain explicit in compliance tooling and must not become a route for ordinary UI styling.

## Enforcement

`scripts/check-design-system-compliance.mjs` is the focused source gate. It rejects prohibited inline styling, unauthorized application colours, legacy theme variables/aliases, and statically detectable feature-owned theme implementations while explicitly separating authoritative theme files, technical/product render data, and generated document output.

This gate is part of focused validation for every future visual/UI task and of the standard checkpoint protocol.
