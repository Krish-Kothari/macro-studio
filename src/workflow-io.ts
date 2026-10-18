import { validateWorkflow, workflowSchema } from "./validation";
import type { Workflow } from "./types";

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
