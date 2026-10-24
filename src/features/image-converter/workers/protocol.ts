import type { EncodeOptions, EncodeProgress, EncodeResult, ProbeResult } from "../types";

/** Main thread → worker */
export type WorkerRequest =
  | { type: "capabilities"; id: number }
  | { type: "probe";        id: number; file: Blob }
  | { type: "encode";       id: number; file: Blob; options: EncodeOptions }
  | { type: "cancel";       id: number };

/** Worker → main thread */
export type WorkerResponse =
  | { type: "capabilities"; id: number; webp: boolean }
  | { type: "probe";        id: number; result: ProbeResult }
  | { type: "encode";       id: number; result: EncodeResult }
  | { type: "progress";     id: number; progress: EncodeProgress }
  | { type: "error";        id: number; message: string; cancelled: boolean };
