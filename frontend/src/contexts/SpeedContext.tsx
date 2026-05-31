"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";

export interface SpeedRecord {
  txHash: string;
  confirmationMs: number;
  gasUsed: string;
  gasCostWei: string;
  timestamp: number;
}

export interface SpeedStats {
  records: SpeedRecord[];
  averageMs: number;
  lastMs: number | null;
  lastGasCost: string | null;
}

interface SpeedContextValue extends SpeedStats {
  recordTx: (record: SpeedRecord) => void;
}

const MAX_RECORDS = 20;

const SpeedContext = createContext<SpeedContextValue>({
  records: [],
  averageMs: 400,
  lastMs: null,
  lastGasCost: null,
  recordTx: () => {},
});

export function SpeedProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<SpeedRecord[]>([]);

  const recordTx = useCallback((record: SpeedRecord) => {
    setRecords((prev) => {
      const updated = [record, ...prev].slice(0, MAX_RECORDS);
      return updated;
    });
  }, []);

  const averageMs =
    records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.confirmationMs, 0) / records.length)
      : 400;

  const lastMs = records.length > 0 ? records[0].confirmationMs : null;
  const lastGasCost = records.length > 0 ? records[0].gasCostWei : null;

  return (
    <SpeedContext.Provider value={{ records, averageMs, lastMs, lastGasCost, recordTx }}>
      {children}
    </SpeedContext.Provider>
  );
}

export function useSpeedStats(): SpeedContextValue {
  return useContext(SpeedContext);
}
