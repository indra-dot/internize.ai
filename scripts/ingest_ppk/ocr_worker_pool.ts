/**
 * ocr_worker_pool.ts — Offline Multi-Worker OCR Pool (internize.ai)
 * 
 * Manages a pool of 4-6 tesseract.js workers:
 * - 100% offline execution using project-root ind.traineddata + eng.traineddata.
 * - Concurrently processes scanned PDF page images.
 * - Integrates with PpkCacheManager so already-OCR'd documents are loaded in 0ms.
 * - Cleanly terminates all workers on completion.
 */

import path from 'path';
import { createWorker, Worker } from 'tesseract.js';
import { PpkCacheManager } from './cache_manager.js';

export interface OcrDocumentTask {
  slug: string;
  relPath: string;
  sha256: string;
  pageImages: string[];
}

export class OcrWorkerPool {
  private concurrency: number;
  private langPath: string;

  constructor(concurrency: number = 4) {
    this.concurrency = concurrency;
    this.langPath = path.resolve('.');
  }

  /**
   * Initializes a single offline worker configured with local ind+eng traineddata.
   */
  private async createSingleWorker(): Promise<Worker> {
    const worker = await createWorker('ind+eng', 1, {
      langPath: this.langPath,
      gzip: false
    });
    return worker;
  }

  /**
   * Processes all scanned document tasks using a worker pool.
   * Cached documents are skipped immediately.
   */
  public async processTasks(
    tasks: OcrDocumentTask[],
    cacheManager: PpkCacheManager,
    onProgress?: (completed: number, total: number, currentSlug: string) => void
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const pendingTasks: OcrDocumentTask[] = [];

    // 1. Separate cached vs pending
    for (const t of tasks) {
      if (cacheManager.isOcrCached(t.slug, t.sha256)) {
        const cachedText = cacheManager.getOcrText(t.slug);
        if (cachedText) {
          results.set(t.slug, cachedText);
          continue;
        }
      }
      pendingTasks.push(t);
    }

    const totalToOcr = pendingTasks.length;
    const alreadyCached = tasks.length - totalToOcr;
    console.log(`[OCR Pool] Total tasks: ${tasks.length} (Already cached: ${alreadyCached}, Pending OCR: ${totalToOcr})`);

    if (totalToOcr === 0) {
      return results;
    }

    // 2. Spawn worker pool
    const poolSize = Math.min(this.concurrency, totalToOcr);
    console.log(`[OCR Pool] Initializing ${poolSize} offline tesseract.js workers...`);
    const workers: Worker[] = [];
    for (let i = 0; i < poolSize; i++) {
      workers.push(await this.createSingleWorker());
    }
    console.log(`[OCR Pool] All ${poolSize} workers initialized successfully.`);

    // 3. Worker queue execution
    let completedCount = alreadyCached;
    let nextTaskIndex = 0;

    const workerLoop = async (worker: Worker, workerId: number): Promise<void> => {
      while (nextTaskIndex < pendingTasks.length) {
        const currentIndex = nextTaskIndex++;
        const task = pendingTasks[currentIndex];

        const startTime = Date.now();
        const pageTexts: string[] = [];

        for (let pIdx = 0; pIdx < task.pageImages.length; pIdx++) {
          const imgPath = task.pageImages[pIdx];
          try {
            const ret = await worker.recognize(imgPath);
            pageTexts.push(ret.data.text.trim());
          } catch (err) {
            console.error(`[Worker ${workerId}] Error OCRing ${imgPath}:`, err);
            pageTexts.push('');
          }
        }

        const fullText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

        // Save to cache immediately
        cacheManager.saveOcrResult(task.slug, task.relPath, task.sha256, task.pageImages.length, fullText);
        results.set(task.slug, fullText);

        completedCount++;
        console.log(
          `[OCR ${completedCount}/${tasks.length}] [Worker ${workerId}] ${task.relPath} ` +
          `(${task.pageImages.length} pages, ${fullText.length} chars, ${durationSec}s)`
        );

        if (onProgress) {
          onProgress(completedCount, tasks.length, task.slug);
        }
      }
    };

    try {
      await Promise.all(workers.map((w, id) => workerLoop(w, id + 1)));
    } finally {
      console.log(`[OCR Pool] Terminating all ${poolSize} workers...`);
      await Promise.all(workers.map(w => w.terminate()));
      console.log(`[OCR Pool] All workers terminated cleanly.`);
      cacheManager.saveManifest();
    }

    return results;
  }
}
