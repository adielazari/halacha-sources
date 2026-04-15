export type CommentaryEntry = {
  ref: string;
  heRef: string;
  text: string;
};

export type DocItemType = "source" | "explanation" | "question" | "answer" | "heading";

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
  headingLevel?: 1 | 2 | 3;                   // for heading type: 1=large 2=medium 3=small
  headingAlign?: "right" | "center" | "left"; // for heading type: text alignment
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
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};
