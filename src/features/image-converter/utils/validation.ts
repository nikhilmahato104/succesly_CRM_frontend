import { MAX_TARGET_KB, MIN_TARGET_KB } from "../config";

/** Returns an error message for a KB target typed by the user, or null if valid */
export function validateTargetKb(raw: string): string | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n)) return "Enter a size in KB.";
  if (n < MIN_TARGET_KB || n > MAX_TARGET_KB) return `Use ${MIN_TARGET_KB}–${MAX_TARGET_KB.toLocaleString()} KB.`;
  return null;
}
