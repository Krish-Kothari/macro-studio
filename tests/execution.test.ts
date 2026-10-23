import { describe, expect, it, vi } from "vitest";
import { executeWorkflow } from "../src/execution";
import type { Execution, Workflow } from "../src/types";

const workflow: Workflow = { id: "w", name: "Wait test", description: "", updatedAt: new Date().toISOString(), nodes: [
  { id: "a", type: "trigger", label: "Start", config: {}, x: 0, y: 0 },
  { id: "b", type: "wait", label: "Wait", config: { duration: "0" }, x: 1, y: 0 },
  { id: "c", type: "end", label: "End", config: {}, x: 2, y: 0 }
], edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }] };

const execution: Execution = { id: "e", workflowId: "w", workflowName: "Wait test", status: "running", startedAt: new Date().toISOString(), steps: 0, completedSteps: 0, stepExecutions: [] };

describe("workflow execution", () => {
  it("runs the connected path and reports each step", async () => {
    const updates: Execution[] = [];
    const result = await executeWorkflow(workflow, execution, { isCancelled: () => false, onUpdate: (value) => updates.push(value) });
    expect(result.status).toBe("completed");
    expect(result.completedSteps).toBe(3);
    expect(result.stepExecutions.every((step) => step.status === "succeeded")).toBe(true);
    expect(updates.length).toBeGreaterThan(3);
  });

  it("stops when cancellation is requested", async () => {
    const updates: Execution[] = [];
    const cancelled = vi.fn(() => true);
    const result = await executeWorkflow(workflow, execution, { isCancelled: cancelled, onUpdate: (value) => updates.push(value) });
    expect(result.status).toBe("cancelled");
    expect(result.error).toBe("Execution cancelled.");
  });

  it("reports the current date action output", async () => {
    const currentDateWorkflow: Workflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.type === "wait" ? { ...node, type: "currentDate" as const, label: "Current Date", config: { format: "iso" } } : node)
    };
    const result = await executeWorkflow(currentDateWorkflow, execution, { isCancelled: () => false, onUpdate: () => undefined });
    const dateStep = result.stepExecutions.find((step) => step.nodeId === "b");
    expect(result.status).toBe("completed");
    expect(dateStep?.output).toMatch(/^Current date: \d{4}-\d{2}-\d{2}T/);
  });
});
