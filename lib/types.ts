export type CommentaryEntry = {
  ref: string;
  heRef: string;
  text: string;
};

export type DocItemType = "source" | "explanation" | "question" | "answer";

export type Excerpt = {
  id: string;
  type?: DocItemType;          // default "source" when absent (backwards compat)
  sourceKey: string;
  sourceLabel: string;
  text: string;
  sectionIndex?: number;
  note?: string;
  // Set when the excerpt is a source pulled from Sefaria via SourcePullView
  sourceRef?: string;
  commentaries?: CommentaryEntry[];
  parentId?: string;           // for answers: links to the parent question's id
};

export type Annotation = {
  id: string;
  chelek: string;
  siman: string;
  sourceKey: string;
  sourceLabel: string;
  text: string;
  sourceRef: string | null;
  commentaries: CommentaryEntry[];
  sectionIndex: number | null;
  highlightText: string | null;
  sectionHtml: string | null;
  userName: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};
