import { useEffect, useState } from "react";
import type { HealthStatus } from "../types";
import { fetchHealth } from "../utils/api";

export function useHealth(pollMs = 5000) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const h = await fetchHealth();
        if (!cancelled) {
          setHealth(h);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { health, error, loading };
}
