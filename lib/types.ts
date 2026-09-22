export type CommentaryEntry = {
  ref: string;
  heRef: string;
  text: string;
};

export type DocItemType = "source" | "explanation" | "question" | "answer" | "heading" | "agentPoint" | "image";

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
  // Linked annotation ID — set when created via "הגדר מקור" (SourcePullView). Used to
  // delete the panel highlight when this excerpt is removed from the document.
  annotationId?: string;
  commentaries?: CommentaryEntry[];
  parentId?: string;           // for answers: links to the parent question's id
  headingLevel?: 1 | 2 | 3;                   // for heading type: 1=large 2=medium 3=small
  headingAlign?: "right" | "center" | "left"; // for heading type: text alignment
  // Set on the batch heading + every point produced by an agent run — lets a
  // full previous run be found and replaced as one unit on rerun.
  agentId?: string;
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
};

export type BlockAnalysisResult = {
  summary: string;
  practical_points: PracticalPoint[];
};

export type AgentLanguage = "he" | "en";

export type AgentDefinition = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  language: AgentLanguage;
  createdAt: string;
  updatedAt: string;
};

export type GroupRole = "owner" | "write" | "read";

export type Group = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  role: GroupRole;
  joinedAt: string;
};

export type GroupSiman = {
  id: string;
  groupId: string;
  chelek: string;
  simanNumber: number;
  addedBy: string;
  addedAt: string;
};

export type GroupWithDetails = Group & { members: GroupMember[]; simanim: GroupSiman[]; myRole: GroupRole; pendingRequests?: number };

export type JoinRequest = {
  id: string; groupId: string; userId: string; userName: string;
  userEmail: string; status: "pending" | "approved" | "rejected"; requestedAt: string;
};

export type OrgMode = "topic" | "quantity" | "free";

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
