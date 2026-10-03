# Cloud Synthesizer — Deploy Guide

> **internize.ai · Tier 3 Gemini Cloud Integration**

## Overview

The Cloud Synthesizer is an **opt-in** Supabase Edge Function that proxies
de-identified clinical payloads to the Gemini API and returns structured
Sp.PD clinical synthesis JSON. All PHI is tokenised **on-device before
leaving the browser** — the Edge Function never sees real patient identifiers.

```
Browser (raw text)
  │
  ▼  [on-device deidentifier.ts]
Browser (sanitized tokens: [PATIENT_1], [MRN_1], …)
  │
  ▼  POST /functions/v1/cloud-synthesize
Supabase Edge Function
  │
  ▼  Gemini API (response_schema + system prompt)
Supabase Edge Function  ← server-side anti-leakage scan
  │
  ▼  Structured JSON (tokens intact)
Browser  ← 3-layer guardrail (schema + token invariant + anti-leakage)
  │
  ▼  [on-device reidentifyOutput()]
Browser (re-identified output shown to physician)
```

---

## Prerequisites

- Supabase CLI ≥ 1.220.0 (`supabase --version`)
- A Supabase project with the URL/anon key configured in the extension Settings tab
- A Google AI Studio or Vertex AI API key with Gemini 2.0 Flash access

---

## 1. Link your project (first time only)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

---

## 2. Set the Gemini API key in Supabase Vault

```bash
supabase secrets set SUPABASE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

To use Gemini 2.5 Pro instead of Flash (higher quality, slower):

```bash
supabase secrets set GEMINI_MODEL_ID=gemini-2.5-pro-001
```

Verify secrets are set:

```bash
supabase secrets list
```

---

## 3. Deploy the Edge Function

```bash
supabase functions deploy cloud-synthesize
```

> The `config.toml` in the function directory sets `verify_jwt = false`,
> meaning the Supabase anon key in the `Authorization: Bearer` header is
> sufficient authentication — no user sign-in required.

---

## 4. Test the deployed function

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cloud-synthesize \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sanitizedText": "Pasien [PATIENT_1], [AGE_1], [GENDER_1]. TD 160/100 mmHg. DM tipe 2. HbA1c 9.2%. GDS 310 mg/dL.",
    "structuredData": {
      "vitals": { "bp": "160/100", "hr": 88, "rr": 20, "temp": 37.1, "spo2": 97 },
      "abnormalLabs": [
        { "name": "GDS", "value": 310, "unit": "mg/dL", "flag": "high", "interpretation": "Hiperglikemia berat" }
      ],
      "activeProblems": [
        { "title": "DM Tipe 2 tidak terkontrol", "division": "endokrin", "criticality": "high" }
      ]
    },
    "mode": "pomr",
    "clientVersion": "1.0.0"
  }'
```

Expected response shape:
```json
{
  "ok": true,
  "result": {
    "summary_one_liner": "[PATIENT_1], ...",
    "problem_list": [...],
    "pertinent_negatives": [...],
    "cross_specialty_safety_alerts": { ... },
    "soap_note": { ... }
  },
  "latencyMs": 1234
}
```

---

## 5. Configure the extension

In the internize.ai extension:
1. Open the side panel → **Settings** tab
2. Enter your Supabase Project URL and Anon Key
3. Click **Test Connection** to verify
4. In the **Sp.PD Workflow** tab, click the **Cloud** badge in the header
   to enable Tier 3 synthesis on the current clinical case

---

## Security Notes

| Concern | Mitigation |
|---|---|
| PHI sent to cloud | Impossible — de-identification runs before any network call |
| API key exposure | Key stored in Supabase Vault; never in browser or extension |
| Response leakage | Server-side + client-side anti-leakage scans block NIK/phone/IP |
| Token reconstruction | Token map stored in `chrome.storage.session` only; cleared on browser close |
| Stale cloud data | Cloud result auto-resets on every input text change |
| Timeout | 8-second hard timeout; falls back to CROGE local output on expiry |

---

## Updating the Gemini model

```bash
supabase secrets set GEMINI_MODEL_ID=gemini-2.5-pro-001
# No redeploy needed — env var is read at runtime by the Edge Function
```
