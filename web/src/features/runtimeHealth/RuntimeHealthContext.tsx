import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setApiMutationSafety } from "../../services/api/apiClient";
import {
  createRuntimeHealthMonitor,
  INITIAL_RUNTIME_HEALTH,
  runtimeAllowsMutations,
  type RuntimeHealthState,
} from "./runtimeHealth";

type RuntimeHealthContextValue = {
  state: RuntimeHealthState;
  retry: () => void;
};

const RuntimeHealthContext = createContext<RuntimeHealthContextValue | undefined>(undefined);

// Fail closed before descendant effects can attempt startup persistence. The
// shell monitor opens this gate only after the active API and SQLite both pass.
setApiMutationSafety({ allowed: false, state: "connecting" });

export function RuntimeHealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RuntimeHealthState>(INITIAL_RUNTIME_HEALTH);
  const monitorRef = useRef<ReturnType<typeof createRuntimeHealthMonitor> | null>(null);

  useEffect(() => {
    setApiMutationSafety({ allowed: false, state: "connecting" });
    const monitor = createRuntimeHealthMonitor({
      onState: (next) => {
        setState(next);
        setApiMutationSafety({ allowed: runtimeAllowsMutations(next), state: next.phase });
      },
    });
    monitorRef.current = monitor;
    monitor.start();
    return () => {
      monitor.stop();
      monitorRef.current = null;
      setApiMutationSafety({ allowed: true, state: "unmonitored" });
    };
  }, []);

  const value = useMemo(
    () => ({ state, retry: () => void monitorRef.current?.retry() }),
    [state],
  );

  return <RuntimeHealthContext.Provider value={value}>{children}</RuntimeHealthContext.Provider>;
}

export function useRuntimeHealth() {
  const context = useContext(RuntimeHealthContext);
  if (!context) throw new Error("useRuntimeHealth must be used within RuntimeHealthProvider");
  return context;
}
