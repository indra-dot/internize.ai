/**
 * tesseractOCR.ts — On-Device OCR Engine (Tesseract.js WASM)
 * Extracts text from images (lab results, prescriptions, medical records) 100% locally.
 * Lazy-loaded to keep the initial bundle size minimal.
 * Supports: English (eng) + Indonesian (ind).
 */

export interface OcrResult {
  /** The extracted text, trimmed of leading/trailing whitespace */
  text: string;
  /** Overall confidence score 0–100 */
  confidence: number;
  /** Which languages were used */
  languages: string[];
  /** Processing time in milliseconds */
  durationMs: number;
}

export interface OcrProgressEvent {
  status: 'loading' | 'recognizing' | 'done' | 'error';
  /** Progress 0.0–1.0 during recognition */
  progress?: number;
  message?: string;
}

type OcrProgressCallback = (event: OcrProgressEvent) => void;

/**
 * Extracts text from an image file or data URL using Tesseract.js WASM.
 * The Tesseract worker is created fresh per call and terminated after use,
 * so memory is released immediately.
 *
 * @param imageSource - File, Blob, or base64 data URL (image/jpeg, image/png, image/webp)
 * @param onProgress  - Optional callback for real-time progress updates
 * @param languages   - Language codes to use, defaults to ['ind', 'eng']
 */
export async function extractTextFromImage(
  imageSource: File | Blob | string,
  onProgress?: OcrProgressCallback,
  languages: string[] = ['ind', 'eng'],
): Promise<OcrResult> {
  const t0 = performance.now();

  onProgress?.({ status: 'loading', message: 'Memuat engine OCR…' });

  // Dynamic import — Tesseract.js only loaded when this function is called
  const { createWorker } = await import('tesseract.js');

  onProgress?.({ status: 'recognizing', progress: 0, message: 'Memproses gambar…' });

  const worker = await createWorker(languages, 1, {
    logger: (m: { status: string; progress?: number; userJobId?: string }) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          status: 'recognizing',
          progress: m.progress ?? 0,
          message: `Mengekstrak teks… ${Math.round((m.progress ?? 0) * 100)}%`,
        });
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageSource);

    const durationMs = Math.round(performance.now() - t0);

    onProgress?.({ status: 'done', progress: 1, message: 'Selesai' });

    return {
      text: cleanOcrText(data.text),
      confidence: Math.round(data.confidence),
      languages,
      durationMs,
    };
  } finally {
    // Always terminate worker to free WASM memory
    await worker.terminate();
  }
}

/**
 * Cleans up common OCR artifacts and normalizes whitespace.
 */
function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')       // normalize line endings
    .replace(/\f/g, '\n')          // form feeds → newline
    .replace(/[ \t]+/g, ' ')       // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')    // collapse excessive blank lines
    .replace(/[|]{2,}/g, '')       // remove OCR column separators
    .trim();
}

/**
 * Converts a File or Blob to a base64 data URL for preview display.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Reads image data from the clipboard (for Ctrl+V paste support).
 * Returns the first image item found, or null if none.
 */
export async function readImageFromClipboard(): Promise<File | null> {
  if (!navigator.clipboard?.read) {
    return null;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        return new File([blob], `paste_${Date.now()}.png`, { type: imageType });
      }
    }
  } catch {
    // Clipboard access denied — user needs to grant permission
  }
  return null;
}
