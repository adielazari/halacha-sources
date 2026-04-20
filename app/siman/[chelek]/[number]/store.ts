"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Excerpt, CommentaryEntry, DocItemType } from "@/lib/types";

export type { Excerpt, CommentaryEntry, DocItemType };

export type ApprovedSource = {
  ref: string;
  raw: string;
  selectedText: string;
  commentaries: CommentaryEntry[];
  mefaresh?: string;
  seifIndex?: number;
};

type Store = {
  chelek: string;
  siman: string;
  excerpts: Excerpt[];
  expandedPanels: Record<string, boolean>;

  addExcerpt(excerpt: Omit<Excerpt, "id"> & { id?: string }): void;
  setExcerptAnnotationId(excerptId: string, annotationId: string): void;
  removeExcerpt(id: string): void;
  reorderExcerpts(fromIndex: number, toIndex: number): void;
  updateNote(id: string, note: string): void;
  addAnnotation(afterId: string, type: DocItemType, text: string): void;
  addHeading(afterId: string | null, text: string, align: "right" | "center" | "left", level?: 1 | 2 | 3): void;
  updateHeading(id: string, text: string, align: "right" | "center" | "left", level: 1 | 2 | 3): void;
  updateExcerptText(id: string, text: string): void;
  updateExcerptFields(id: string, fields: Partial<Pick<Excerpt, "text" | "sourceLabel" | "sourceRef" | "commentaries">>): void;
  togglePanel(key: string): void;
  setSession(chelek: string, siman: string): void;
  reset(): void;
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      chelek: "",
      siman: "",
      excerpts: [],
      expandedPanels: { shulchanArukh: true },

      addExcerpt: (excerpt) =>
        set((state) => ({
          excerpts: [
            ...state.excerpts,
            { ...excerpt, id: excerpt.id ?? crypto.randomUUID() },
          ],
        })),

      setExcerptAnnotationId: (excerptId, annotationId) =>
        set((state) => ({
          excerpts: state.excerpts.map((e) =>
            e.id === excerptId ? { ...e, annotationId } : e
          ),
        })),

      removeExcerpt: (id) =>
        set((state) => ({
          excerpts: state.excerpts.filter((e) => e.id !== id),
        })),

      reorderExcerpts: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.excerpts];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { excerpts: next };
        }),

      updateNote: (id, note) =>
        set((state) => ({
          excerpts: state.excerpts.map((e) =>
            e.id === id ? { ...e, note } : e
          ),
        })),

      addAnnotation: (afterId, type, text) =>
        set((state) => {
          const idx = state.excerpts.findIndex((e) => e.id === afterId);
          if (idx === -1) return {};
          const parent = state.excerpts[idx];
          const newItem: Excerpt = {
            id: crypto.randomUUID(),
            type,
            sourceKey: parent.sourceKey,
            sourceLabel: type === "explanation" ? "הסבר" : type === "question" ? "שאלה" : "תשובה",
            text,
            parentId: type === "answer" ? afterId : undefined,
          };
          const next = [...state.excerpts];
          next.splice(idx + 1, 0, newItem);
          return { excerpts: next };
        }),

      addHeading: (afterId, text, align, level = 2) =>
        set((state) => {
          const newItem: Excerpt = {
            id: crypto.randomUUID(),
            type: "heading",
            sourceKey: "heading",
            sourceLabel: "כותרת",
            text,
            headingAlign: align,
            headingLevel: level,
          };
          if (afterId === null) {
            return { excerpts: [...state.excerpts, newItem] };
          }
          const idx = state.excerpts.findIndex((e) => e.id === afterId);
          if (idx === -1) return { excerpts: [...state.excerpts, newItem] };
          const next = [...state.excerpts];
          next.splice(idx + 1, 0, newItem);
          return { excerpts: next };
        }),

      updateHeading: (id, text, align, level) =>
        set((state) => ({
          excerpts: state.excerpts.map((e) =>
            e.id === id ? { ...e, text, headingAlign: align, headingLevel: level } : e
          ),
        })),

      updateExcerptText: (id, text) =>
        set((state) => ({
          excerpts: state.excerpts.map((e) =>
            e.id === id ? { ...e, text } : e
          ),
        })),

      updateExcerptFields: (id, fields) =>
        set((state) => ({
          excerpts: state.excerpts.map((e) =>
            e.id === id ? { ...e, ...fields } : e
          ),
        })),

      togglePanel: (key) =>
        set((state) => ({
          expandedPanels: {
            ...state.expandedPanels,
            [key]: !state.expandedPanels[key],
          },
        })),

      setSession: (chelek, siman) =>
        set((state) => {
          if (state.chelek === chelek && state.siman === siman) return {};
          return {
            chelek,
            siman,
            excerpts: [],
            expandedPanels: { shulchanArukh: true },
          };
        }),

      reset: () =>
        set({
          chelek: "",
          siman: "",
          excerpts: [],
          expandedPanels: { shulchanArukh: true },
        }),
    }),
    {
      name: "halachic-source-doc",
      // Namespace localStorage by currentUser so each user has their own doc.
      // User switching always triggers a redirect, so the store re-hydrates
      // with the new user's key on the next page load.
      storage: {
        getItem: (name: string) => {
          if (typeof window === "undefined") return null;
          const user = localStorage.getItem("currentUser") ?? "anonymous";
          const raw = localStorage.getItem(`${name}__${user}`);
          return raw ? (JSON.parse(raw) as ReturnType<typeof JSON.parse>) : null;
        },
        setItem: (name: string, value: unknown) => {
          if (typeof window === "undefined") return;
          const user = localStorage.getItem("currentUser") ?? "anonymous";
          localStorage.setItem(`${name}__${user}`, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          if (typeof window === "undefined") return;
          const user = localStorage.getItem("currentUser") ?? "anonymous";
          localStorage.removeItem(`${name}__${user}`);
        },
      },
      partialize: (state) => ({
        chelek: state.chelek,
        siman: state.siman,
        excerpts: state.excerpts,
        expandedPanels: state.expandedPanels,
      }),
    }
  )
);
