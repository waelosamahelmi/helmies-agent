# Helmies Agent Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the LibreChat client into a dark-only Helmies Agent workspace that visually matches Helmies Studio while preserving all existing application behavior and `/agent/` proxy routing.

**Architecture:** Keep LibreChat's React, Recoil, React Query, Tailwind, and component boundaries intact. Apply the rebrand through canonical assets, centralized semantic tokens, and narrowly scoped structural changes to authentication, navigation, landing, messaging, and supporting surfaces; retain `@librechat` as the technical package namespace.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 3, Jest, Testing Library, Vite, Docker Compose, Express/LibreChat API

## Global Constraints

- Canvas is `#0A0A0F`; primary accent is `#FF1B6B`.
- Product name is **Helmies Agent** and parent product is **Helmies Studio**.
- Interface is permanently dark; do not introduce or retain a user-facing theme toggle.
- Use canonical Helmies Studio logos, favicon family, and Nohemi font files.
- Preserve `<base href="/agent/">`, API contracts, authentication mechanics, chat behavior, files, tools, model selection, and accessibility semantics.
- Preserve unrelated dirty-worktree changes and never rename technical `@librechat` packages for branding.
- Do not add a UI framework or icon package.
- All interactive controls require visible focus, hover, pressed, disabled, and reduced-motion treatment.

---

## File structure

- `client/public/assets/helmies-mark.svg` — canonical product mark copied from Helmies Studio.
- `client/public/assets/fonts/nohemi-*.woff2` — canonical Nohemi webfonts.
- `client/src/brand/tokens.ts` — shared brand constants for tests and components that need semantic names.
- `client/src/brand/BrandMark.tsx` — accessible, reusable Helmies Agent mark/wordmark.
- `client/src/brand/__tests__/BrandMark.spec.tsx` — brand component behavior.
- `client/src/style.css` — canonical semantic colors, typography, dark-only defaults, interaction states, and grain.
- `client/src/components/Auth/AuthLayout.tsx` — branded authentication shell.
- `client/src/components/Auth/__tests__/AuthLayout.spec.tsx` — auth-shell regression coverage.
- `client/src/components/UnifiedSidebar/{UnifiedSidebar,Sidebar,ExpandedPanel}.tsx` — desktop rail and history hierarchy.
- `client/src/components/UnifiedSidebar/__tests__/UnifiedSidebar.brand.spec.tsx` — rail labeling and structure.
- `client/src/components/Chat/Landing.tsx` — approved empty-chat hierarchy and starter actions.
- `client/src/components/Chat/__tests__/Landing.brand.spec.tsx` — empty-state copy and accessible actions.
- `client/src/components/Chat/Messages/Message.tsx` and existing message presentation files — user/agent styling hooks without data-flow changes.
- `client/src/components/Chat/Input/ChatForm.tsx` and existing input presentation files — branded composer shell.
- `client/src/components/Nav/SettingsTabs/About/About.tsx` — product name, logo, and links.
- `client/src/components/Auth/Footer.tsx`, `client/src/components/Chat/Footer.tsx`, `client/index.html`, and `librechat.yaml` — product copy and metadata.

---

### Task 1: Canonical brand assets and primitives

**Files:**
- Create: `client/public/assets/helmies-mark.svg`
- Create: `client/public/assets/fonts/nohemi-regular.woff2`
- Create: `client/public/assets/fonts/nohemi-medium.woff2`
- Create: `client/public/assets/fonts/nohemi-semibold.woff2`
- Create: `client/public/assets/fonts/nohemi-bold.woff2`
- Create: `client/src/brand/tokens.ts`
- Create: `client/src/brand/BrandMark.tsx`
- Test: `client/src/brand/__tests__/BrandMark.spec.tsx`
- Modify: `client/index.html`

**Interfaces:**
- Produces: `BRAND.name`, `BRAND.parentName`, `BRAND.accent`, `BRAND.canvas`, and `BrandMark({ compact?: boolean; className?: string })`.
- Consumes: canonical files from `../helmies-studio/public/ico.svg` and `../helmies-studio/public/fonts/`.

- [ ] **Step 1: Write the failing brand component test**

```tsx
import { render, screen } from '@testing-library/react';
import BrandMark from '../BrandMark';

describe('BrandMark', () => {
  it('renders the canonical Helmies mark and Agent wordmark', () => {
    render(<BrandMark />);
    expect(screen.getByRole('img', { name: 'Helmies Agent' })).toHaveAttribute(
      'src',
      '/agent/assets/helmies-mark.svg',
    );
    expect(screen.getByText('HELMIES AGENT')).toBeInTheDocument();
  });

  it('hides the wordmark in compact mode', () => {
    render(<BrandMark compact />);
    expect(screen.queryByText('HELMIES AGENT')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd client && npm run test:ci -- src/brand/__tests__/BrandMark.spec.tsx --runInBand`

Expected: FAIL because `../BrandMark` does not exist.

- [ ] **Step 3: Copy canonical assets and implement the primitive**

Use filesystem copy operations only for the binary font and image assets. Implement:

```ts
export const BRAND = {
  name: 'Helmies Agent',
  parentName: 'Helmies Studio',
  accent: '#FF1B6B',
  canvas: '#0A0A0F',
} as const;
```

```tsx
import { cn } from '~/utils';

export default function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('helmies-brand', className)}>
      <img src="/agent/assets/helmies-mark.svg" alt="Helmies Agent" />
      {!compact && <span>HELMIES AGENT</span>}
    </div>
  );
}
```

Update `client/index.html` metadata to `Helmies Agent`, retain `<base href="/agent/">`, and point favicon/touch-icon links to the canonical copied files.

- [ ] **Step 4: Run brand tests and the base-path assertion**

Run: `cd client && npm run test:ci -- src/brand/__tests__/BrandMark.spec.tsx --runInBand`

Expected: PASS, 2 tests.

Run: `rg -n '<base href="/agent/">|<title>Helmies Agent</title>' client/index.html`

Expected: both lines present.

- [ ] **Step 5: Commit**

```bash
git add client/public/assets client/src/brand client/index.html
git commit -m "feat: add Helmies Agent brand primitives"
```

---

### Task 2: Dark-only semantic theme

**Files:**
- Modify: `client/src/style.css`
- Modify: `packages/client/src/theme/context/ThemeProvider.tsx`
- Modify: `client/src/components/Nav/SettingsTabs/General/Selectors.tsx`
- Test: `client/src/components/Nav/SettingsTabs/General/ThemeSelector.spec.tsx`

**Interfaces:**
- Consumes: brand values from Task 1.
- Produces: semantic CSS variables used by all existing `bg-surface-*`, `text-text-*`, border, input, and focus classes.

- [ ] **Step 1: Change the theme-selector test to require dark-only behavior**

Add an assertion to the existing test suite:

```tsx
it('does not expose a theme selector in the dark-only Helmies interface', () => {
  render(<Selectors startupConfig={startupConfig} />);
  expect(screen.queryByText(/theme/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd client && npm run test:ci -- src/components/Nav/SettingsTabs/General/ThemeSelector.spec.tsx --runInBand`

Expected: FAIL because theme selection is still rendered.

- [ ] **Step 3: Implement the semantic token map and dark lock**

In `client/src/style.css`, add Nohemi font faces and replace dark semantic values with:

```css
@font-face { font-family: 'Nohemi'; src: url('/agent/assets/fonts/nohemi-regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Nohemi'; src: url('/agent/assets/fonts/nohemi-medium.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Nohemi'; src: url('/agent/assets/fonts/nohemi-semibold.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Nohemi'; src: url('/agent/assets/fonts/nohemi-bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }

:root,
.dark {
  --helmies-canvas: #0a0a0f;
  --helmies-nav: #0c0c12;
  --helmies-sidebar: #0d0d13;
  --surface-primary: #0a0a0f;
  --surface-primary-alt: #0d0d13;
  --surface-secondary: #13131a;
  --surface-dialog: #15151d;
  --surface-active: #1b1b23;
  --surface-submit: #ff1b6b;
  --surface-submit-hover: #ff3b7d;
  --text-primary: #f2f2f7;
  --text-secondary: #a2a2ac;
  --text-tertiary: #777782;
  --border-light: #24242d;
  --border-medium: #32323d;
  --ring-primary: #ff1b6b;
  color-scheme: dark;
}

html, body, #root { background: var(--helmies-canvas); font-family: 'Nohemi', sans-serif; }
*:focus-visible { outline: 2px solid var(--ring-primary); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }
```

Force the provider's initial and persisted theme to `dark`, and remove the theme control from General settings without changing other selectors.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `cd client && npm run test:ci -- src/components/Nav/SettingsTabs/General/ThemeSelector.spec.tsx --runInBand`

Expected: PASS.

Run: `cd client && npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/style.css packages/client/src/theme/context/ThemeProvider.tsx client/src/components/Nav/SettingsTabs/General
git commit -m "feat: apply dark Helmies Agent theme"
```

---

### Task 3: Authentication and startup surfaces

**Files:**
- Modify: `client/src/components/Auth/AuthLayout.tsx`
- Modify: `client/src/components/Auth/Footer.tsx`
- Modify: `client/src/routes/Layouts/Startup.tsx`
- Create: `client/src/components/Auth/__tests__/AuthLayout.spec.tsx`
- Modify: `client/src/locales/en/translation.json`

**Interfaces:**
- Consumes: `BrandMark` from Task 1 and semantic CSS from Task 2.
- Produces: shared dark authentication shell for login, registration, recovery, reset, verification, and 2FA.

- [ ] **Step 1: Write the failing authentication-shell test**

```tsx
it('renders Helmies Agent identity and Studio return navigation', () => {
  renderAuthLayout();
  expect(screen.getByRole('img', { name: 'Helmies Agent' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Studio' })).toHaveAttribute(
    'href',
    'http://localhost:3003/',
  );
  expect(screen.queryByLabelText(/theme/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd client && npm run test:ci -- src/components/Auth/__tests__/AuthLayout.spec.tsx --runInBand`

Expected: FAIL because the canonical brand mark and Studio link are absent.

- [ ] **Step 3: Implement the approved authentication layout**

Replace the centered generic logo/card shell with a full dark canvas, a top brand row, `Back to Studio` link, left-aligned form content, and neutral social-login button. Remove `ThemeSelector`. Retain `DisplayError`, `SocialLoginRender`, `Banner`, loading, and all child form behavior.

Add English keys:

```json
"com_auth_helmies_eyebrow": "WELCOME BACK",
"com_auth_helmies_intro": "Sign in to your Helmies workspace.",
"com_auth_back_to_studio": "Back to Studio"
```

Set the startup fallback title to `Helmies Agent`.

- [ ] **Step 4: Run auth tests and typecheck**

Run: `cd client && npm run test:ci -- src/components/Auth/__tests__/AuthLayout.spec.tsx --runInBand`

Expected: PASS.

Run: `cd client && npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Auth client/src/routes/Layouts/Startup.tsx client/src/locales/en/translation.json
git commit -m "feat: rebrand Agent authentication"
```

---

### Task 4: Product rail and conversation sidebar

**Files:**
- Modify: `client/src/components/UnifiedSidebar/UnifiedSidebar.tsx`
- Modify: `client/src/components/UnifiedSidebar/Sidebar.tsx`
- Modify: `client/src/components/UnifiedSidebar/ExpandedPanel.tsx`
- Modify: `client/src/components/UnifiedSidebar/ConversationsSection.tsx`
- Create: `client/src/components/UnifiedSidebar/__tests__/UnifiedSidebar.brand.spec.tsx`
- Modify: `client/src/routes/Root.tsx`

**Interfaces:**
- Consumes: `BrandMark`, existing sidebar Recoil state, conversation data, search, new-chat, settings, and account actions.
- Produces: 64 px rail, 252 px expanded conversation sidebar, and existing mobile drawer behavior.

- [ ] **Step 1: Write a failing structural test**

```tsx
it('renders the Helmies product rail and credit footer', () => {
  renderUnifiedSidebar();
  expect(screen.getByRole('navigation', { name: 'Helmies Agent' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Helmies Agent' })).toBeInTheDocument();
  expect(screen.getByText(/credits/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /new conversation/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd client && npm run test:ci -- src/components/UnifiedSidebar/__tests__/UnifiedSidebar.brand.spec.tsx --runInBand`

Expected: FAIL on missing branded navigation label or credit footer.

- [ ] **Step 3: Apply the approved sidebar hierarchy**

Add semantic landmarks and styling hooks:

```tsx
<nav aria-label="Helmies Agent" className="helmies-rail">...</nav>
<aside aria-label="Conversation history" className="helmies-history">...</aside>
```

Keep all existing click handlers, Recoil state, conversation grouping, search, favorites, projects, account menu, and mobile transform behavior. Use CSS for exact 64/252 px desktop widths and convert both regions to the existing drawer behavior at `max-width: 768px`.

- [ ] **Step 4: Run sidebar suites**

Run: `cd client && npm run test:ci -- src/components/UnifiedSidebar/__tests__ --runInBand`

Expected: all existing and new sidebar tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/UnifiedSidebar client/src/routes/Root.tsx client/src/style.css
git commit -m "feat: align Agent navigation with Studio"
```

---

### Task 5: Orchestrator empty state and starters

**Files:**
- Modify: `client/src/components/Chat/Landing.tsx`
- Create: `client/src/components/Chat/__tests__/Landing.brand.spec.tsx`
- Modify: `librechat.yaml`
- Modify: `client/src/locales/en/translation.json`

**Interfaces:**
- Consumes: existing landing click/submission API and startup configuration.
- Produces: approved heading, supporting copy, and three accessible starter actions that feed the existing composer/submission path.

- [ ] **Step 1: Write failing empty-state tests**

```tsx
it('renders the approved Helmies Orchestrator empty state', () => {
  renderLanding();
  expect(screen.getByText('ORCHESTRATOR')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'What are we making today?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Build a campaign' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create a film' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Research a market' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd client && npm run test:ci -- src/components/Chat/__tests__/Landing.brand.spec.tsx --runInBand`

Expected: FAIL because the approved heading/actions are absent.

- [ ] **Step 3: Implement the hierarchy and starter prompts**

Use this data structure and route actions through the existing landing prompt handler:

```ts
const STARTERS = [
  { label: 'Build a campaign', prompt: 'Help me build a complete campaign from brief to visual system.' },
  { label: 'Create a film', prompt: 'Help me develop a film concept, shot plan, and motion direction.' },
  { label: 'Research a market', prompt: 'Research a market and identify evidence-backed patterns and creative angles.' },
] as const;
```

Update `customWelcome` in `librechat.yaml` to `What are we making today?` and add English keys for eyebrow and supporting copy.

- [ ] **Step 4: Run landing test and typecheck**

Run: `cd client && npm run test:ci -- src/components/Chat/__tests__/Landing.brand.spec.tsx --runInBand`

Expected: PASS.

Run: `cd client && npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Chat/Landing.tsx client/src/components/Chat/__tests__/Landing.brand.spec.tsx client/src/locales/en/translation.json librechat.yaml client/src/style.css
git commit -m "feat: add Helmies Orchestrator landing"
```

---

### Task 6: Conversation messages and composer

**Files:**
- Modify: `client/src/components/Chat/Messages/Message.tsx`
- Modify: `client/src/components/Chat/Messages/MessageIcon.tsx`
- Modify: `client/src/components/Chat/Messages/HoverActions.tsx`
- Modify: `client/src/components/Chat/Input/ChatForm.tsx`
- Modify: `client/src/components/Chat/Input/SubmitButton.tsx`
- Modify: `client/src/style.css`
- Test: `client/src/components/Chat/Messages/__tests__/MessageIcon.render.test.tsx`
- Test: `client/src/components/Chat/Messages/__tests__/HoverActions.streaming.spec.tsx`

**Interfaces:**
- Consumes: all existing message data, markdown, tools, citations, artifacts, attachments, submission, voice, stop, and model controls.
- Produces: presentation hooks only; no data or event signature changes.

- [ ] **Step 1: Add failing presentation assertions**

Extend existing tests:

```tsx
expect(screen.getByLabelText('Helmies Agent')).toHaveClass('helmies-agent-mark');
expect(screen.getByTestId('message-user')).toHaveClass('helmies-user-message');
expect(screen.getByTestId('message-assistant')).toHaveClass('helmies-agent-message');
```

Add a composer assertion that the submit button exposes `helmies-submit` while retaining its accessible name.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd client && npm run test:ci -- src/components/Chat/Messages/__tests__/MessageIcon.render.test.tsx src/components/Chat/Messages/__tests__/HoverActions.streaming.spec.tsx --runInBand`

Expected: FAIL on missing brand classes/label.

- [ ] **Step 3: Add presentation hooks and styles**

Use flat assistant responses, restrained raised user bubbles, pink assistant attribution, low-contrast hover actions, a `#15151D` composer, `#32323D` border, and rounded-square pink send/stop button. Preserve every existing prop, handler, conditional, `data-testid`, and accessibility label.

- [ ] **Step 4: Run message/input suites and typecheck**

Run: `cd client && npm run test:ci -- src/components/Chat/Messages/__tests__/MessageIcon.render.test.tsx src/components/Chat/Messages/__tests__/HoverActions.streaming.spec.tsx --runInBand`

Expected: PASS.

Run: `cd client && npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Chat/Messages client/src/components/Chat/Input client/src/style.css
git commit -m "feat: style Helmies conversations and composer"
```

---

### Task 7: Supporting brand surfaces and copy

**Files:**
- Modify: `client/src/components/Nav/SettingsTabs/About/About.tsx`
- Modify: `client/src/components/Nav/SettingsTabs/About/About.spec.tsx`
- Modify: `client/src/components/Chat/Footer.tsx`
- Modify: `client/src/components/Auth/Footer.tsx`
- Modify: `client/src/components/Agents/Marketplace.tsx`
- Modify: `client/src/locales/en/translation.json`
- Modify: `librechat.yaml`

**Interfaces:**
- Consumes: brand constants and existing settings/footer structures.
- Produces: consistent product naming and links without changing settings behavior.

- [ ] **Step 1: Add failing naming assertions**

In `About.spec.tsx`, assert:

```tsx
expect(screen.getByText('Helmies Agent')).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Helmies Studio' })).toHaveAttribute(
  'href',
  'https://studio.helmies.fi',
);
expect(screen.queryByText(/LibreChat/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd client && npm run test:ci -- src/components/Nav/SettingsTabs/About/About.spec.tsx --runInBand`

Expected: FAIL on current naming or link.

- [ ] **Step 3: Normalize visible brand copy**

Use `Helmies Agent` for the product, `Helmies Studio` for the parent link, and direct error/legal text. Update Marketplace document title from `LibreChat` to `Helmies Agent`. Do not alter comments, test descriptions, MIME identifiers, or technical namespaces solely for branding.

- [ ] **Step 4: Run About test and visible-copy scan**

Run: `cd client && npm run test:ci -- src/components/Nav/SettingsTabs/About/About.spec.tsx --runInBand`

Expected: PASS.

Run: `rg -n 'LibreChat' client/index.html client/src/components/Auth client/src/components/Chat/Footer.tsx client/src/components/Nav/SettingsTabs/About client/src/components/Agents/Marketplace.tsx librechat.yaml`

Expected: no user-visible LibreChat brand occurrences.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Nav/SettingsTabs/About client/src/components/Chat/Footer.tsx client/src/components/Auth/Footer.tsx client/src/components/Agents/Marketplace.tsx client/src/locales/en/translation.json librechat.yaml
git commit -m "feat: complete Helmies Agent brand surfaces"
```

---

### Task 8: Production build and end-to-end proxy verification

**Files:**
- Modify only if verification exposes a defect; keep fixes in the owning task's files.

**Interfaces:**
- Consumes: complete rebrand from Tasks 1–7.
- Produces: rebuilt `librechat-helmies-api:latest` and verified running services.

- [ ] **Step 1: Run the namespace regression check**

```powershell
$matches = rg -n '(@HelmiesStudio/|@Helmies Studio/|HelmiesStudio-data-provider|Helmies Studio-data-provider)' --glob '!package-lock.json'
if ($matches) { $matches; exit 1 }
```

Expected: exit 0 with no matches.

- [ ] **Step 2: Run focused tests and typecheck**

Run:

```bash
cd client
npm run test:ci -- \
  src/brand/__tests__/BrandMark.spec.tsx \
  src/components/Auth/__tests__/AuthLayout.spec.tsx \
  src/components/UnifiedSidebar/__tests__ \
  src/components/Chat/__tests__/Landing.brand.spec.tsx \
  src/components/Chat/Messages/__tests__/MessageIcon.render.test.tsx \
  src/components/Chat/Messages/__tests__/HoverActions.streaming.spec.tsx \
  src/components/Nav/SettingsTabs/About/About.spec.tsx \
  --runInBand
npm run typecheck
```

Expected: all tests PASS and typecheck exits 0.

- [ ] **Step 3: Build the production image**

Run: `docker compose build --progress plain api`

Expected: exit 0; Vite production build succeeds and image is tagged `librechat-helmies-api:latest`.

- [ ] **Step 4: Restart and verify services**

Run: `docker compose up -d --no-build --force-recreate api`

Expected: API, MongoDB, and Meilisearch show `Up` in `docker compose ps`; API logs contain `Server readiness checks passing` and no `MODULE_NOT_FOUND`, `ZodError`, or fatal startup error.

- [ ] **Step 5: Verify the `/agent/` integration**

Run these checks from PowerShell:

```powershell
$agent = Invoke-WebRequest 'http://127.0.0.1:3003/agent' -UseBasicParsing
$base = [regex]::Match($agent.Content, '<base href="([^"]+)"').Groups[1].Value
if ($agent.StatusCode -ne 200 -or $base -ne '/agent/') { exit 1 }
$script = [regex]::Match($agent.Content, '<script[^>]+src="([^"]+\.js)"').Groups[1].Value
$assetUrl = [System.Uri]::new([System.Uri]::new('http://127.0.0.1:3003/agent/'), $script)
$asset = Invoke-WebRequest $assetUrl -UseBasicParsing
$config = Invoke-WebRequest 'http://127.0.0.1:3003/agent/api/config' -UseBasicParsing
if ($asset.StatusCode -ne 200 -or $config.StatusCode -ne 200) { exit 1 }
```

Expected: agent HTML, generated asset, and configuration API all return HTTP 200.

- [ ] **Step 6: Perform visual and accessibility QA**

Inspect at 1440×900, 1024×768, 390×844, and 360×800:

- authentication and validation error;
- empty conversation and all three starters;
- active conversation with markdown, code, tool call, and attachment;
- sidebar expanded/collapsed and mobile drawer;
- settings/About, modal, toast, loading, disabled, and fatal error;
- keyboard-only navigation, visible focus, reduced-motion preference, and browser console.

Expected: no horizontal overflow, obscured composer, missing focus, broken icon/font/asset, or new console error.

- [ ] **Step 7: Commit any verification-only fixes, then record completion**

If Step 6 finds no defects, do not create an empty commit. If responsive or interaction defects were fixed in the presentation layer, stage the verified presentation files and commit:

```bash
git add client/src/style.css client/src/components/Auth/AuthLayout.tsx client/src/components/UnifiedSidebar client/src/components/Chat/Landing.tsx client/src/components/Chat/Messages client/src/components/Chat/Input
git commit -m "fix: polish Helmies Agent responsive states"
```
