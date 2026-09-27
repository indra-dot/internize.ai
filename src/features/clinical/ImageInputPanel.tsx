import { Camera, CheckCircle, FileImage, Loader2, UploadCloud, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OcrProgressEvent, OcrResult } from '../../services/ocr/tesseractOCR';
// Import only lightweight utilities statically; the heavy extractTextFromImage is lazy-imported in processImageFile
import { fileToDataUrl, readImageFromClipboard } from '../../services/ocr/tesseractOCR';
import { Button } from '../../components/ui/Button';

export interface ImageInputPanelProps {
  onTextExtracted: (text: string, confidence: number) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  className?: string;
}

type PanelState = 'idle' | 'preview' | 'processing' | 'done';

export const ImageInputPanel: React.FC<ImageInputPanelProps> = ({
  onTextExtracted,
  onShowToast,
  className = '',
}) => {
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<OcrProgressEvent | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl+V paste globally while component is mounted
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (file) await processImageFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processImageFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      onShowToast?.('Hanya file gambar yang didukung (JPG, PNG, WebP)', 'warning');
      return;
    }
    // Max 20 MB
    if (file.size > 20 * 1024 * 1024) {
      onShowToast?.('Ukuran file terlalu besar (maks. 20 MB)', 'warning');
      return;
    }

    // Show preview
    const dataUrl = await fileToDataUrl(file);
    setPreviewUrl(dataUrl);
    setPanelState('processing');
    setOcrResult(null);
    setProgress({ status: 'loading', message: 'Memuat engine OCR…' });

    try {
      // Lazy import — only loads Tesseract.js when needed
      const { extractTextFromImage } = await import('../../services/ocr/tesseractOCR');

      const result = await extractTextFromImage(file, (evt) => {
        setProgress(evt);
      });

      setOcrResult(result);
      setPanelState('done');

      if (result.text.length < 10) {
        onShowToast?.('Teks tidak terdeteksi. Coba foto dengan kualitas lebih baik.', 'warning');
      } else {
        onShowToast?.(
          `OCR selesai — kepercayaan: ${result.confidence}% (${result.durationMs}ms)`,
          result.confidence >= 70 ? 'success' : 'warning',
        );
      }
    } catch (err) {
      console.error('[internize.ai] OCR error:', err);
      onShowToast?.('Gagal memproses gambar. Coba lagi.', 'error');
      setPanelState('preview');
    }
  }, [onShowToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handlePasteFromClipboard = async () => {
    const file = await readImageFromClipboard();
    if (file) {
      processImageFile(file);
    } else {
      onShowToast?.('Tidak ada gambar di clipboard. Coba Ctrl+V saat fokus di panel ini.', 'info');
    }
  };

  const handleUseText = () => {
    if (ocrResult?.text) {
      onTextExtracted(ocrResult.text, ocrResult.confidence);
      onShowToast?.('Teks hasil OCR sudah dimasukkan ke form analisis', 'success');
    }
  };

  const handleReset = () => {
    setPanelState('idle');
    setPreviewUrl(null);
    setOcrResult(null);
    setProgress(null);
  };

  return (
    <div className={`rounded-lg border border-dashed border-slate-300 bg-slate-50/60 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/80">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-violet-600" />
          <span className="text-xs font-bold text-slate-700">Upload Foto / Gambar (OCR)</span>
        </div>
        <span className="text-[10px] text-slate-400">JPG · PNG · WebP</span>
      </div>

      {/* Content */}
      <div className="p-3">
        {panelState === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center gap-2 py-5 rounded-lg cursor-pointer transition-colors ${
              isDragging
                ? 'bg-violet-50 border-2 border-violet-400'
                : 'hover:bg-violet-50/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload foto hasil lab"
          >
            <UploadCloud
              className={`w-7 h-7 ${isDragging ? 'text-violet-500' : 'text-slate-400'}`}
            />
            <div className="text-center">
              <p className="text-[11px] font-semibold text-slate-600">
                Drag & drop foto, atau klik untuk memilih
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Atau tekan <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">Ctrl+V</kbd> untuk paste screenshot
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handlePasteFromClipboard();
              }}
              className="text-[10px] text-violet-600 h-6 px-2 gap-1"
            >
              <FileImage className="w-3 h-3" />
              Paste dari Clipboard
            </Button>
          </div>
        )}

        {(panelState === 'preview' || panelState === 'processing' || panelState === 'done') &&
          previewUrl && (
            <div className="space-y-2">
              {/* Image Preview */}
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Pratinjau gambar"
                  className="w-full max-h-40 object-contain rounded-lg border border-slate-200 bg-white"
                />
                {panelState !== 'processing' && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="absolute top-1 right-1 w-5 h-5 bg-slate-700/70 hover:bg-slate-900 text-white rounded-full flex items-center justify-center"
                    title="Hapus gambar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Processing State */}
              {panelState === 'processing' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                    <span className="text-[11px] text-slate-600">
                      {progress?.message ?? 'Memproses…'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1">
                    <div
                      className="bg-violet-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((progress?.progress ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Done State */}
              {panelState === 'done' && ocrResult && (
                <div className="space-y-2">
                  {/* Confidence badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-semibold text-emerald-700">
                        OCR Selesai
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${
                        ocrResult.confidence >= 80
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ocrResult.confidence >= 60
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {ocrResult.confidence}% akurat
                    </span>
                  </div>

                  {/* Extracted text preview */}
                  <div className="bg-white rounded border border-slate-200 p-2 max-h-24 overflow-y-auto">
                    <p className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {ocrResult.text.slice(0, 400)}
                      {ocrResult.text.length > 400 && '…'}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleUseText}
                      className="flex-1 text-xs font-semibold h-7 gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Gunakan Teks Ini
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="text-xs text-slate-500 h-7 px-2"
                    >
                      Ganti
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/bmp,image/tiff"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload gambar"
      />
    </div>
  );
};

export default ImageInputPanel;
