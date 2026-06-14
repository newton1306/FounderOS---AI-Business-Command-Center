import { useEffect, useRef, useState } from "react";

export function useUpdatePulse(value: string, duration = 760) {
  const firstRender = useRef(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), duration);
    return () => window.clearTimeout(timeout);
  }, [value, duration]);

  return active;
}
