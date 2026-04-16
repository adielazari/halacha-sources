"use client";
import { useCallback } from "react";

const STORAGE_KEY = "by-source-feedback";

type Feedback = {
  rejected: string[];       // raw strings to never show again
  manual: ManualSource[];   // user-added sources
};

export type ManualSource = {
  ref: string;
  text: string;
  seifIndex?: number;
  sefariaRef?: string;
};

function load(): Feedback {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { rejected: [], manual: [] };
  } catch { return { rejected: [], manual: [] }; }
}

function save(f: Feedback) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch {}
}

export function useParserFeedback() {
  const reject = useCallback((raw: string) => {
    const f = load();
    if (!f.rejected.includes(raw)) {
      f.rejected.push(raw);
      save(f);
    }
  }, []);

  const addManual = useCallback((src: ManualSource) => {
    const f = load();
    f.manual.push(src);
    save(f);
  }, []);

  const getRejected = useCallback((): string[] => load().rejected, []);
  const getManual = useCallback((): ManualSource[] => load().manual, []);

  return { reject, addManual, getRejected, getManual };
}
