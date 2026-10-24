import { CancelledError } from "./compression";
import type { EncodeProgress } from "../types";
import type { WorkerRequest, WorkerResponse } from "../workers/protocol";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A job request as callers pass it — the pool assigns the id */
type Payload = DistributiveOmit<Exclude<WorkerRequest, { type: "cancel" }>, "id">;

interface Job {
  id:          number;
  payload:     Payload;
  resolve:     (msg: WorkerResponse) => void;
  reject:      (err: Error) => void;
  onProgress?: (p: EncodeProgress) => void;
  signal?:     AbortSignal;
  onAbort?:    () => void;
}

interface Slot {
  worker: Worker;
  job:    Job | null;
}

const spawnWorker = () =>
  new Worker(new URL("../workers/imageConverter.worker.ts", import.meta.url), { type: "module" });

/**
 * Fixed-size pool of image workers. Jobs wait in a FIFO until a worker is
 * free; each worker runs one job at a time. A worker that crashes (e.g. out
 * of memory on a huge image) fails only its own job and is replaced.
 */
export class WorkerPool {
  private slots: Slot[] = [];
  private waiting: Job[] = [];
  private nextId = 1;
  private disposed = false;

  constructor(private size: number) {}

  resize(size: number): void {
    this.size = Math.max(1, size);
    // Idle extra workers are retired; busy ones finish their job first
    this.slots = this.slots.filter((slot, i) => {
      if (i < this.size || slot.job) return true;
      slot.worker.terminate();
      return false;
    });
    this.drain();
  }

  run(payload: Payload, opts: { onProgress?: (p: EncodeProgress) => void; signal?: AbortSignal } = {}): Promise<WorkerResponse> {
    if (this.disposed) return Promise.reject(new Error("The converter was closed."));
    if (opts.signal?.aborted) return Promise.reject(new CancelledError());

    return new Promise<WorkerResponse>((resolve, reject) => {
      const job: Job = { id: this.nextId++, payload, resolve, reject, onProgress: opts.onProgress, signal: opts.signal };
      if (opts.signal) {
        job.onAbort = () => this.cancel(job);
        opts.signal.addEventListener("abort", job.onAbort, { once: true });
      }
      this.waiting.push(job);
      this.drain();
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const job of this.waiting) this.settle(job, new CancelledError());
    this.waiting = [];
    for (const slot of this.slots) {
      if (slot.job) this.settle(slot.job, new CancelledError());
      slot.worker.terminate();
    }
    this.slots = [];
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private drain(): void {
    while (this.waiting.length) {
      let slot = this.slots.find(s => !s.job);
      if (!slot && this.slots.length < this.size) slot = this.addSlot();
      if (!slot) return;
      const job = this.waiting.shift()!;
      slot.job = job;
      slot.worker.postMessage({ ...job.payload, id: job.id } as WorkerRequest);
    }
  }

  private addSlot(): Slot {
    const slot: Slot = { worker: spawnWorker(), job: null };
    slot.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(slot, e.data);
    slot.worker.onerror = (e: ErrorEvent) => {
      e.preventDefault();
      this.onCrash(slot, e.message);
    };
    this.slots.push(slot);
    return slot;
  }

  private onMessage(slot: Slot, msg: WorkerResponse): void {
    const job = slot.job;
    if (!job || msg.id !== job.id) return;            // stale reply for a cancelled job
    if (msg.type === "progress") { job.onProgress?.(msg.progress); return; }

    slot.job = null;
    if (msg.type === "error") this.settle(job, msg.cancelled ? new CancelledError() : new Error(msg.message));
    else this.settle(job, null, msg);
    this.drain();
  }

  private onCrash(slot: Slot, message: string): void {
    slot.worker.terminate();
    this.slots = this.slots.filter(s => s !== slot);
    if (slot.job) {
      this.settle(slot.job, new Error(`The image worker stopped unexpectedly${message ? ` (${message})` : ""} — the image may be too large for available memory.`));
    }
    if (!this.disposed) this.drain();
  }

  private cancel(job: Job): void {
    const queued = this.waiting.indexOf(job);
    if (queued >= 0) {
      this.waiting.splice(queued, 1);
      this.settle(job, new CancelledError());
      return;
    }
    const slot = this.slots.find(s => s.job === job);
    if (slot) slot.worker.postMessage({ type: "cancel", id: job.id } satisfies WorkerRequest);
  }

  private settle(job: Job, err: Error | null, msg?: WorkerResponse): void {
    if (job.signal && job.onAbort) job.signal.removeEventListener("abort", job.onAbort);
    if (err) job.reject(err);
    else job.resolve(msg!);
  }
}
