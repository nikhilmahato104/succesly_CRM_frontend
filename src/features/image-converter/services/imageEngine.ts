import { domCanvasBackend, offscreenBackend } from "./canvasBackends";
import { CancelledError, encodeToTarget, probeImage, supportsWebpEncoding, type CanvasBackend } from "./compression";
import { WorkerPool } from "./workerPool";
import type { EncodeOptions, EncodeProgress, EncodeResult, ProbeResult } from "../types";

/**
 * One interface over the two ways images can be processed:
 *   "worker"      → Web Worker pool + OffscreenCanvas (UI thread stays free)
 *   "main-thread" → <canvas> on the UI thread, for browsers without
 *                   OffscreenCanvas WebP support in workers
 */
export interface ImageEngine {
  readonly kind: "worker" | "main-thread";
  probe(file: File, signal?: AbortSignal): Promise<ProbeResult>;
  encode(file: File, options: EncodeOptions, onProgress: (p: EncodeProgress) => void, signal?: AbortSignal): Promise<EncodeResult>;
  setConcurrency(n: number): void;
  dispose(): void;
}

export class WebpUnsupportedError extends Error {
  constructor() {
    super("This browser cannot encode WebP images (Safari currently can't). Please use a recent Chrome, Edge or Firefox.");
    this.name = "WebpUnsupportedError";
  }
}

export const isCancelled = (err: unknown): boolean => err instanceof CancelledError;

// ── Worker engine ──────────────────────────────────────────────────────────────

function workerEngine(pool: WorkerPool): ImageEngine {
  return {
    kind: "worker",
    async probe(file, signal) {
      const msg = await pool.run({ type: "probe", file }, { signal });
      if (msg.type !== "probe") throw new Error("Unexpected worker reply.");
      return msg.result;
    },
    async encode(file, options, onProgress, signal) {
      const msg = await pool.run({ type: "encode", file, options }, { signal, onProgress });
      if (msg.type !== "encode") throw new Error("Unexpected worker reply.");
      return msg.result;
    },
    setConcurrency: (n) => pool.resize(n),
    dispose: () => pool.dispose(),
  };
}

const PROBE_TIMEOUT_MS = 8000;

async function tryWorkerEngine(concurrency: number): Promise<ImageEngine | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  let pool: WorkerPool | null = null;
  try {
    pool = new WorkerPool(concurrency);
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS));
    const reply = await Promise.race([pool.run({ type: "capabilities" }), timeout]);
    if (reply?.type === "capabilities" && reply.webp) return workerEngine(pool);
  } catch {
    /* worker could not start (CSP, old browser) — fall back */
  }
  pool?.dispose();
  return null;
}

// ── Main-thread engine ─────────────────────────────────────────────────────────

/** Minimal semaphore so the main thread never decodes many images at once */
function createLimiter(initial: number) {
  let limit = initial;
  let active = 0;
  const waiting: Array<() => void> = [];
  const next = () => {
    while (active < limit && waiting.length) { active++; waiting.shift()!(); }
  };
  return {
    setLimit(n: number) { limit = Math.max(1, n); next(); },
    async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      await new Promise<void>(resolve => { waiting.push(resolve); next(); });
      try {
        if (signal?.aborted) throw new CancelledError();
        return await task();
      } finally {
        active--;
        next();
      }
    },
  };
}

/** Keeps the UI thread responsive: at most 2 images at a time on the main thread */
const MAIN_THREAD_MAX = 2;

function mainThreadEngine<S extends CanvasImageSource>(backend: CanvasBackend<S>, concurrency: number): ImageEngine {
  const limiter = createLimiter(Math.min(MAIN_THREAD_MAX, concurrency));
  let disposed = false;
  return {
    kind: "main-thread",
    probe: (file, signal) => limiter.run(() => probeImage(backend, file), signal),
    encode: (file, options, onProgress, signal) =>
      limiter.run(() => encodeToTarget(backend, file, options, {
        onProgress,
        isCancelled: () => disposed || !!signal?.aborted,
      }), signal),
    setConcurrency: (n) => limiter.setLimit(Math.min(MAIN_THREAD_MAX, n)),
    dispose: () => { disposed = true; },
  };
}

// ── Factory ────────────────────────────────────────────────────────────────────

export async function createImageEngine(concurrency: number): Promise<ImageEngine> {
  const viaWorker = await tryWorkerEngine(concurrency);
  if (viaWorker) return viaWorker;

  if (typeof OffscreenCanvas !== "undefined" && (await supportsWebpEncoding(offscreenBackend))) {
    return mainThreadEngine(offscreenBackend, concurrency);
  }
  if (await supportsWebpEncoding(domCanvasBackend)) {
    return mainThreadEngine(domCanvasBackend, concurrency);
  }
  throw new WebpUnsupportedError();
}
