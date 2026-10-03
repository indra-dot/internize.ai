#!/usr/bin/env python3
"""
internize.ai — Clinical NER Model → ONNX Quantized Conversion Script
=======================================================================
Converts a HuggingFace token-classification model (e.g. IndoBERT-NER,
Bio_ClinicalBERT-NER) to a quantized ONNX artifact for in-browser
WebGPU / WASM inference via @huggingface/transformers (v3).

Target footprint: ~30–80 MB (vs ~400 MB FP32 baseline).

Usage:
  pip install optimum[exporters] onnxruntime onnx
  python scripts/convert_ner_onnx.py --model <hf-model-id> [--quantize int8|q4]

Examples:
  python scripts/convert_ner_onnx.py \\
      --model "drAbreu/bioBERT-NER-NCBI_disease" \\
      --quantize int8 \\
      --output public/models/clinical-ner

  python scripts/convert_ner_onnx.py \\
      --model "samrawal/bert-base-uncased_clinical-ner" \\
      --quantize q4 \\
      --output public/models/clinical-ner

Zero-Egress Invariant: This script runs OFFLINE on the developer's machine.
The resulting ONNX artifacts are bundled into the Chrome Extension and
executed fully on-device. No patient data ever touches this script.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

SUPPORTED_QUANT = {"int8", "q4", "fp16", "none"}

# Indonesian Sp.PD NER model recommendations (fine-tuned for clinical NER)
RECOMMENDED_MODELS = {
    "indobert-clinical-ner": {
        "hf_id": "indobenchmark/indobert-base-p1",
        "note": "IndoBERT base — requires fine-tuning on Indonesian clinical NER corpus",
        "task": "token-classification",
    },
    "bio-clinicalbert": {
        "hf_id": "emilyalsentzer/Bio_ClinicalBERT",
        "note": "Bio_ClinicalBERT — English clinical NER, best accuracy on clinical notes",
        "task": "token-classification",
    },
    "biobert-ncbi-disease": {
        "hf_id": "drAbreu/bioBERT-NER-NCBI_disease",
        "note": "BioBERT NCBI Disease NER — production-ready, disease entity extraction",
        "task": "token-classification",
    },
    "bert-clinical-ner": {
        "hf_id": "samrawal/bert-base-uncased_clinical-ner",
        "note": "BERT Clinical NER — multi-entity (disease, drug, symptom)",
        "task": "token-classification",
    },
}


# ──────────────────────────────────────────────────────────────────────────────
# Label map patch — aligns HF model labels → internize.ai BIO schema
# ──────────────────────────────────────────────────────────────────────────────

LABEL_MAP_PATCH = {
    # Disease / Diagnosis
    "B-DISEASE": "B-DISEASE", "I-DISEASE": "I-DISEASE",
    "B-DN":      "B-DISEASE", "I-DN":      "I-DISEASE",   # NCBI Disease NER
    "B-DIS":     "B-DISEASE", "I-DIS":     "I-DISEASE",
    # Drug / Medication
    "B-DRUG":    "B-DRUG",    "I-DRUG":    "I-DRUG",
    "B-CHEM":    "B-DRUG",    "I-CHEM":    "I-DRUG",      # ChemNER variants
    "B-CHEMICAL":"B-DRUG",    "I-CHEMICAL":"I-DRUG",
    # Lab / Test
    "B-LAB":     "B-LAB",     "I-LAB":     "I-LAB",
    "B-TEST":    "B-LAB",     "I-TEST":    "I-LAB",
    # Anatomy / Body Part
    "B-ANATOMY": "B-ANATOMY", "I-ANATOMY": "I-ANATOMY",
    "B-BODY":    "B-ANATOMY", "I-BODY":    "I-ANATOMY",
    # Symptom
    "B-SYMPTOM": "B-SYMPTOM", "I-SYMPTOM": "I-SYMPTOM",
    "B-SIGN":    "B-SYMPTOM", "I-SIGN":    "I-SYMPTOM",
    # Procedure
    "B-PROCEDURE": "B-PROCEDURE", "I-PROCEDURE": "I-PROCEDURE",
    "B-PROC":    "B-PROCEDURE", "I-PROC":    "I-PROCEDURE",
    # Vitals / Dosage / Route / Frequency (Sp.PD specific)
    "B-DOSAGE":  "B-DOSAGE",  "I-DOSAGE":  "I-DOSAGE",
    "B-ROUTE":   "B-ROUTE",   "I-ROUTE":   "I-ROUTE",
    "B-FREQUENCY":"B-FREQUENCY","I-FREQUENCY":"I-FREQUENCY",
    # Outside
    "O": "O",
}


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Export to ONNX via optimum-cli
# ──────────────────────────────────────────────────────────────────────────────

def export_to_onnx(model_id: str, tmp_dir: Path, task: str = "token-classification") -> None:
    """
    Runs: optimum-cli export onnx --model <id> --task token-classification ./tmp/
    Requires: pip install optimum[exporters]
    """
    print(f"\n[1/4] Exporting {model_id} → ONNX (task: {task})…")

    cmd = [
        sys.executable, "-m", "optimum.exporters.onnx",
        "--model", model_id,
        "--task", task,
        "--framework", "pt",
        "--device", "cpu",       # Export on CPU for reproducibility
        "--opset", "17",         # ONNX opset 17 — supported by onnxruntime-web 1.19+
        str(tmp_dir),
    ]

    # Alternative CLI path (if optimum-cli is installed as a script)
    try:
        result = subprocess.run(
            ["optimum-cli", "export", "onnx",
             "--model", model_id,
             "--task", task,
             "--framework", "pt",
             "--opset", "17",
             str(tmp_dir)],
            check=True, capture_output=False,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[WARN] optimum-cli not on PATH, falling back to python -m …")
        subprocess.run(cmd, check=True)

    print(f"[1/4] ✓ ONNX export complete → {tmp_dir}")


# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Quantize ONNX graph
# ──────────────────────────────────────────────────────────────────────────────

def quantize_onnx(
    tmp_dir: Path,
    output_dir: Path,
    quant_type: str,
) -> Path:
    """
    Quantizes the exported ONNX model.
    - int8: Full INT8 dynamic quantization (CPU-safe, ~75% size reduction)
    - q4:   INT4 weight-only quantization (WebGPU optimal, ~87% reduction)
    - fp16: FP16 half-precision (best accuracy/size tradeoff on WebGPU)
    """
    print(f"\n[2/4] Quantizing ONNX → {quant_type}…")

    src_model = tmp_dir / "model.onnx"
    if not src_model.exists():
        # Some models export as model_quantized.onnx or similar
        candidates = list(tmp_dir.glob("*.onnx"))
        if not candidates:
            raise FileNotFoundError(f"No .onnx file found in {tmp_dir}")
        src_model = candidates[0]
        print(f"[INFO] Using model file: {src_model.name}")

    output_dir.mkdir(parents=True, exist_ok=True)
    out_model = output_dir / "model_quantized.onnx"

    if quant_type == "none" or quant_type == "fp32":
        shutil.copy2(src_model, out_model)
        print(f"[2/4] ✓ No quantization — copied as-is → {out_model}")
        return out_model

    if quant_type == "fp16":
        _quantize_fp16(src_model, out_model)
    elif quant_type == "int8":
        _quantize_int8(src_model, out_model)
    elif quant_type == "q4":
        _quantize_q4(src_model, out_model)
    else:
        raise ValueError(f"Unsupported quantization type: {quant_type}. Choose from {SUPPORTED_QUANT}")

    orig_mb = src_model.stat().st_size / 1_048_576
    quant_mb = out_model.stat().st_size / 1_048_576
    reduction = (1 - quant_mb / orig_mb) * 100
    print(f"[2/4] ✓ {quant_type} quantization: {orig_mb:.1f} MB → {quant_mb:.1f} MB ({reduction:.0f}% reduction)")

    return out_model


def _quantize_fp16(src: Path, dst: Path) -> None:
    try:
        import onnx
        from onnxconverter_common import float16
        model = onnx.load(str(src))
        model_fp16 = float16.convert_float_to_float16(model, keep_io_types=True)
        onnx.save(model_fp16, str(dst))
    except ImportError:
        print("[WARN] onnxconverter_common not installed. pip install onnxconverter-common")
        print("[INFO] Falling back to INT8 quantization…")
        _quantize_int8(src, dst)


def _quantize_int8(src: Path, dst: Path) -> None:
    from onnxruntime.quantization import (
        QuantFormat, QuantType, quantize_dynamic,
    )
    quantize_dynamic(
        model_input=str(src),
        model_output=str(dst),
        weight_type=QuantType.QInt8,
        quant_format=QuantFormat.QDQ,
        # Optimize for onnxruntime-web: exclude embeddings from quantization
        # to preserve accuracy on token classification heads
        nodes_to_exclude=["/embeddings/"],
        extra_options={
            "MatMulConstBOnly": True,  # Only quantize constant MatMul inputs
            "EnableSubgraph": False,   # Simpler graph for browser compat
        },
    )


def _quantize_q4(src: Path, dst: Path) -> None:
    """
    INT4 weight-only quantization — optimal for WebGPU backends.
    Falls back to INT8 if MatMulNBits is not supported.
    """
    try:
        from onnxruntime.quantization import MatMulNBits, quantize
        # Q4 via MatMulNBits (ONNX Runtime 1.18+)
        quantize(
            model_input=str(src),
            model_output=str(dst),
            quant_config=MatMulNBits(block_size=32, is_symmetric=True),
        )
    except (ImportError, AttributeError):
        print("[WARN] MatMulNBits Q4 not available in this onnxruntime version.")
        print("[INFO] Falling back to INT8 dynamic quantization…")
        _quantize_int8(src, dst)


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Optimize ONNX graph (constant folding, dead-node elimination)
# ──────────────────────────────────────────────────────────────────────────────

def optimize_onnx_graph(model_path: Path) -> None:
    """
    Runs ONNX graph optimizations:
    - Constant folding
    - Redundant node elimination
    - Shape inference
    Overwrites model in-place.
    """
    print("\n[3/4] Optimizing ONNX graph…")
    try:
        import onnx
        from onnxruntime.transformers import optimizer as ort_optimizer

        opt_model = ort_optimizer.optimize_model(
            str(model_path),
            model_type="bert",
            num_heads=12,
            hidden_size=768,
            optimization_options=None,
            opt_level=1,           # Level 1 = basic; level 2 = extended (may break some models)
            use_gpu=False,
        )
        opt_model.save_model_to_file(str(model_path))
        print(f"[3/4] ✓ Graph optimization applied → {model_path}")

    except Exception as e:
        print(f"[WARN] Graph optimization skipped (non-fatal): {e}")
        # Still valid — skip optimization if model type not supported


# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Copy tokenizer + config artefacts
# ──────────────────────────────────────────────────────────────────────────────

def copy_tokenizer_artifacts(
    tmp_dir: Path,
    output_dir: Path,
    model_id: str,
    label_map: dict,
) -> None:
    """
    Copies tokenizer.json, tokenizer_config.json, config.json, and
    special_tokens_map.json to the output directory.
    Also writes a patched label2id/id2label into config.json aligned to
    the internize.ai BIO label schema.
    """
    print("\n[4/4] Copying tokenizer artifacts + patching label map…")

    artifacts = [
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
        "vocab.txt",
        "merges.txt",      # For BPE tokenizers (GPT-style)
    ]

    for fname in artifacts:
        src = tmp_dir / fname
        if src.exists():
            shutil.copy2(src, output_dir / fname)
            print(f"  ✓ {fname}")

    # Patch config.json with aligned label maps
    config_src = tmp_dir / "config.json"
    if config_src.exists():
        with open(config_src, encoding="utf-8") as f:
            config = json.load(f)

        # Remap labels to internize.ai schema
        orig_id2label = config.get("id2label", {})
        patched_id2label = {}
        for k, v in orig_id2label.items():
            patched_id2label[k] = LABEL_MAP_PATCH.get(v, v)

        patched_label2id = {v: int(k) for k, v in patched_id2label.items()}

        config["id2label"] = patched_id2label
        config["label2id"] = patched_label2id
        config["_internize_model_id"] = model_id
        config["_internize_quant_schema"] = "BIO-clinical-ner-v1"
        config["_internize_label_map_patch"] = LABEL_MAP_PATCH

        with open(output_dir / "config.json", "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print("  ✓ config.json (label map patched)")

    # Write manifest for the extension loader
    model_manifest = {
        "modelId": model_id,
        "task": "token-classification",
        "quantization": "see config",
        "onnxFile": "model_quantized.onnx",
        "tokenizerFiles": [a for a in artifacts if (output_dir / a).exists()],
        "labelMapVersion": "BIO-clinical-ner-v1",
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "zeroEgress": True,
        "note": "Artifact generated by internize.ai/scripts/convert_ner_onnx.py — runs 100% on-device.",
    }
    with open(output_dir / "model_manifest.json", "w", encoding="utf-8") as f:
        json.dump(model_manifest, f, indent=2)
    print("  ✓ model_manifest.json")

    print(f"[4/4] ✓ All artifacts → {output_dir}")


# ──────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert HuggingFace NER model → Quantized ONNX for internize.ai"
    )
    parser.add_argument(
        "--model", "-m",
        required=True,
        help="HuggingFace model ID (e.g. drAbreu/bioBERT-NER-NCBI_disease) or local path",
    )
    parser.add_argument(
        "--quantize", "-q",
        default="int8",
        choices=sorted(SUPPORTED_QUANT),
        help="Quantization type: int8 (default), q4, fp16, none",
    )
    parser.add_argument(
        "--output", "-o",
        default="public/models/clinical-ner",
        help="Output directory for ONNX + tokenizer artifacts (default: public/models/clinical-ner)",
    )
    parser.add_argument(
        "--tmp", "-t",
        default="./onnx_temp",
        help="Temporary directory for raw ONNX export (cleaned up after)",
    )
    parser.add_argument(
        "--keep-tmp",
        action="store_true",
        help="Do not delete the temporary ONNX export directory after conversion",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List recommended Sp.PD clinical NER models and exit",
    )
    args = parser.parse_args()

    if args.list_models:
        print("\nRecommended Clinical NER Models for internize.ai (Sp.PD):\n")
        for key, info in RECOMMENDED_MODELS.items():
            print(f"  [{key}]")
            print(f"    HF ID : {info['hf_id']}")
            print(f"    Note  : {info['note']}")
            print()
        print("Usage example:")
        print(f"  python scripts/convert_ner_onnx.py --model drAbreu/bioBERT-NER-NCBI_disease --quantize int8")
        return

    tmp_dir    = Path(args.tmp)
    output_dir = Path(args.output)

    print("=" * 70)
    print("  internize.ai — Clinical NER → ONNX Converter")
    print("=" * 70)
    print(f"  Model   : {args.model}")
    print(f"  Quant   : {args.quantize}")
    print(f"  Output  : {output_dir}")
    print("=" * 70)

    try:
        # 1. Export to ONNX
        export_to_onnx(args.model, tmp_dir)

        # 2. Quantize
        quant_model_path = quantize_onnx(tmp_dir, output_dir, args.quantize)

        # 3. Optimize graph
        optimize_onnx_graph(quant_model_path)

        # 4. Copy tokenizer + config
        copy_tokenizer_artifacts(tmp_dir, output_dir, args.model, LABEL_MAP_PATCH)

    finally:
        if not args.keep_tmp and tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
            print(f"\n[cleanup] Removed temp dir: {tmp_dir}")

    print("\n" + "=" * 70)
    print(f"  ✓ Conversion complete!")
    print(f"  Artifact directory: {output_dir.resolve()}")
    print()
    print("  Next steps:")
    print("  1. Verify artifact in browser:")
    print(f"     chrome.runtime.getURL('models/clinical-ner/model_quantized.onnx')")
    print("  2. Run: npm run build")
    print("  3. Load extension in Chrome → chrome://extensions → Load unpacked → dist/")
    print("=" * 70)


if __name__ == "__main__":
    main()
