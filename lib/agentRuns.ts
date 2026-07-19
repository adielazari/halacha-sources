import { getDocument, saveDocument } from "./db";
import type { SavedDocument } from "./db";
import type { AgentDefinition, Excerpt } from "./types";

/**
 * Persists a batch of generated points (heading + one excerpt per point) into
 * a siman's document, replacing that agent's previous batch there (found via
 * `agentId`) rather than accumulating duplicates on rerun.
 */
export function saveAgentBatch(params: {
  userId: string;
  chelek: string;
  siman: string;
  agentDef: Pick<AgentDefinition, "id" | "name">;
  points: string[];
}): SavedDocument {
  const { userId, chelek, siman, agentDef, points } = params;

  const headingExcerpt: Excerpt = {
    id: crypto.randomUUID(),
    type: "heading",
    sourceKey: "heading",
    sourceLabel: "כותרת",
    text: `🤖 ${agentDef.name}`,
    headingLevel: 3,
    headingAlign: "right",
    agentId: agentDef.id,
  };
  const pointExcerpts: Excerpt[] = points.map((point) => ({
    id: crypto.randomUUID(),
    type: "agentPoint",
    sourceKey: `agent:${agentDef.id}`,
    sourceLabel: agentDef.name,
    text: point,
    agentId: agentDef.id,
  }));

  // Re-read right before the write to shrink the race window against a
  // concurrent manual edit or another agent run.
  const fresh = getDocument(userId, chelek, siman);
  const kept = (fresh?.excerpts ?? []).filter((e) => e.agentId !== agentDef.id);

  return saveDocument({
    userId,
    chelek,
    siman,
    excerpts: [...kept, headingExcerpt, ...pointExcerpts],
    expandedPanels: fresh?.expandedPanels ?? {},
  });
}
