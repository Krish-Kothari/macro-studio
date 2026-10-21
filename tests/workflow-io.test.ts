import { describe, expect, it } from "vitest";
import { duplicateWorkflow, parseWorkflow, serializeWorkflow } from "../src/workflow-io";
import type { Workflow } from "../src/types";

const workflow: Workflow = {
  id: "w",
  name: "Portable workflow",
  description: "Import and export test",
  updatedAt: "2026-01-01T00:00:00.000Z",
  nodes: [
    { id: "a", type: "trigger", label: "Start", config: {}, x: 0, y: 0 },
    { id: "b", type: "end", label: "End", config: {}, x: 150, y: 0 }
  ],
  edges: [{ source: "a", target: "b" }]
};

describe("workflow portability", () => {
  it("duplicates a workflow with independent IDs and connections", () => {
    let index = 0;
    const copy = duplicateWorkflow(workflow, () => `copy-${++index}`);
    expect(copy.id).toBe("copy-3");
    expect(copy.name).toBe("Portable workflow copy");
    expect(copy.nodes.map((node) => node.id)).toEqual(["copy-1", "copy-2"]);
    expect(copy.edges).toEqual([{ source: "copy-1", target: "copy-2" }]);
    expect(copy.nodes[0].config).not.toBe(workflow.nodes[0].config);
  });

  it("round trips a valid workflow", () => {
    expect(parseWorkflow(serializeWorkflow(workflow))).toEqual(workflow);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseWorkflow("{")).toThrow("not valid JSON");
  });

  it("rejects disconnected workflows", () => {
    expect(() => parseWorkflow(JSON.stringify({ ...workflow, edges: [] }))).toThrow("cannot be imported");
  });
});
