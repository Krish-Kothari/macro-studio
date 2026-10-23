export type NodeType = "trigger" | "website" | "wait" | "application" | "openPath" | "copyText" | "currentDate" | "playSound" | "playMusic" | "command" | "notification" | "end";
export type RunStatus = "running" | "completed" | "failed" | "cancelled";
export type StepStatus = "running" | "succeeded" | "failed" | "cancelled";
export type WorkflowNode = { id: string; type: NodeType; label: string; config: Record<string, string>; x: number; y: number };
export type Workflow = { id: string; name: string; description: string; nodes: WorkflowNode[]; edges: { source: string; target: string }[]; updatedAt: string; lastRunAt?: string };
export type StepExecution = { nodeId: string; label: string; status: StepStatus; startedAt: string; finishedAt?: string; output?: string; error?: string };
export type Execution = { id: string; workflowId: string; workflowName: string; status: RunStatus; startedAt: string; finishedAt?: string; steps: number; completedSteps: number; error?: string; stepExecutions: StepExecution[] };

export const nodeMeta: Record<NodeType, { label: string; icon: string; category: string }> = {
  trigger: { label: "Manual Trigger", icon: "▶", category: "Control" },
  website: { label: "Open Website", icon: "↗", category: "System" },
  wait: { label: "Wait", icon: "◷", category: "Flow" },
  application: { label: "Open Application", icon: "▣", category: "System" },
  openPath: { label: "Open File or Folder", icon: "⌂", category: "System" },
  copyText: { label: "Copy Text", icon: "T", category: "Text" },
  currentDate: { label: "Current Date", icon: "◷", category: "Text" },
  playSound: { label: "Play Sound", icon: "♪", category: "Media" },
  playMusic: { label: "Play Music", icon: "♫", category: "Media" },
  command: { label: "Run Command", icon: ">_", category: "System" },
  notification: { label: "Desktop Notification", icon: "◇", category: "Output" },
  end: { label: "End", icon: "■", category: "Control" }
};
