#!/usr/bin/env python3
"""
extract_raw.py — Milestone 2 PPK Hybrid Raw Extractor (internize.ai)

Extracts:
1. Native digital text from 55 digital PDFs via pypdf.
2. Structured tables and paragraphs from 2 DOCX files via python-docx.
3. Stream pieces from 1 legacy OLE2 DOC file via olefile.
4. Direct embedded full-page raster scan images from 64 scanned PDFs into cache/images/.
"""

import os
import sys
import json
import hashlib
import re
from pathlib import Path

# Force UTF-8 encoding on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import pypdf
import docx
import olefile
from PIL import Image

BASE_DOCS_DIR = Path("docs/ppk")
CACHE_DIR = Path("scripts/ingest_ppk/cache")
IMAGES_DIR = CACHE_DIR / "images"
OUTPUT_JSON = CACHE_DIR / "raw_extracted.json"

def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def slugify(text: str) -> str:
    # Remove extension, convert non-alphanumeric to underscore
    s = re.sub(r'[\(\)\[\]\.,_\-\s]+', '_', text).strip('_')
    return s.lower()

def extract_docx(filepath: Path) -> tuple[str, list[dict]]:
    doc = docx.Document(filepath)
    text_parts = []
    tables_data = []

    for p in doc.paragraphs:
        t = p.text.strip()
        if t:
            text_parts.append(t)

    for t_idx, table in enumerate(doc.tables):
        table_rows = []
        for row in table.rows:
            row_cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
            table_rows.append(row_cells)
        tables_data.append({"table_index": t_idx, "rows": table_rows})
        # Format table into readable text lines
        for r in table_rows:
            # de-duplicate adjacent identical cells (merged cells)
            dedup_cells = []
            for c in r:
                if not dedup_cells or c != dedup_cells[-1]:
                    dedup_cells.append(c)
            row_text = " | ".join(c for c in dedup_cells if c)
            if row_text:
                text_parts.append(row_text)

    return "\n\n".join(text_parts), tables_data

def extract_legacy_doc(filepath: Path) -> str:
    ole = olefile.OleFileIO(filepath)
    data = ole.openstream("WordDocument").read()
    pieces = []
    i = 0
    data_len = len(data)
    while i < data_len:
        # ASCII text run
        m_ascii = re.match(rb'[\x20-\x7E\r\n\t]{3,}', data[i:])
        if m_ascii:
            try:
                pieces.append(m_ascii.group(0).decode("latin1", errors="ignore"))
            except Exception:
                pass
            i += len(m_ascii.group(0))
            continue
        # UTF-16 text run
        m_uni = re.match(rb'(?:[\x20-\x7E][\x00]){3,}', data[i:])
        if m_uni:
            try:
                pieces.append(m_uni.group(0).decode("utf-16le", errors="ignore"))
            except Exception:
                pass
            i += len(m_uni.group(0))
            continue
        i += 1

    clean_pieces = [p.strip() for p in pieces if len(p.strip()) > 3]
    return "\n\n".join(clean_pieces)

def extract_pdf(filepath: Path, slug: str) -> tuple[bool, int, str, list[str]]:
    """
    Returns (is_scanned, page_count, extracted_text, list_of_image_paths)
    """
    reader = pypdf.PdfReader(filepath)
    num_pages = len(reader.pages)
    page_texts = []

    for p in reader.pages:
        try:
            pt = p.extract_text() or ""
            page_texts.append(pt.strip())
        except Exception:
            page_texts.append("")

    total_chars = sum(len(t) for t in page_texts)
    # Check if scanned: if average chars per page < 80, it's a scanned PDF
    if total_chars < 80 * num_pages:
        # Scanned PDF: extract page images
        image_paths = []
        for p_idx, page in enumerate(reader.pages):
            img_rel_path = f"{slug}_p{p_idx}.jpg"
            img_full_path = IMAGES_DIR / img_rel_path

            if not img_full_path.exists():
                if page.images and len(page.images) > 0:
                    img_obj = page.images[0]
                    with open(img_full_path, "wb") as f_img:
                        f_img.write(img_obj.data)
                else:
                    print(f"Warning: No image found on page {p_idx} of {filepath}")
            
            image_paths.append(str(img_full_path.as_posix()))

        return True, num_pages, "", image_paths
    else:
        # Digital text PDF
        full_text = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
        return False, num_pages, full_text, []

def main():
    print(f"Initializing extract_raw.py...")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    divisions = sorted([d for d in os.listdir(BASE_DOCS_DIR) if (BASE_DOCS_DIR / d).is_dir()])
    print(f"Found {len(divisions)} division folders in {BASE_DOCS_DIR}.")

    extracted_records = []
    scanned_count = 0
    digital_pdf_count = 0
    docx_count = 0
    doc_count = 0
    total_files = 0

    for div in divisions:
        div_path = BASE_DOCS_DIR / div
        for root, dirs, files in os.walk(div_path):
            for file in sorted(files):
                total_files += 1
                fp = Path(root) / file
                rel_path = fp.relative_to(BASE_DOCS_DIR).as_posix()
                ext = fp.suffix.lower()
                size_bytes = fp.stat().st_size
                sha256 = compute_sha256(fp)
                slug = f"{div}__{slugify(file)}"

                is_clinical = True
                exclusion_reason = None
                doc_type = "PPK"
                if "CP_" in file or "CPW_" in file or "CLINICAL PATHWAY" in file.upper():
                    doc_type = "CLINICAL_PATHWAY"
                elif "KEMOTERAPI" in file.upper() or "PROTOKOL" in file.upper():
                    doc_type = "CHEMO_PROTOCOL"

                # Check non-clinical outlier
                if file == "KRITERIA 2.docx":
                    is_clinical = False
                    exclusion_reason = "Non-clinical FK Unud residency accreditation and curriculum borang (Permendiktisaintek 39/2025); zero clinical practice or therapeutic guidance."

                if ext == ".docx":
                    docx_count += 1
                    raw_text, tables = extract_docx(fp)
                    record = {
                        "division": div,
                        "rel_path": rel_path,
                        "filename": file,
                        "format": "docx",
                        "doc_type": doc_type,
                        "size_bytes": size_bytes,
                        "sha256": sha256,
                        "is_scanned": False,
                        "is_clinical": is_clinical,
                        "exclusion_reason": exclusion_reason,
                        "page_count": 1,
                        "text": raw_text,
                        "page_images": [],
                        "char_count": len(raw_text)
                    }
                    extracted_records.append(record)
                    print(f"[{total_files}/122] DOCX: {rel_path} ({len(raw_text)} chars)")

                elif ext == ".doc":
                    doc_count += 1
                    raw_text = extract_legacy_doc(fp)
                    record = {
                        "division": div,
                        "rel_path": rel_path,
                        "filename": file,
                        "format": "doc",
                        "doc_type": doc_type,
                        "size_bytes": size_bytes,
                        "sha256": sha256,
                        "is_scanned": False,
                        "is_clinical": is_clinical,
                        "exclusion_reason": exclusion_reason,
                        "page_count": 1,
                        "text": raw_text,
                        "page_images": [],
                        "char_count": len(raw_text)
                    }
                    extracted_records.append(record)
                    print(f"[{total_files}/122] DOC: {rel_path} ({len(raw_text)} chars)")

                elif ext == ".pdf":
                    is_scanned, pages, text, img_paths = extract_pdf(fp, slug)
                    if is_scanned:
                        scanned_count += 1
                        record = {
                            "division": div,
                            "rel_path": rel_path,
                            "filename": file,
                            "format": "pdf",
                            "doc_type": doc_type,
                            "size_bytes": size_bytes,
                            "sha256": sha256,
                            "is_scanned": True,
                            "is_clinical": is_clinical,
                            "exclusion_reason": exclusion_reason,
                            "page_count": pages,
                            "text": "",
                            "page_images": img_paths,
                            "char_count": 0
                        }
                        extracted_records.append(record)
                        print(f"[{total_files}/122] Scanned PDF: {rel_path} ({pages} pages, {len(img_paths)} images)")
                    else:
                        digital_pdf_count += 1
                        record = {
                            "division": div,
                            "rel_path": rel_path,
                            "filename": file,
                            "format": "pdf",
                            "doc_type": doc_type,
                            "size_bytes": size_bytes,
                            "sha256": sha256,
                            "is_scanned": False,
                            "is_clinical": is_clinical,
                            "exclusion_reason": exclusion_reason,
                            "page_count": pages,
                            "text": text,
                            "page_images": [],
                            "char_count": len(text)
                        }
                        extracted_records.append(record)
                        print(f"[{total_files}/122] Digital PDF: {rel_path} ({pages} pages, {len(text)} chars)")

    print(f"\nExtraction complete!")
    print(f"Total files processed: {len(extracted_records)}")
    print(f"Digital PDFs: {digital_pdf_count}")
    print(f"Scanned PDFs: {scanned_count}")
    print(f"DOCX files: {docx_count}")
    print(f"DOC files: {doc_count}")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(extracted_records, f, indent=2, ensure_ascii=False)

    print(f"Saved raw extraction cache to {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
