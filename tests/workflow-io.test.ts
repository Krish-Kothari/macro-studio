import { describe, expect, it } from "vitest";
import { parseWorkflow, serializeWorkflow } from "../src/workflow-io";
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
