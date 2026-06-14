import { useEffect, useState } from "react";

export type LayoutMode = "comfortable" | "compact";

const KEY = "uttm_layout_mode_v1";
const EV  = "uttm_layout_mode_change";

export const useLayoutMode = (): [LayoutMode, (m: LayoutMode) => void] => {
  const [mode, setMode] = useState<LayoutMode>(
    () => (localStorage.getItem(KEY) as LayoutMode | null) ?? "comfortable"
  );

  const apply = (m: LayoutMode) => {
    localStorage.setItem(KEY, m);
    window.dispatchEvent(new CustomEvent(EV, { detail: m }));
  };

  useEffect(() => {
    const handler = (e: Event) => setMode((e as CustomEvent<LayoutMode>).detail);
    window.addEventListener(EV, handler as EventListener);
    return () => window.removeEventListener(EV, handler as EventListener);
  }, []);

  return [mode, apply];
};
