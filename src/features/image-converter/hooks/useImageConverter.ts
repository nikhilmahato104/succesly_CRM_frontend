import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { MAX_FILES } from "../config";
import { createImageEngine, isCancelled, type ImageEngine } from "../services/imageEngine";
import { fileFingerprint, formatLabel, isGif, precheckFile } from "../utils/files";
import type {
  BatchState, ConverterItem, ConverterSettings, EncodeOptions, EncodeProgress, EncodeResult, ItemStatus,
} from "../types";

// ── State ──────────────────────────────────────────────────────────────────────

interface RunProgress { total: number; finished: number }

interface State {
  items: ConverterItem[];
  batch: BatchState;
  /** Counts for the current / most recent run (drives the batch progress bar) */
  run:   RunProgress | null;
}

type DoneResult = NonNullable<ConverterItem["result"]>;

type Action =
  | { type: "add";       items: ConverterItem[] }
  | { type: "probed";    id: string; width: number; height: number; thumbnailUrl: string | null; queue: boolean }
  | { type: "invalid";   id: string; error: string }
  | { type: "queue";     ids: string[] }
  | { type: "start";     id: string }
  | { type: "progress";  id: string; progress: EncodeProgress }
  | { type: "done";      id: string; result: DoneResult }
  | { type: "failed";    id: string; error: string }
  | { type: "cancelled"; ids: string[] }
  | { type: "remove";    ids: string[] }
  | { type: "clear" }
  | { type: "override";  id: string; kb: number | null }
  | { type: "batch";     batch: BatchState };

const IN_RUN: ItemStatus[] = ["queued", "processing"];

const patch = (items: ConverterItem[], id: string, fn: (i: ConverterItem) => Partial<ConverterItem>) =>
  items.map(i => (i.id === id ? { ...i, ...fn(i) } : i));

/** Marks one run slot finished when an item leaves queued/processing */
const finishOne = (state: State, id: string): RunProgress | null => {
  const item = state.items.find(i => i.id === id);
  if (!state.run || !item || !IN_RUN.includes(item.status)) return state.run;
  return { ...state.run, finished: state.run.finished + 1 };
};

const addToRun = (state: State, n: number): RunProgress =>
  state.run ? { ...state.run, total: state.run.total + n } : { total: n, finished: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add":
      return { ...state, items: [...state.items, ...action.items] };

    case "probed": {
      if (!state.items.some(i => i.id === action.id)) return state;
      return {
        ...state,
        run:   action.queue ? addToRun(state, 1) : state.run,
        items: patch(state.items, action.id, () => ({
          width: action.width, height: action.height, thumbnailUrl: action.thumbnailUrl,
          status: action.queue ? "queued" : "ready",
        })),
      };
    }

    case "invalid":
      return { ...state, items: patch(state.items, action.id, () => ({ status: "invalid", error: action.error })) };

    case "queue": {
      const ids = new Set(action.ids);
      return {
        ...state,
        run:   addToRun(state, ids.size),
        items: state.items.map(i => (ids.has(i.id) ? { ...i, status: "queued", progress: null, result: null, error: null } : i)),
      };
    }

    case "start":
      return { ...state, items: patch(state.items, action.id, () => ({ status: "processing", progress: null })) };

    case "progress":
      return { ...state, items: patch(state.items, action.id, () => ({ progress: action.progress })) };

    case "done":
      return {
        ...state,
        run:   finishOne(state, action.id),
        items: patch(state.items, action.id, () => ({ status: "done", result: action.result, progress: null, error: null })),
      };

    case "failed":
      return {
        ...state,
        run:   finishOne(state, action.id),
        items: patch(state.items, action.id, () => ({ status: "error", error: action.error, progress: null })),
      };

    case "cancelled": {
      let next = state;
      for (const id of action.ids) {
        const item = next.items.find(i => i.id === id);
        if (!item || !IN_RUN.includes(item.status)) continue;
        next = { ...next, run: finishOne(next, id), items: patch(next.items, id, () => ({ status: "cancelled", progress: null })) };
      }
      return next;
    }

    case "remove": {
      const ids = new Set(action.ids);
      const inRun = state.items.filter(i => ids.has(i.id) && IN_RUN.includes(i.status)).length;
      return {
        ...state,
        run:   state.run && inRun ? { ...state.run, total: Math.max(0, state.run.total - inRun) } : state.run,
        items: state.items.filter(i => !ids.has(i.id)),
      };
    }

    case "clear":
      return { items: [], batch: "idle", run: null };

    case "override":
      return { ...state, items: patch(state.items, action.id, () => ({ targetKbOverride: action.kb })) };

    case "batch":
      // idle → running starts a fresh run counter
      return {
        ...state,
        batch: action.batch,
        run:   state.batch === "idle" && action.batch === "running" ? { total: 0, finished: 0 } : state.run,
      };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let seq = 0;
const newId = () => `img-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Conversion failed.");

const revokeFrom = (urls: Map<string, string>, id: string) => {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
};

function makeItem(file: File): ConverterItem {
  const precheck = precheckFile(file);
  return {
    id: newId(), file, name: file.name, size: file.size, format: formatLabel(file),
    width: null, height: null, thumbnailUrl: null,
    status: precheck ? "invalid" : "probing",
    targetKbOverride: null, progress: null, result: null,
    error: precheck,
    warning: isGif(file) ? "GIF: only the first frame is converted — animation is not preserved." : null,
  };
}

export type EngineStatus =
  | { state: "loading" }
  | { state: "ready"; kind: ImageEngine["kind"] }
  | { state: "unsupported"; message: string };

export interface AddFilesReport { added: number; duplicates: number; overflow: number }

export interface BatchSummary { met: number; exceeded: number; failed: number }

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Owns the converter's queue: probing, encoding with bounded concurrency,
 * pause / resume / cancel, retry, and every object URL it creates.
 * All state is local to the feature — nothing touches Redux.
 */
export function useImageConverter(settings: ConverterSettings, onBatchFinished?: (s: BatchSummary) => void) {
  const [state, dispatch] = useReducer(reducer, { items: [], batch: "idle", run: null });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ state: "loading" });

  const engineRef      = useRef<Promise<ImageEngine> | null>(null);
  const itemsRef       = useRef(state.items);
  const settingsRef    = useRef(settings);
  const batchRef       = useRef<BatchState>("idle");
  const queueRef       = useRef<string[]>([]);
  const encodingRef    = useRef(new Set<string>());                 // ids currently encoding
  const probingRef     = useRef(new Set<string>());                 // ids currently probing
  const naturalEndRef  = useRef(false);                             // batch drained (not cancelled)
  const controllersRef = useRef(new Map<string, AbortController>()); // in-flight probe/encode
  const fingerprintsRef = useRef(new Map<string, string>());         // id → fingerprint (dedupe + count)
  const thumbUrlsRef   = useRef(new Map<string, string>());
  const resultUrlsRef  = useRef(new Map<string, string>());
  const finishedRef    = useRef(onBatchFinished);

  useLayoutEffect(() => {
    itemsRef.current    = state.items;
    settingsRef.current = settings;
    finishedRef.current = onBatchFinished;
  });

  // ── Engine lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const controllers = controllersRef.current;
    const thumbs      = thumbUrlsRef.current;
    const results     = resultUrlsRef.current;
    const promise     = createImageEngine(settingsRef.current.concurrency);
    engineRef.current = promise;
    let alive = true;
    promise.then(
      engine => alive && setEngineStatus({ state: "ready", kind: engine.kind }),
      err    => alive && setEngineStatus({ state: "unsupported", message: errorMessage(err) }),
    );
    return () => {
      alive = false;
      batchRef.current = "idle";
      controllers.forEach(c => c.abort());
      controllers.clear();
      promise.then(engine => engine.dispose(), () => undefined);
      thumbs.forEach(url => URL.revokeObjectURL(url));
      results.forEach(url => URL.revokeObjectURL(url));
      thumbs.clear();
      results.clear();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.then(engine => engine.setConcurrency(settings.concurrency), () => undefined);
  }, [settings.concurrency]);

  const setBatch = useCallback((batch: BatchState) => {
    batchRef.current = batch;
    dispatch({ type: "batch", batch });
  }, []);

  // ── Queue pump ───────────────────────────────────────────────────────────────
  const pumpRef = useRef<() => void>(() => undefined);

  const encodeOne = useCallback(async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item || !engineRef.current) return;

    const s = settingsRef.current;
    const targetBytes = Math.round((item.targetKbOverride ?? s.targetKb) * 1024);
    const options: EncodeOptions = {
      targetBytes, mode: s.mode, minQuality: s.minQuality, maxQuality: s.maxQuality,
      minDimension: s.minDimension, maxDimension: s.maxDimension,
    };

    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    encodingRef.current.add(id);
    dispatch({ type: "start", id });

    try {
      const engine = await engineRef.current;
      const result: EncodeResult = await engine.encode(
        item.file, options, progress => dispatch({ type: "progress", id, progress }), controller.signal,
      );
      if (!fingerprintsRef.current.has(id)) return;               // removed meanwhile
      const url = URL.createObjectURL(result.blob);
      resultUrlsRef.current.set(id, url);
      dispatch({ type: "done", id, result: { ...result, url, targetBytes } });
    } catch (err) {
      if (isCancelled(err) || controller.signal.aborted) dispatch({ type: "cancelled", ids: [id] });
      else dispatch({ type: "failed", id, error: errorMessage(err) });
    } finally {
      controllersRef.current.delete(id);
      encodingRef.current.delete(id);
      pumpRef.current();
    }
  }, []);

  const pump = useCallback(() => {
    if (batchRef.current === "idle") return;

    while (batchRef.current === "running" && queueRef.current.length && encodingRef.current.size < settingsRef.current.concurrency) {
      void encodeOne(queueRef.current.shift()!);
    }

    // Done once nothing is queued, encoding, or still being read in (those join on arrival)
    if (!queueRef.current.length && !encodingRef.current.size && !probingRef.current.size) {
      naturalEndRef.current = true;
      setBatch("idle");
    }
  }, [encodeOne, setBatch]);

  useLayoutEffect(() => { pumpRef.current = pump; }, [pump]);

  useEffect(() => { pump(); }, [settings.concurrency, pump]);

  // Report a batch that drained by itself — this render already holds the last result
  useEffect(() => {
    if (state.batch !== "idle" || !naturalEndRef.current) return;
    naturalEndRef.current = false;
    finishedRef.current?.({
      met:      state.items.filter(i => i.status === "done" && i.result?.targetMet).length,
      exceeded: state.items.filter(i => i.status === "done" && i.result && !i.result.targetMet).length,
      failed:   state.items.filter(i => i.status === "error").length,
    });
  }, [state.batch, state.items]);

  const enqueue = useCallback((ids: string[]) => {
    if (!ids.length) return;
    ids.forEach(id => revokeFrom(resultUrlsRef.current, id));
    if (batchRef.current === "idle") setBatch("running");   // before "queue" so the run counter is fresh
    queueRef.current.push(...ids);
    dispatch({ type: "queue", ids });
    pump();
  }, [pump, setBatch]);

  // ── Probing ──────────────────────────────────────────────────────────────────
  const probe = useCallback(async (item: ConverterItem) => {
    if (!engineRef.current) return;
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);
    probingRef.current.add(item.id);
    try {
      const engine = await engineRef.current;
      const res = await engine.probe(item.file, controller.signal);
      if (!fingerprintsRef.current.has(item.id)) return;
      const thumbnailUrl = res.thumbnail ? URL.createObjectURL(res.thumbnail) : null;
      if (thumbnailUrl) thumbUrlsRef.current.set(item.id, thumbnailUrl);
      // Images that finish loading while a batch is active join it automatically
      const queue = batchRef.current !== "idle";
      dispatch({ type: "probed", id: item.id, width: res.width, height: res.height, thumbnailUrl, queue });
      if (queue) queueRef.current.push(item.id);
    } catch (err) {
      if (!isCancelled(err)) dispatch({ type: "invalid", id: item.id, error: errorMessage(err) });
    } finally {
      if (controllersRef.current.get(item.id) === controller) controllersRef.current.delete(item.id);
      probingRef.current.delete(item.id);
      pump();
    }
  }, [pump]);

  // ── Public actions ───────────────────────────────────────────────────────────
  const addFiles = useCallback((files: File[]): AddFilesReport => {
    const known = new Set(fingerprintsRef.current.values());
    const fresh: ConverterItem[] = [];
    let duplicates = 0;
    let overflow = 0;

    for (const file of files) {
      const fp = fileFingerprint(file);
      if (known.has(fp)) { duplicates++; continue; }
      if (fingerprintsRef.current.size >= MAX_FILES) { overflow++; continue; }
      const item = makeItem(file);
      known.add(fp);
      fingerprintsRef.current.set(item.id, fp);
      fresh.push(item);
    }

    if (fresh.length) {
      dispatch({ type: "add", items: fresh });
      fresh.filter(i => i.status === "probing").forEach(i => void probe(i));
    }
    return { added: fresh.length, duplicates, overflow };
  }, [probe]);

  const start = useCallback(() => {
    const ids = itemsRef.current.filter(i => i.status === "ready" || i.status === "cancelled").map(i => i.id);
    if (ids.length) enqueue(ids);
    else if (probingRef.current.size && batchRef.current === "idle") setBatch("running");  // they join as they load
  }, [enqueue, setBatch]);

  /** Re-runs every finished, failed or cancelled image with the current settings */
  const reconvertAll = useCallback(() => {
    enqueue(itemsRef.current.filter(i => ["ready", "done", "error", "cancelled"].includes(i.status)).map(i => i.id));
  }, [enqueue]);

  const retry = useCallback((id: string) => enqueue([id]), [enqueue]);

  const retryFailed = useCallback(() => {
    enqueue(itemsRef.current.filter(i => i.status === "error").map(i => i.id));
  }, [enqueue]);

  const pause = useCallback(() => {
    if (batchRef.current === "running") setBatch("paused");
  }, [setBatch]);

  const resume = useCallback(() => {
    if (batchRef.current !== "paused") return;
    setBatch("running");
    pump();
  }, [pump, setBatch]);

  /** Stops the batch: queued images are cancelled, in-flight encodes are aborted */
  const cancel = useCallback(() => {
    const queued = queueRef.current;
    queueRef.current = [];
    batchRef.current = "idle";
    dispatch({ type: "cancelled", ids: queued });
    encodingRef.current.forEach(id => controllersRef.current.get(id)?.abort());
    setBatch("idle");
  }, [setBatch]);

  const removeIds = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const set = new Set(ids);
    queueRef.current = queueRef.current.filter(id => !set.has(id));
    ids.forEach(id => {
      controllersRef.current.get(id)?.abort();
      fingerprintsRef.current.delete(id);
      probingRef.current.delete(id);
      revokeFrom(resultUrlsRef.current, id);
      revokeFrom(thumbUrlsRef.current, id);
    });
    dispatch({ type: "remove", ids });
    pump();
  }, [pump]);

  const remove = useCallback((id: string) => removeIds([id]), [removeIds]);

  const removeInvalid = useCallback(() => {
    removeIds(itemsRef.current.filter(i => i.status === "invalid").map(i => i.id));
  }, [removeIds]);

  const clearAll = useCallback(() => {
    queueRef.current = [];
    batchRef.current = "idle";
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current.clear();
    probingRef.current.clear();
    encodingRef.current.clear();
    resultUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    thumbUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    resultUrlsRef.current.clear();
    thumbUrlsRef.current.clear();
    fingerprintsRef.current.clear();
    dispatch({ type: "clear" });
  }, []);

  const setOverride = useCallback((id: string, kb: number | null) => dispatch({ type: "override", id, kb }), []);

  /** Stable lookup for event handlers, so memoised cards don't re-render on every progress tick */
  const getItem = useCallback((id: string) => itemsRef.current.find(i => i.id === id), []);

  // ── Derived counts ───────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { total: 0, probing: 0, ready: 0, invalid: 0, queued: 0, processing: 0, done: 0, error: 0, cancelled: 0, met: 0, exceeded: 0, originalBytes: 0, outputBytes: 0 };
    for (const i of state.items) {
      c.total++;
      c[i.status]++;
      if (i.status === "done" && i.result) {
        if (i.result.targetMet) c.met++; else c.exceeded++;
        c.originalBytes += i.size;
        c.outputBytes   += i.result.size;
      }
    }
    return c;
  }, [state.items]);

  return {
    items: state.items, batch: state.batch, run: state.run, counts, engineStatus,
    addFiles, start, reconvertAll, retry, retryFailed, pause, resume, cancel,
    remove, removeInvalid, clearAll, setOverride, getItem,
  };
}

export type ImageConverterApi = ReturnType<typeof useImageConverter>;
