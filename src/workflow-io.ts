import { validateWorkflow, workflowSchema } from "./validation";
import type { Workflow } from "./types";

export function duplicateWorkflow(workflow: Workflow, createId: () => string = () => crypto.randomUUID()): Workflow {
  const idMap = new Map(workflow.nodes.map((node) => [node.id, createId()]));
  return {
    ...workflow,
    id: createId(),
    name: `${workflow.name} copy`,
    nodes: workflow.nodes.map((node) => ({ ...node, id: idMap.get(node.id) ?? createId(), config: { ...node.config } })),
    edges: workflow.edges.map((edge) => ({
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target
    })),
    updatedAt: new Date().toISOString(),
    lastRunAt: undefined
  };
}

export function serializeWorkflow(workflow: Workflow): string {
  return JSON.stringify(workflow, null, 2);
}

export function parseWorkflow(source: string): Workflow {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  const parsed = workflowSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("The selected file is not a valid Macro Studio workflow.");
  }

  const errors = validateWorkflow(parsed.data);
  if (errors.length) throw new Error(`The workflow cannot be imported: ${errors[0]}`);
  return parsed.data;
}
