# internize.ai

> **A privacy-first clinical and research Chrome Extension.**  
> On-device AI inference (WebGPU/WASM) · HIPAA Safe Harbor de-identification · SNOMED CT · RxNorm · LOINC · FHIR R4

---

## Features

### 🩺 Clinical Service Tab
| Feature | Detail |
|---|---|
| **Auto-capture** | Highlighted text on any webpage auto-populates the input area |
| **SOAP Note Generation** | Structures clinical narrative into Subjective / Objective / Assessment / Plan with source span citations |
| **SNOMED CT Coding** | Maps diagnoses to SNOMED CT SCTIDs (365+ concept lexicon, NegEx negation detection) |
| **RxNorm Reconciliation** | Extracts medications with RxCUI codes, dosage, route, and frequency parsing |
| **On-device inference** | Transformers.js v3 with WebGPU primary / WASM fallback — zero external API calls |

### 🔬 Research & Extraction Tab
| Feature | Detail |
|---|---|
| **HIPAA Safe Harbor De-id** | Redacts all 18 PHI categories (names, DOBs, MRNs, SSNs, emails, etc.) |
| **Compliance Report** | Returns `compliant`, `safeHarborMet`, `residualRisk`, and per-category audit |
| **LOINC Lab Extraction** | Parses 13+ analytes (triglycerides `2571-8`, glucose `2345-7`, testosterone `2986-8`, etc.) with UCUM units and abnormal flags |
| **FHIR R4 Bundle Assembly** | Packages de-identified data as a valid `transaction` Bundle with `urn:uuid` references and US Core profiles |
| **JSON Download** | Downloads the Bundle as `.json` — no `downloads` permission required |
| **Supabase Push** | Upserts the Bundle into your Supabase table via the JS SDK |

### ⚙️ Settings Tab
- Supabase Project URL, anon key, and table name — persisted in `chrome.storage.sync`
- Live connection test before saving

---

## Installation

### Prerequisites
- Node.js ≥ 18
- pnpm or npm
- Chrome 116+ (for Side Panel + WebGPU support)

### Development setup

```bash
# 1. Install dependencies
npm install          # or: pnpm install

# 2. Type-check
npx tsc --noEmit

# 3. Lint
npm run lint         # biome check src

# 4. Run tests
npm test             # tsx tests/e2e/runner.ts

# 5. Build for production
npm run build        # → dist/
```

### Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

The extension icon appears in the toolbar. Click it to open the side panel.

---

## Project Structure

```
internize.ai/
├── manifest.json               MV3 manifest (source)
├── sidepanel.html              Side panel entry point
├── src/
│   ├── background/index.ts     Service worker — side panel activation + IPC routing
│   ├── content/index.ts        Content script — highlight capture (no <all_urls>)
│   ├── sidepanel/              React 18 app shell
│   │   ├── App.tsx             Tab router, toast system, useSelection hook
│   │   └── hooks/useSelection.ts
│   ├── components/             Shared UI primitives (Button, Badge, Card, Toast)
│   ├── features/
│   │   ├── clinical/           Clinical Service Tab + SOAP/SNOMED/RxNorm viewers
│   │   ├── research/           Research & Extraction Tab
│   │   └── settings/           Supabase config panel
│   ├── services/
│   │   ├── clinical/           CROGE engine, SNOMED/RxNorm dictionaries, SOAP synthesizer
│   │   ├── deid/               HIPAA Safe Harbor de-identifier + compliance checker
│   │   ├── loinc/              LOINC biomarker extractor + dictionary
│   │   ├── fhir/               FHIR R4 Bundle assembler + JSON downloader
│   │   └── supabase/           Supabase client + chrome.storage.sync integration
│   └── types/                  Shared TypeScript interfaces
├── tests/
│   ├── e2e/                    223-test E2E acceptance suite (Tiers 1–4)
│   └── unit/                   Clinical engine unit tests
└── dist/                       Production build output (load this in Chrome)
```

---

## Supabase Setup

Create a table in your Supabase project:

```sql
create table fhir_bundles (
  id           text primary key,
  bundle_type  text not null,
  resource_count integer not null,
  generated_at timestamptz not null,
  payload      jsonb not null,
  created_at   timestamptz default now()
);

-- Enable RLS (recommended)
alter table fhir_bundles enable row level security;
```

Then enter your Project URL and anon key in the extension's **Settings** tab.

---

## Privacy & Security

| Guarantee | How |
|---|---|
| **Zero PHI egress during inference** | All NLP/AI runs in-browser (WebGPU or WASM) |
| **No `<all_urls>` permission** | Content script injected only on `activeTab` grant |
| **Supabase receives only de-identified data** | De-id runs before bundle assembly |
| **Credentials stored in `chrome.storage.sync`** | Encrypted by Chrome, never in localStorage |
| **Manifest V3** | No persistent background page |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension shell | Chrome Manifest V3 + [@crxjs/vite-plugin](https://crxjs.dev/) |
| UI | React 18 + Tailwind CSS + lucide-react |
| Build | Vite 5 + TypeScript 5 (strict) |
| Linter | Biome |
| On-device AI | [@huggingface/transformers](https://huggingface.co/docs/transformers.js) v3 (WebGPU/WASM) |
| Clinical rules | CROGE (built-in) — SNOMED CT, RxNorm, NegEx |
| Standards | HIPAA Safe Harbor (45 CFR §164.514(b)(2)), FHIR R4, LOINC, UCUM |
| Cloud sync | [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) v2 |

---

## License

MIT
