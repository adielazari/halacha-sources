"use client";

import { create } from "zustand";
import type { ParsedSource } from "@/lib/parser";

export type CommentaryEntry = {
  ref: string;
  heRef: string;
  text: string;
};

export type ApprovedSource = {
  ref: string;
  raw: string;
  selectedText: string;
  commentaries: CommentaryEntry[];
};

type State = {
  sources: ParsedSource[];
  currentIndex: number;
  approvedSources: ApprovedSource[];

  setSources: (sources: ParsedSource[]) => void;
  approveSource: (source: ApprovedSource) => void;
  skipSource: () => void;
  reset: () => void;
};

export const useStore = create<State>((set) => ({
  sources: [],
  currentIndex: 0,
  approvedSources: [],

  setSources: (sources) => set({ sources, currentIndex: 0, approvedSources: [] }),

  approveSource: (source) =>
    set((state) => ({
      approvedSources: [...state.approvedSources, source],
      currentIndex: state.currentIndex + 1,
    })),

  skipSource: () =>
    set((state) => ({ currentIndex: state.currentIndex + 1 })),

  reset: () => set({ sources: [], currentIndex: 0, approvedSources: [] }),
}));
