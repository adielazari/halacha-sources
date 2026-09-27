export type CommentaryEntry = {
  ref: string;
  heRef: string;
  text: string;
};

export type DocItemType = "source" | "explanation" | "question" | "answer" | "heading" | "image";

export type Excerpt = {
  id: string;
  type?: DocItemType;          // default "source" when absent (backwards compat)
  sourceKey: string;
  sourceLabel: string;
  text: string;
  sectionIndex?: number;
  note?: string;
  // Set when type === "image" — a data: URI of a pasted/uploaded photo of a
  // physical source, added directly (no Sefaria ref, no OCR).
  imageData?: string;
  // Set when the excerpt is a source pulled from Sefaria via SourcePullView
  sourceRef?: string;
  // The panel text the user originally selected when pulling this source —
  // the panel highlights it (lib/highlightSources.ts). Differs from `text`
  // for Sefaria-pulled sources (text = the pulled source, highlightText =
  // the mention in the Tur/Beit Yosef). Absent = no panel highlight.
  highlightText?: string;
  commentaries?: CommentaryEntry[];
  parentId?: string;           // for answers: links to the parent question's id
  headingLevel?: 1 | 2 | 3;                   // for heading type: 1=large 2=medium 3=small
  headingAlign?: "right" | "center" | "left"; // for heading type: text alignment
  // 0-based Shulchan Arukh se'if index this excerpt belongs to, set
  // manually by the user — there's no reliable automatic mapping for Tur/
  // Beit Yosef (unlike the SA-anchored mefarshim in HalachicBlock, see
  // lib/sefaria.ts). The "לפי סעיפי שו״ע" view merges any excerpt tagged
  // this way (plus its own `commentaries`) into that se'if's block.
  linkedSeif?: number;
  // Explicit override of whether this excerpt appears on the final/printed
  // document. undefined = use the type-based default (see
  // isHiddenByDefault in lib/sourceLabels.ts) — the base SA/Tur/Beit Yosef
  // text is hidden by default there, everything else shows.
  hidden?: boolean;
};

export type PracticalPoint = {
  what: string;
  when?: string;
  how?: string;
  // The exact source label (the block's main source, or one of its
  // commentaries' heRef) this point is grounded in — validated server-side
  // against the labels actually sent in the request, so the AI can't cite a
  // source that wasn't part of its own input.
  source: string;
};

export type BlockAnalysisResult = {
  summary: string;
  practical_points: PracticalPoint[];
};

export type OrgMode = "topic" | "free";

export type Collection = {
  id: string;
  name: string;
  userId: string;
  orgMode: OrgMode;
  chelek: string | null;
  topic: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CollectionSiman = {
  id: string;
  collectionId: string;
  chelek: string;
  simanNumber: number;
  position: number;
};

export type CollectionWithSimanim = Collection & { simanim: CollectionSiman[] };
