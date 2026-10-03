#!/usr/bin/env bash
# =============================================================================
# internize.ai — One-Shot ONNX NER Pipeline Setup & Conversion
# =============================================================================
# Usage: bash scripts/setup_ner_pipeline.sh [model-id] [quant-type]
#
# Examples:
#   bash scripts/setup_ner_pipeline.sh drAbreu/bioBERT-NER-NCBI_disease int8
#   bash scripts/setup_ner_pipeline.sh samrawal/bert-base-uncased_clinical-ner q4
#
# Zero-Egress: This script runs on the DEVELOPER's machine, not in the browser.
# Output artifacts are bundled into dist/ and executed fully on-device.
# =============================================================================

set -euo pipefail

MODEL_ID="${1:-drAbreu/bioBERT-NER-NCBI_disease}"
QUANT_TYPE="${2:-int8}"
OUTPUT_DIR="public/models/clinical-ner"
WASM_DIR="public/wasm"
VENV_DIR=".venv-onnx"

echo "════════════════════════════════════════════════════════════════════"
echo "  internize.ai — ONNX NER Pipeline Setup"
echo "  Model   : $MODEL_ID"
echo "  Quant   : $QUANT_TYPE"
echo "  Output  : $OUTPUT_DIR"
echo "════════════════════════════════════════════════════════════════════"

# ── 1. Python virtualenv ───────────────────────────────────────────────
echo ""
echo "[1/5] Setting up Python virtualenv…"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# ── 2. Install dependencies ────────────────────────────────────────────
echo ""
echo "[2/5] Installing Python dependencies…"
pip install --quiet --upgrade pip
pip install --quiet \
    "optimum[exporters]>=1.18.0" \
    "onnxruntime>=1.19.0" \
    "onnx>=1.16.0" \
    "onnxconverter-common>=1.13.0" \
    "torch>=2.2.0" \
    "transformers>=4.40.0" \
    "sentencepiece" \
    "protobuf"

echo "[2/5] ✓ Dependencies installed"

# ── 3. Create output directories ───────────────────────────────────────
echo ""
echo "[3/5] Creating output directories…"
mkdir -p "$OUTPUT_DIR"
mkdir -p "$WASM_DIR"

# ── 4. Run conversion ─────────────────────────────────────────────────
echo ""
echo "[4/5] Running ONNX conversion + quantization…"
python3 scripts/convert_ner_onnx.py \
    --model "$MODEL_ID" \
    --quantize "$QUANT_TYPE" \
    --output "$OUTPUT_DIR" \
    --tmp "./onnx_temp_$(date +%s)"

echo "[4/5] ✓ Conversion complete"

# ── 5. Copy ONNX Runtime WASM binaries ────────────────────────────────
echo ""
echo "[5/5] Copying onnxruntime-web WASM binaries…"

# Find onnxruntime-web WASM files from node_modules
WASM_SRC="node_modules/onnxruntime-web/dist"
if [ -d "$WASM_SRC" ]; then
    cp "$WASM_SRC"/*.wasm "$WASM_DIR/" 2>/dev/null && echo "  ✓ Copied .wasm files" || true
    cp "$WASM_SRC"/*.js   "$WASM_DIR/" 2>/dev/null && echo "  ✓ Copied .js workers" || true
else
    echo "  [WARN] onnxruntime-web not found in node_modules."
    echo "         Run: npm install onnxruntime-web"
    echo "         Then re-run this script, or copy WASM files manually to $WASM_DIR/"
fi

# Also check @huggingface/transformers WASM path
HF_WASM_SRC="node_modules/@huggingface/transformers/dist"
if [ -d "$HF_WASM_SRC" ]; then
    cp "$HF_WASM_SRC"/*.wasm "$WASM_DIR/" 2>/dev/null && echo "  ✓ Copied HF Transformers .wasm" || true
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  ✓ Pipeline setup complete!"
echo ""
echo "  Artifacts:"
echo "    $OUTPUT_DIR/model_quantized.onnx"
echo "    $OUTPUT_DIR/tokenizer.json"
echo "    $OUTPUT_DIR/config.json"
echo "    $OUTPUT_DIR/model_manifest.json"
echo "    $WASM_DIR/*.wasm"
echo ""
echo "  Next: npm run build && Load extension in Chrome"
echo "════════════════════════════════════════════════════════════════════"

deactivate || true
