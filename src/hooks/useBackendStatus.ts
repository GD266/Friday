import { useEffect, useState } from "react";
import { tauriService } from "@/services/tauri";
import type { ConnectionState } from "@/types/chat";

/** Probes the Tauri backend once on mount; drives the header status pill. */
export function useBackendStatus(): ConnectionState {
  const [connection, setConnection] = useState<ConnectionState>("checking");

  useEffect(() => {
    let mounted = true;
    tauriService
      .getConnection()
      .then((state) => {
        if (mounted) {
          setConnection(state);
        }
      })
      .catch(() => {
        if (mounted) {
          setConnection("offline");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return connection;
}
