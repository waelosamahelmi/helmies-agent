# Helmies Agent Rebrand Design

## Objective

Rebrand the LibreChat-based Agent surface as a native part of Helmies Studio. The finished product must feel like another Studio workspace rather than a separately branded application while preserving LibreChat's existing chat, agent, authentication, file, settings, and conversation behavior.

The approved direction is **Studio continuity**: dark-only, compact, editorial, and visually aligned with the existing Helmies Studio rail and workspace.

## Scope

The rebrand covers:

- canonical Helmies logos, favicons, PWA icons, and browser metadata;
- Nohemi typography and the Helmies color system;
- global dark-theme tokens and component states;
- loading and startup screens;
- login, registration, password recovery, and social authentication;
- primary navigation, conversation history, headers, menus, settings, and About;
- empty conversation, active conversation, message actions, composer, tools, and model selection;
- dialogs, toasts, validation, disabled states, errors, and skeleton/loading states;
- responsive desktop, tablet, and mobile behavior;
- continued hosting beneath the `/agent/` proxy prefix.

The rebrand does not change database schemas, API contracts, model behavior, authentication mechanics, message persistence, or credit accounting.

## Brand system

### Identity

- Product name: **Helmies Agent**.
- Parent product: **Helmies Studio**.
- Use the canonical Helmies `ico.svg` as the primary product mark.
- Use the existing Helmies favicon and touch-icon family for browser and PWA surfaces.
- User-visible LibreChat naming is removed. Technical package namespaces remain `@librechat` because they are dependency identifiers, not brand copy.

### Typography

- Use the existing Nohemi font family from Helmies Studio.
- Display headings use Nohemi SemiBold or Bold with tight tracking and compact line height.
- Interface text uses Nohemi Regular or Medium.
- Small labels use Medium or SemiBold with restrained positive tracking.
- Numeric credit and usage values use tabular figures.

### Color tokens

The interface is permanently dark.

- Canvas: `#0A0A0F`
- Deep navigation: `#0C0C12`
- Sidebar: `#0D0D13`
- Primary surface: `#13131A`
- Raised/input surface: `#15151D`
- Active surface: `#1B1B23`
- Subtle border: `#24242D`
- Strong border: `#32323D`
- Primary text: `#F2F2F7`
- Secondary text: `#A2A2AC`
- Muted text: `#777782`
- Disabled text: `#50505A`
- Brand accent: `#FF1B6B`
- Brand hover: `#FF3B7D`
- Brand pressed: `#E61660`

Pink is reserved for primary actions, active navigation, focus, attribution, progress, and selected states. Semantic warning, destructive, and success colors may remain distinct where meaning would otherwise be lost, but they must be muted to harmonize with the dark neutral palette.

### Surfaces and motion

- Use rounded-square controls rather than pills by default.
- Inner controls use 7–10 px radii; composers and major containers use 13–16 px radii.
- Shadows are subtle and tinted to the canvas rather than generic black.
- Apply a very low-opacity grain texture to the app canvas.
- Hover and focus transitions use 200–300 ms durations.
- Pressed controls move or scale by no more than 1–2 px.
- Respect `prefers-reduced-motion`.

## Layout

### Desktop workspace

The approved desktop hierarchy has three columns:

1. A 64 px product rail containing the Helmies mark, primary Agent action, secondary workspace actions, and user access.
2. A 252 px conversation sidebar containing the product name, new-conversation action, grouped history, credits, and settings.
3. A flexible conversation canvas containing the workspace header, messages or empty state, and anchored composer.

The rail and conversation sidebar use slightly different off-black values to preserve hierarchy without heavy shadows.

### Workspace header

- Display the current conversation or `Orchestrator` context.
- Show the active model in a compact badge.
- Keep share and overflow actions on the right.
- Avoid a large marketing-style header inside the working canvas.

### Mobile workspace

- Replace the persistent rail and sidebar with a compact 50 px header.
- Open conversation history and navigation in a drawer.
- Keep credit status visible in the header.
- Anchor the composer at the bottom with safe-area spacing.
- Suggested tasks become a vertical list.

## Core states

### Empty conversation

The main message is `What are we making today?`, attributed to the Orchestrator. Supporting copy explains that users can plan, research, generate media, or coordinate a workflow.

Three concise starting actions are shown:

- Build a campaign
- Create a film
- Research a market

These actions use quiet bordered surfaces and numbered pink labels. They must populate or submit a useful starter prompt rather than act as decorative cards.

### Active conversation

- User messages use a restrained raised surface with asymmetric corner treatment.
- Agent responses remain mostly flat against the canvas for readable long-form content.
- Agent attribution uses the Helmies mark and pink label.
- Structured outputs may use a pink left rule rather than generic bordered cards.
- Copy, save, feedback, and regenerate actions remain low contrast until hover or focus.
- Markdown, code, artifacts, citations, tools, and attachments keep their existing behavior.

### Composer

- Use a raised `#15151D` surface with a strong neutral border.
- Keep attachment and tool controls on the lower left.
- Place model/context controls beside the tools where space permits.
- Use a rounded-square pink send button.
- Preserve all existing keyboard, voice, attachment, stop-generation, and accessibility behavior.

### Authentication

- Use a full dark Helmies canvas rather than a white card.
- Show the Helmies mark and `Helmies Agent` in the upper left.
- Provide a `Back to Studio` link.
- Keep the form narrow, left-aligned, and vertically centered.
- Primary authentication uses the pink action; social sign-in uses a neutral bordered action.
- Registration, recovery, verification, and errors share the same layout.

### Loading and errors

- Startup loading uses the Helmies mark with a restrained pink progress treatment.
- Replace generic spinners with component-shaped skeletons where practical.
- Inline validation uses direct language and maintains accessible associations.
- Fatal errors provide a retry action and a route back to Studio.
- Toasts use dark raised surfaces with a narrow semantic indicator.

## Component boundaries

Implementation is divided into four reviewable layers:

1. **Brand assets** — copy canonical logo, font, favicon, and PWA files from Helmies Studio.
2. **Theme tokens** — centralize colors, typography, focus, selection, disabled, and semantic states in LibreChat's existing theme and CSS layers.
3. **Brand surfaces** — update components whose structure or copy cannot be corrected through tokens alone, especially authentication, loading, empty chat, navigation, About, and metadata.
4. **Subpath integration** — preserve `<base href="/agent/">` and verify client routes and API requests through the Next.js rewrite.

Existing LibreChat components and state management remain in place. No framework migration or parallel design system is introduced.

## Accessibility

- Maintain WCAG AA contrast for text and controls.
- Use visible pink or neutral focus rings on every interactive element.
- Do not rely on color alone for status or selection.
- Preserve semantic labels, keyboard navigation, screen-reader announcements, and skip navigation.
- Keep touch targets at least 44 px on mobile.
- Respect reduced-motion and high-contrast preferences where supported.

## Responsive behavior

- Desktop: three-column rail/sidebar/canvas layout.
- Tablet: rail remains; conversation sidebar becomes collapsible.
- Mobile: both side regions become a drawer opened from the compact header.
- Composer content wraps without covering send or stop controls.
- Dialogs become bottom sheets or near-full-width panels where existing component behavior supports it.

## Verification

Implementation is complete only when all of the following pass:

- namespace regression check reports no invalid Helmies technical package identifiers;
- production LibreChat client and API image builds successfully;
- existing targeted authentication, navigation, and conversation component tests pass;
- direct LibreChat root returns HTTP 200;
- Helmies `/agent` returns HTTP 200 and includes `<base href="/agent/">`;
- generated JavaScript and CSS assets resolve beneath `/agent/assets/`;
- `/agent/api/config` and authenticated conversation API calls resolve through the proxy;
- the browser console has no new runtime, asset, routing, or hydration errors;
- login, empty conversation, active conversation, settings, dialogs, and mobile drawer receive visual inspection at desktop and mobile widths;
- focus, keyboard navigation, loading, empty, error, disabled, and reduced-motion states receive manual inspection.

## Delivery constraints

- Preserve all unrelated existing changes in the dirty worktree.
- Keep commits focused and reviewable.
- Do not introduce a new UI library solely for the rebrand.
- Do not replace functional LibreChat icons unless the existing icon clashes with the Helmies visual system.
- Keep visible Helmies branding separate from technical dependency namespaces.
