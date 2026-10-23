import { z } from "zod";
import type { Workflow, NodeType } from "./types";

const node = z.object({
  id: z.string().min(1), type: z.enum(["trigger", "website", "wait", "application", "openPath", "copyText", "currentDate", "playSound", "playMusic", "command", "notification", "end"] as [NodeType, ...NodeType[]]),
  label: z.string().min(1), config: z.record(z.string()), x: z.number(), y: z.number()
});
export const workflowSchema = z.object({
  id: z.string(), name: z.string().trim().min(1, "Workflow name is required"), description: z.string(),
  nodes: z.array(node).min(2), edges: z.array(z.object({ source: z.string(), target: z.string() })),
  updatedAt: z.string(), lastRunAt: z.string().optional()
});

export function validateWorkflow(workflow: Workflow): string[] {
  const parsed = workflowSchema.safeParse(workflow);
  if (!parsed.success) return parsed.error.issues.map((issue) => issue.message);
  const starts = workflow.nodes.filter((n) => n.type === "trigger");
  const ends = workflow.nodes.filter((n) => n.type === "end");
  if (starts.length !== 1) return ["A workflow must contain exactly one Manual Trigger."];
  if (ends.length !== 1) return ["A workflow must contain exactly one End node."];
  const ids = new Set(workflow.nodes.map((n) => n.id));
  if (ids.size !== workflow.nodes.length) return ["Every node must have a unique ID."];
  if (workflow.edges.some((e) => !ids.has(e.source) || !ids.has(e.target) || e.source === e.target)) return ["Connections must reference distinct nodes in this workflow."];
  const outgoing = new Map<string, string>();
  for (const edge of workflow.edges) {
    if (outgoing.has(edge.source)) return ["V1 workflows support one sequential path only."];
    outgoing.set(edge.source, edge.target);
  }
  if (outgoing.has(ends[0].id)) return ["The End node must be the final node in the workflow."];
  const visited = new Set<string>(); let current = starts[0].id;
  while (current) {
    if (visited.has(current)) return ["The workflow contains a cycle."];
    visited.add(current); current = outgoing.get(current) ?? "";
  }
  if (!visited.has(ends[0].id) || visited.size !== workflow.nodes.length) return ["Every node must be connected from the trigger to the End node."];
  return [];
}
