# Scope: Milestone 1 - Chrome Extension Shell MV3 & Tooling

## Architecture
- Manifest V3 configuration with minimum permissions (`sidePanel`, `storage`, `activeTab`, `scripting`) and zero `<all_urls>`.
- Background service worker: single-click side panel auto-open behavior on action click (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`) without popup interception, message routing.
- Content script: debounced selection change listener, messaging `TEXT_SELECTED` to side panel, responding to `GET_SELECTED_TEXT`.
- Side Panel Shell: React 18, Tailwind CSS, TabNavigation, Header, StatusBar, Card/Button/Badge/Toast components.
- Tooling: Vite 5, @crxjs/vite-plugin, TypeScript strict mode, Biome/ESLint. `npm run build` must compile cleanly with 0 TypeScript errors.

## Assigned Features
- Feature 1: MV3 Extension Manifest
- Feature 2: Single-Click Side Panel Activation
- Feature 3: Highlight Text Capture & Auto-Populate (<2s)
- Feature 4: Build & Lint Pipeline (`npm run build` succeeds cleanly, valid unpacked `dist/`)
- Feature 5: Side Panel UI Shell & Navigation

## Reference Survey
- Refer to `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\explorer_survey_1\survey_report.md` for validated configurations, code samples, and build recipes.

## Interface Contracts
- `src/types/messages.ts`: `ExtensionMessage` discriminated union (see `PROJECT.md § Interface Contracts`).

## Code Layout Ownership
- `manifest.json`, `vite.config.ts`, `package.json`, `tsconfig.json`, `biome.json`, `tailwind.config.js`, `postcss.config.js`
- `sidepanel.html`
- `src/background/index.ts`
- `src/content/index.ts`
- `src/sidepanel/index.tsx`, `src/sidepanel/App.tsx`, `src/sidepanel/index.css`
- `src/components/layout/*`
- `src/components/ui/*`
- `src/types/messages.ts`

## Iteration & Verification Requirements
- Execute Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor -> Gate loop.
- Verification: `npm run build` completes with exit code 0, producing valid unpacked extension in `dist/`.
