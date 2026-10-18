import { describe, expect, it } from "vitest";
import { validateWorkflow } from "../src/validation";
import type { Workflow } from "../src/types";

const workflow: Workflow = { id: "w", name: "Test", description: "", updatedAt: new Date().toISOString(), nodes: [
  { id: "a", type: "trigger", label: "Start", config: {}, x: 0, y: 0 },
  { id: "b", type: "wait", label: "Wait", config: { duration: "1" }, x: 1, y: 0 },
  { id: "c", type: "end", label: "End", config: {}, x: 2, y: 0 }
], edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }] };
describe("workflow validation", () => {
  it("accepts a connected sequential path", () => expect(validateWorkflow(workflow)).toEqual([]));
  it("rejects disconnected nodes", () => expect(validateWorkflow({ ...workflow, nodes: [...workflow.nodes, { id: "x", type: "wait", label: "orphan", config: {}, x: 0, y: 0 }] })).toEqual(["Every node must be connected from the trigger to the End node."]));
  it("rejects branching", () => expect(validateWorkflow({ ...workflow, edges: [...workflow.edges, { source: "a", target: "c" }] })).toEqual(["V1 workflows support one sequential path only."]));
  it("rejects duplicate node IDs", () => expect(validateWorkflow({ ...workflow, nodes: workflow.nodes.map((node, index) => index === 2 ? { ...node, id: "b" } : node) })).toEqual(["Every node must have a unique ID."]));
});
