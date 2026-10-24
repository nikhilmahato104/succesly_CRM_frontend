import { offscreenBackend } from "../services/canvasBackends";
import { CancelledError, encodeToTarget, probeImage, supportsWebpEncoding } from "../services/compression";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/**
 * Decodes and encodes images off the main thread with OffscreenCanvas.
 * Each worker runs one job at a time; the pool decides how many workers exist.
 */

// The app compiles against the DOM lib; adding the WebWorker lib would clash
// with it project-wide, so describe only the bits of the worker scope we use.
interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const cancelled = new Set<number>();

const reply = (msg: WorkerResponse) => scope.postMessage(msg);

const fail = (id: number, err: unknown) => {
  const isCancel = err instanceof CancelledError;
  reply({
    type: "error",
    id,
    cancelled: isCancel,
    message: isCancel ? "Cancelled" : err instanceof Error ? err.message : "Conversion failed.",
  });
};

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case "cancel":
      cancelled.add(msg.id);
      return;

    case "capabilities":
      reply({ type: "capabilities", id: msg.id, webp: await supportsWebpEncoding(offscreenBackend) });
      return;

    case "probe":
      try {
        reply({ type: "probe", id: msg.id, result: await probeImage(offscreenBackend, msg.file) });
      } catch (err) {
        fail(msg.id, err);
      }
      return;

    case "encode":
      try {
        const result = await encodeToTarget(offscreenBackend, msg.file, msg.options, {
          onProgress:  (progress) => reply({ type: "progress", id: msg.id, progress }),
          isCancelled: () => cancelled.has(msg.id),
        });
        reply({ type: "encode", id: msg.id, result });
      } catch (err) {
        fail(msg.id, err);
      } finally {
        cancelled.delete(msg.id);
      }
      return;
  }
};
