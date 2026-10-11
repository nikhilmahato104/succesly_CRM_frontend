import { useEffect, useState } from "react";

/** Same breakpoint as DashboardLayout — below it the mobile bottom bar is shown */
export const MOBILE_BREAKPOINT = 1024;

/** Space to leave under scrollable content so the fixed bottom bar never covers it */
export const MOBILE_BOTTOM_SPACE = 96;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}
