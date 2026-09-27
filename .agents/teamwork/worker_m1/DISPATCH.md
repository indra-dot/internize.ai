## 2026-09-26T12:17:53Z
**Context**: Milestone 1 Implementation (Chrome Extension Shell MV3 & Tooling)
**Identity**: You are worker_m1, a teamwork_preview_worker.
**Working Directory**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\worker_m1
**Project Root**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai
**Original Request**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\ORIGINAL_REQUEST.md (MANDATORY: Read this first).
**Scope Document**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\sub_orch_m1\SCOPE.md
**Project Document**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\PROJECT.md
**Survey Reference**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\explorer_survey_1\survey_report.md

**MANDATORY INTEGRITY WARNING**:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

**Exclusive Write Ownership**:
`package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `biome.json`, `manifest.json`, `sidepanel.html`, `src/**`.

**Implementation Scope**:
1. Setup `package.json` with all project dependencies:
   - React 18 (`react`, `react-dom`, `@types/react`, `@types/react-dom`)
   - TypeScript (`typescript`, `@types/chrome`, `@types/node`)
   - Vite 5 (`vite`, `@vitejs/plugin-react`, `@crxjs/vite-plugin`)
   - Styling (`tailwindcss`, `postcss`, `autoprefixer`, `clsx`, `tailwind-merge`, `lucide-react`)
   - AI & Data (`@huggingface/transformers`, `@supabase/supabase-js`)
   - Testing & Linter (`tsx`, `vitest`, `@biomejs/biome`)
   - npm scripts: `build: "tsc --noEmit && vite build"`, `dev: "vite"`, `lint: "biome check src"`, `test: "tsx tests/e2e/runner.ts"`
2. Setup `tsconfig.json` (strict mode, bundler resolution, React JSX).
3. Setup `vite.config.ts` using `@crxjs/vite-plugin` (or robust multi-entry Rollup if appropriate).
4. Setup `tailwind.config.js` and `postcss.config.js`.
5. Setup `manifest.json`:
   - MV3, minimum permissions `["sidePanel", "storage", "activeTab", "scripting"]`.
   - ZERO `<all_urls>` host permissions (host_permissions empty or omitted).
   - No `default_popup` in `action`.
   - side_panel: `{ "default_path": "sidepanel.html" }`.
   - CSP: `"extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`
6. Implement `src/background/index.ts`:
   - Call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
   - Message routing and listeners.
7. Implement `src/content/index.ts`:
   - Highlight text capture on `mouseup`/`keyup`/`selectionchange` with 150ms debounce.
   - Forward to extension via `chrome.runtime.sendMessage({ type: 'TEXT_SELECTED', text, timestamp: Date.now() }).catch(() => {})`.
   - Respond to `GET_SELECTED_TEXT` messages.
8. Implement `src/types/messages.ts`, `src/types/clinical.ts`, `src/types/research.ts` matching contracts in `PROJECT.md`.
9. Implement `sidepanel.html` and `src/sidepanel/`:
   - `index.tsx`, `App.tsx`, `index.css`.
   - `src/components/layout/`: `Header.tsx`, `TabNavigation.tsx`, `StatusBar.tsx`.
   - `src/components/ui/`: `Button.tsx`, `Card.tsx`, `Badge.tsx`, `Toast.tsx`.
   - Tab containers: `ClinicalServiceTab.tsx` and `ResearchExtractionTab.tsx` with clean responsive layout (380px-480px) and placeholder controls.
10. Run `npm install` and `npm run build`.
11. Verify that `dist/` contains valid `manifest.json`, `sidepanel.html`, service worker, and scripts with 0 TypeScript errors.

Write a complete report to `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\worker_m1\handoff.md` and send a completion message with summary.
