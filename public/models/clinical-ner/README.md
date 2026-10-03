# public/models/clinical-ner/

This directory holds the ONNX-quantized clinical NER model bundle.
It is intentionally empty in version control.

## Generating the model artifacts

Run the conversion script from the project root:

```bash
# Option A — one-shot shell script (Linux / macOS / WSL)
bash scripts/setup_ner_pipeline.sh drAbreu/bioBERT-NER-NCBI_disease int8

# Option B — Python script directly
pip install "optimum[exporters]" onnxruntime onnx onnxconverter-common torch transformers
python scripts/convert_ner_onnx.py \
    --model drAbreu/bioBERT-NER-NCBI_disease \
    --quantize int8 \
    --output public/models/clinical-ner

# Option C — Windows PowerShell
python -m pip install "optimum[exporters]" onnxruntime onnx torch transformers
python scripts/convert_ner_onnx.py --model samrawal/bert-base-uncased_clinical-ner --quantize int8
```

## Expected artifacts after conversion

```
public/models/clinical-ner/
├── model_quantized.onnx     ← Quantized ONNX model (~30–80 MB)
├── tokenizer.json           ← HuggingFace fast tokenizer
├── tokenizer_config.json    ← Tokenizer configuration
├── config.json              ← Model config + patched label2id/id2label
├── special_tokens_map.json  ← Special token definitions
└── model_manifest.json      ← internize.ai artifact manifest
```

## Recommended models for Sp.PD / Indonesian clinical NLP

| Key               | HF Model ID                                      | Quant | Size  |
|-------------------|--------------------------------------------------|-------|-------|
| bio-ncbi-disease  | `drAbreu/bioBERT-NER-NCBI_disease`              | int8  | ~65MB |
| clinical-ner      | `samrawal/bert-base-uncased_clinical-ner`        | int8  | ~65MB |
| bio-clinicalbert  | `emilyalsentzer/Bio_ClinicalBERT` (fine-tune me) | q4    | ~28MB |

> **Zero-Egress**: These models run 100% on-device via WebGPU (primary) or
> WASM SIMD (fallback). No patient data is ever transmitted to any server.
