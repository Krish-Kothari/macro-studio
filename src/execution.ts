import type { Execution, Workflow, WorkflowNode } from "./types";
import { validateWorkflow } from "./validation";

export type ExecutionCallbacks = {
  onUpdate: (execution: Execution) => void;
  isCancelled: () => boolean;
};

function orderedNodes(workflow: Workflow): WorkflowNode[] {
  const next = new Map(workflow.edges.map((edge) => [edge.source, edge.target]));
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]));
  const nodes: WorkflowNode[] = [];
  const seen = new Set<string>();
  let current = workflow.nodes.find((node) => node.type === "trigger")?.id;
  while (current && !seen.has(current)) {
    const node = byId.get(current);
    if (!node) break;
    nodes.push(node);
    seen.add(current);
    current = next.get(current);
  }
  return nodes;
}

function wait(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = globalThis.setInterval(() => {
      if (isCancelled()) {
        globalThis.clearInterval(timer);
        reject(new Error("Execution cancelled."));
      } else if (Date.now() - started >= ms) {
        globalThis.clearInterval(timer);
        resolve();
      }
    }, 25);
  });
}

async function executeNode(node: WorkflowNode, isCancelled: () => boolean): Promise<string> {
  if (node.type === "wait") {
    const seconds = Number(node.config.duration);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 300) throw new Error("Wait duration must be between 0 and 300 seconds.");
    await wait(seconds * 1000, isCancelled);
    return `Waited ${seconds} seconds.`;
  }
  if (node.type === "website") {
    const url = node.config.url?.trim();
    if (!url) throw new Error("Website URL is required.");
    if (!window.macroSystem) throw new Error("The desktop URL bridge is unavailable.");
    await window.macroSystem.openUrl(url);
    return `Opened ${url}.`;
  }
  if (node.type === "application") {
    const applicationPath = node.config.applicationPath?.trim();
    if (!applicationPath) throw new Error("Choose an application before running this action.");
    if (!window.macroSystem?.openApplication) throw new Error("The desktop application bridge is unavailable.");
    await window.macroSystem.openApplication(applicationPath);
    return `Opened ${applicationPath}.`;
  }
  if (node.type === "openPath") {
    const path = node.config.path?.trim();
    if (!path) throw new Error("A file or folder path is required.");
    if (!window.macroSystem?.openApplication) throw new Error("The desktop path bridge is unavailable.");
    await window.macroSystem.openApplication(path);
    return `Opened ${path}.`;
  }
  if (node.type === "copyText") {
    const text = node.config.text ?? "";
    if (!text.trim()) throw new Error("Text to copy is required.");
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this environment.");
    await navigator.clipboard.writeText(text);
    return `Copied ${text.length} characters.`;
  }
  if (node.type === "currentDate") {
    const format = node.config.format || "localized";
    const value = format === "iso" ? new Date().toISOString() : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format();
    return `Current date: ${value}`;
  }
  if (node.type === "playSound" || node.type === "playMusic") {
    const mediaPath = node.config.path?.trim();
    if (!mediaPath) throw new Error(`${node.type === "playSound" ? "Sound" : "Music"} file path is required.`);
    if (!window.macroSystem?.playMedia) throw new Error("The desktop audio bridge is unavailable.");
    await window.macroSystem.playMedia(mediaPath);
    return `Playing ${mediaPath}.`;
  }
  if (node.type === "notification") {
    if (typeof Notification === "undefined") throw new Error("Desktop notifications are unavailable in this environment.");
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") throw new Error("Desktop notification permission was not granted.");
    new Notification(node.config.title || "Macro Studio", { body: node.config.message || "Workflow completed." });
    return "Notification delivered.";
  }
  if (node.type === "command") {
    throw new Error(`${node.label} requires explicit desktop execution approval and is not enabled in this build.`);
  }
  return node.type === "trigger" ? "Manual trigger accepted." : "Workflow completed.";
}

export async function executeWorkflow(workflow: Workflow, execution: Execution, callbacks: ExecutionCallbacks): Promise<Execution> {
  const errors = validateWorkflow(workflow);
  if (errors.length) throw new Error(errors[0]);
  const steps = orderedNodes(workflow);
  let current: Execution = { ...execution, status: "running", steps: steps.length, stepExecutions: [] };
  callbacks.onUpdate(current);
  for (const node of steps) {
    if (callbacks.isCancelled()) {
      current = { ...current, status: "cancelled", finishedAt: new Date().toISOString(), error: "Execution cancelled." };
      callbacks.onUpdate(current);
      return current;
    }
    const startedAt = new Date().toISOString();
    const step = { nodeId: node.id, label: node.label, status: "running" as const, startedAt };
    current = { ...current, stepExecutions: [...current.stepExecutions, step] };
    callbacks.onUpdate(current);
    try {
      const output = await executeNode(node, callbacks.isCancelled);
      const finishedAt = new Date().toISOString();
      current = { ...current, completedSteps: current.completedSteps + 1, stepExecutions: current.stepExecutions.map((item) => item.nodeId === node.id ? { ...item, status: "succeeded" as const, finishedAt, output } : item) };
      callbacks.onUpdate(current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action failed.";
      const finishedAt = new Date().toISOString();
      const cancelled = message === "Execution cancelled.";
      current = { ...current, status: cancelled ? "cancelled" : "failed", finishedAt, error: message, stepExecutions: current.stepExecutions.map((item) => item.nodeId === node.id ? { ...item, status: cancelled ? "cancelled" : "failed", finishedAt, error: message } : item) };
      callbacks.onUpdate(current);
      return current;
    }
  }
  current = { ...current, status: "completed", finishedAt: new Date().toISOString() };
  callbacks.onUpdate(current);
  return current;
}
