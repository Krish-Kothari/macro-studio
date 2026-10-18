import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, Check, ChevronDown, Command, Copy, Download, History, LayoutDashboard, Play, Plus, Search, Settings, Trash2, Undo2, Upload, X } from "lucide-react";
import type { Execution, NodeType, Workflow, WorkflowNode } from "./types";
import { nodeMeta } from "./types";
import { validateWorkflow } from "./validation";
import { executeWorkflow } from "./execution";
import { parseWorkflow, serializeWorkflow } from "./workflow-io";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function sample(): Workflow {
  const types: NodeType[] = ["trigger", "website", "wait", "application", "command", "notification", "end"];
  const labels = ["Manual Trigger", "Open Documentation", "Wait 2 seconds", "Open Application", "Run Approved Local Command", "Desktop Notification", "End"];
  const configs: Record<NodeType, Record<string, string>> = {
    trigger: {}, website: { url: "https://developer.apple.com" }, wait: { duration: "2" },
    application: {}, command: { executable: "printf", arguments: "Macro Studio ready" },
    notification: { title: "Macro complete", message: "Developer setup finished." }, end: {}
  };
  const nodes: WorkflowNode[] = types.map((type, i) => ({ id: uid(), type, label: labels[i], config: configs[type], x: 48 + i * 154, y: 150 }));
  return { id: uid(), name: "Developer Morning Setup", description: "A safe, sequential setup routine for the first hour of the day.", nodes, edges: nodes.slice(0, -1).map((n, i) => ({ source: n.id, target: nodes[i + 1].id })), updatedAt: now() };
}
function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}
const initial = (): Workflow[] => readStored("macro-workflows", [sample()]);

export default function App() {
  const [workflows, setWorkflows] = useState<Workflow[]>(initial);
  const [executions, setExecutions] = useState<Execution[]>(() => readStored<Execution[]>("macro-executions", []));
  const [page, setPage] = useState<"dashboard" | "builder" | "history" | "settings">("dashboard");
  const [activeId, setActiveId] = useState(workflows[0]?.id);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<string>();
  const cancelRequested = useRef(false);
  const [notice, setNotice] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const active = workflows.find((w) => w.id === activeId) ?? workflows[0];

  useEffect(() => { localStorage.setItem("macro-workflows", JSON.stringify(workflows)); }, [workflows]);
  useEffect(() => { localStorage.setItem("macro-executions", JSON.stringify(executions)); }, [executions]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(""), 2400); return () => clearTimeout(t); } }, [notice]);

  function openBuilder(workflow = active) { if (workflow) { setActiveId(workflow.id); setPage("builder"); setSelectedId(workflow.nodes[0]?.id); } }
  function createWorkflow() { const workflow = { ...sample(), id: uid(), name: "Untitled workflow", description: "" }; setWorkflows((items) => [workflow, ...items]); openBuilder(workflow); }
  function updateWorkflow(patch: Partial<Workflow>) { if (!active) return; setWorkflows((items) => items.map((w) => w.id === active.id ? { ...w, ...patch, updatedAt: now() } : w)); }
  function updateNode(id: string, patch: Partial<WorkflowNode>) { if (!active) return; updateWorkflow({ nodes: active.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) }); }
  function addNode(type: NodeType) {
    if (!active) return;
    const previous = active.nodes[active.nodes.length - 2]; const end = active.nodes[active.nodes.length - 1]; const newNode: WorkflowNode = { id: uid(), type, label: nodeMeta[type].label, config: {}, x: (previous?.x ?? 100) + 150, y: 150 };
    updateWorkflow({ nodes: [...active.nodes.slice(0, -1), newNode, end], edges: [...active.edges.filter((e) => e.target !== end.id), { source: previous?.id ?? active.nodes[0].id, target: newNode.id }, { source: newNode.id, target: end.id }] });
    setSelectedId(newNode.id);
  }
  function removeNode(id: string) { if (!active || active.nodes.find((n) => n.id === id)?.type === "trigger" || active.nodes.find((n) => n.id === id)?.type === "end") return; const incoming = active.edges.find((e) => e.target === id)?.source; const outgoing = active.edges.find((e) => e.source === id)?.target; updateWorkflow({ nodes: active.nodes.filter((n) => n.id !== id), edges: active.edges.filter((e) => e.source !== id && e.target !== id).concat(incoming && outgoing ? [{ source: incoming, target: outgoing }] : []) }); setSelectedId(undefined); }
  async function runWorkflow() {
    if (!active || running) return;
    const errors = validateWorkflow(active);
    if (errors.length) { setNotice(errors[0]); return; }
    const execution: Execution = { id: uid(), workflowId: active.id, workflowName: active.name, status: "running", startedAt: now(), steps: active.nodes.length, completedSteps: 0, stepExecutions: [] };
    setRunning(active.id);
    cancelRequested.current = false;
    setExecutions((items) => [execution, ...items]);
    const result = await executeWorkflow(active, execution, {
      isCancelled: () => cancelRequested.current,
      onUpdate: (updated) => setExecutions((items) => items.map((item) => item.id === updated.id ? updated : item))
    });
    setRunning(undefined);
    if (result.status === "completed") updateWorkflow({ lastRunAt: result.finishedAt });
    setNotice(result.status === "completed" ? "Execution completed successfully" : result.error || `Execution ${result.status}.`);
  }
  function cancelWorkflow() { if (running) cancelRequested.current = true; }
  function exportWorkflow(workflow: Workflow) {
    const blob = new Blob([serializeWorkflow(workflow)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${workflow.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "workflow"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("Workflow exported.");
  }
  function importWorkflow(file: File) {
    file.text().then((source) => {
      try {
        const imported = { ...parseWorkflow(source), id: uid(), updatedAt: now() };
        setWorkflows((items) => [imported, ...items]);
        setActiveId(imported.id);
        setNotice(`Imported "${imported.name}".`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Workflow import failed.");
      }
    }).catch(() => setNotice("Workflow import failed."));
  }
  function deleteWorkflow(workflow: Workflow) {
    if (running === workflow.id) return;
    if (!window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;
    setWorkflows((items) => items.filter((item) => item.id !== workflow.id));
    setExecutions((items) => items.filter((item) => item.workflowId !== workflow.id));
    if (activeId === workflow.id) setActiveId(workflows.find((item) => item.id !== workflow.id)?.id ?? "");
    setNotice("Workflow deleted.");
  }
  function clearHistory() {
    if (!executions.length || !window.confirm("Clear all run history? This cannot be undone.")) return;
    setExecutions([]);
    setNotice("Run history cleared.");
  }
  if (!active && page === "builder") return <div className="empty-page">Create a workflow to begin.</div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">M</span><span>MACRO<br /><b>STUDIO</b></span></div>
      <div className="eyebrow">Workspace</div>
      <nav>
        <Nav icon={<LayoutDashboard />} label="Overview" active={page === "dashboard"} onClick={() => setPage("dashboard")} />
        <Nav icon={<Activity />} label="Builder" active={page === "builder"} onClick={() => openBuilder()} />
        <Nav icon={<History />} label="Run history" active={page === "history"} onClick={() => setPage("history")} />
      </nav>
      <div className="sidebar-bottom"><Nav icon={<Settings />} label="Settings" active={page === "settings"} onClick={() => setPage("settings")} /><div className="version">v0.1 / LOCAL MODE</div></div>
    </aside>
    <main className="main">
      {page === "dashboard" && <Dashboard workflows={workflows} executions={executions} query={query} setQuery={setQuery} onCreate={createWorkflow} onOpen={openBuilder} onExport={exportWorkflow} onDelete={deleteWorkflow} onImport={() => importInput.current?.click()} />}
      {page === "builder" && active && <Builder workflow={active} selectedId={selectedId} setSelectedId={setSelectedId} updateNode={updateNode} updateWorkflow={updateWorkflow} addNode={addNode} removeNode={removeNode} running={!!running} onRun={runWorkflow} onCancel={cancelWorkflow} onBack={() => setPage("dashboard")} />}
      {page === "history" && <HistoryPage executions={executions} query={historyQuery} setQuery={setHistoryQuery} onClear={clearHistory} />}
      {page === "settings" && <SettingsPage />}
    </main>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importWorkflow(file); event.target.value = ""; }} />
    {notice && <div className="toast"><Check size={15} />{notice}</div>}
  </div>;
}

function Nav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <i />}</button>; }
function Dashboard({ workflows, executions, query, setQuery, onCreate, onOpen, onExport, onDelete, onImport }: { workflows: Workflow[]; executions: Execution[]; query: string; setQuery: (v: string) => void; onCreate: () => void; onOpen: (w: Workflow) => void; onExport: (w: Workflow) => void; onDelete: (w: Workflow) => void; onImport: () => void }) {
  const filtered = workflows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase())); const success = executions.filter((e) => e.status === "completed").length;
  return <div className="page"><header className="page-header"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</div><h1>Make repetition<br /><em>disappear.</em></h1><p className="lede">A quiet place to design, run, and refine your desktop workflows.</p></div><div className="header-actions"><button className="secondary" onClick={onImport}><Upload size={14} /> Import</button><button className="primary" onClick={onCreate}><Plus size={17} /> New workflow</button></div></header>
    <section className="stats"><div><span>WORKFLOWS</span><strong>{workflows.length.toString().padStart(2, "0")}</strong></div><div><span>COMPLETED RUNS</span><strong>{success.toString().padStart(2, "0")}</strong></div><div><span>LAST ACTIVITY</span><strong>{executions[0] ? "Just now" : "—"}</strong></div></section>
    <div className="section-heading"><div><div className="eyebrow">Your workspace</div><h2>Workflows</h2></div><label className="search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workflows" /></label></div>
    <div className="workflow-list">{filtered.map((w, i) => <div className="workflow-row" key={w.id}><button className="workflow-open" onClick={() => onOpen(w)}><span className="row-index">0{i + 1}</span><span className="workflow-name"><b>{w.name}</b><small>{w.description || "No description"} · Updated {new Date(w.updatedAt).toLocaleDateString()}</small></span><span className="node-count">{w.nodes.length} steps</span><ChevronDown size={16} className="rotate" /></button><button className="row-action" title="Export workflow" onClick={() => onExport(w)}><Download size={14} /></button><button className="row-action danger" title="Delete workflow" onClick={() => onDelete(w)}><Trash2 size={14} /></button></div>)}{!filtered.length && <div className="empty-state">No workflows match that search.</div>}</div>
    <div className="template-line"><span className="eyebrow">START FROM A TEMPLATE</span><button onClick={onCreate}><Command size={15} /> Developer Morning Setup <Plus size={15} /></button></div>
  </div>;
}

function Builder({ workflow, selectedId, setSelectedId, updateNode, updateWorkflow, addNode, removeNode, running, onRun, onCancel, onBack }: { workflow: Workflow; selectedId?: string; setSelectedId: (id: string) => void; updateNode: (id: string, patch: Partial<WorkflowNode>) => void; updateWorkflow: (patch: Partial<Workflow>) => void; addNode: (type: NodeType) => void; removeNode: (id: string) => void; running: boolean; onRun: () => void; onCancel: () => void; onBack: () => void }) {
  const selected = workflow.nodes.find((n) => n.id === selectedId); const [consoleOpen, setConsoleOpen] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number }>();
  function startDragging(event: React.PointerEvent<HTMLButtonElement>, node: WorkflowNode) {
    if (running || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: node.id, offsetX: event.clientX - bounds.left - node.x, offsetY: event.clientY - bounds.top - node.y };
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function dragNode(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    updateNode(drag.id, {
      x: Math.max(8, Math.round(event.clientX - bounds.left - drag.offsetX)),
      y: Math.max(8, Math.round(event.clientY - bounds.top - drag.offsetY))
    });
  }
  function stopDragging() { dragRef.current = undefined; }
  function connectionStyle(source: WorkflowNode, target: WorkflowNode): React.CSSProperties {
    const sourceX = source.x + 122;
    const sourceY = source.y + 38;
    const targetX = target.x;
    const targetY = target.y + 38;
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    return {
      left: sourceX,
      top: sourceY,
      width: Math.sqrt(deltaX ** 2 + deltaY ** 2),
      transform: `rotate(${Math.atan2(deltaY, deltaX)}rad)`,
      transformOrigin: "left center"
    };
  }
  return <div className="builder"><header className="builder-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={17} /></button><input className="workflow-title" value={workflow.name} onChange={(e) => updateWorkflow({ name: e.target.value })} /><span className="saved"><span /> Saved locally</span><span className="header-spacer" /><button className="icon-button" title="Undo"><Undo2 size={16} /></button><button className="icon-button" title="Duplicate selected action" onClick={() => selected && addNode(selected.type)}><Copy size={16} /></button>{running ? <button className="danger-button header-cancel" onClick={onCancel}><X size={14} /> Cancel</button> : <button className="primary small" onClick={onRun}><Play size={14} /> Run workflow</button>}</header>
    <div className="builder-body"><aside className="library"><div className="eyebrow">Action library</div><div className="library-search"><Search size={14} /> Find an action</div>{(Object.keys(nodeMeta) as NodeType[]).filter((t) => !["trigger", "end"].includes(t)).map((type) => <button className="action-item" key={type} onClick={() => addNode(type)}><span className={`action-icon ${type}`}>{nodeMeta[type].icon}</span><span><b>{nodeMeta[type].label}</b><small>{nodeMeta[type].category}</small></span><Plus size={14} /></button>)}</aside>
      <section className="canvas-wrap"><div className="canvas-toolbar"><span className="eyebrow">CANVAS / SEQUENTIAL PATH</span><span>{workflow.nodes.length} actions · Drag actions to arrange · Changes save automatically</span></div><div ref={canvasRef} className="canvas" onPointerMove={dragNode} onPointerUp={stopDragging} onPointerCancel={stopDragging}><div className="grid" />{workflow.edges.map((edge) => { const source = workflow.nodes.find((node) => node.id === edge.source); const target = workflow.nodes.find((node) => node.id === edge.target); return source && target ? <div key={`${edge.source}-${edge.target}`} className="connector" style={connectionStyle(source, target)} /> : null; })}{workflow.nodes.map((node) => <button key={node.id} className={`node ${node.type} ${selectedId === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={(event) => startDragging(event, node)} onClick={() => setSelectedId(node.id)} title="Drag to move action"><span className="node-icon">{nodeMeta[node.type].icon}</span><span><small>{nodeMeta[node.type].category}</small><b>{node.label}</b></span><span className="handle" /></button>)}</div><button className="console-toggle" onClick={() => setConsoleOpen(!consoleOpen)}><Activity size={14} /> Execution console <span>{consoleOpen ? "Collapse" : "Expand"}</span></button>{consoleOpen && <div className="console"><span className="status-dot" /> {running ? "Execution in progress" : "Ready for execution"} <span>{running ? "Actions are reported as they complete." : "Validate your path before running."}</span></div>}</section>
      <aside className="inspector"><div className="eyebrow">Properties</div><label>Workflow description<textarea value={workflow.description} onChange={(e) => updateWorkflow({ description: e.target.value })} /></label>{selected ? <><div className="inspector-title"><span className={`action-icon ${selected.type}`}>{nodeMeta[selected.type].icon}</span><div><b>{selected.label}</b><small>{selected.type.toUpperCase()} ACTION</small></div></div><label>Display name<input value={selected.label} onChange={(e) => updateNode(selected.id, { label: e.target.value })} /></label>{Object.entries(selected.config).map(([key, value]) => <label key={key}>{key.replace(/([A-Z])/g, " $1")}<input value={value} onChange={(e) => updateNode(selected.id, { config: { ...selected.config, [key]: e.target.value } })} /></label>)}{selected.type === "website" && !selected.config.url && <button className="text-button" onClick={() => updateNode(selected.id, { config: { url: "https://" } })}>+ Add URL</button>}{selected.type !== "trigger" && selected.type !== "end" && <button className="danger-button" onClick={() => removeNode(selected.id)}><Trash2 size={14} /> Remove action</button>}</> : <div className="inspector-empty">Select an action on the canvas to configure it.</div>}</aside>
    </div></div>;
}

function HistoryPage({ executions, query, setQuery, onClear }: { executions: Execution[]; query: string; setQuery: (value: string) => void; onClear: () => void }) {
  const filtered = executions.filter((execution) => execution.workflowName.toLowerCase().includes(query.toLowerCase()) || execution.status.includes(query.toLowerCase()));
  return <div className="page"><header className="page-header compact"><div><div className="eyebrow">Observability</div><h1>Run history</h1><p className="lede">Every execution, recorded locally.</p></div><button className="secondary" onClick={onClear} disabled={!executions.length}><Trash2 size={14} /> Clear history</button></header><label className="search history-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter runs" /></label><div className="history-list">{filtered.length ? filtered.map((e) => <div className="history-row" key={e.id}><span className={`run-status ${e.status}`}>{e.status === "completed" ? <Check size={13} /> : e.status === "cancelled" ? <X size={13} /> : <Activity size={13} />}</span><span><b>{e.workflowName}</b><small>{new Date(e.startedAt).toLocaleString()}</small></span><span className="history-meta">{e.completedSteps}/{e.steps} steps · {e.status}{e.error ? ` · ${e.error}` : ""}</span><code>{e.id.slice(0, 8)}</code></div>) : <div className="empty-state">{executions.length ? "No runs match this filter." : "No runs yet. Open a workflow and press Run."}</div>}</div></div>;
}
function SettingsPage() { return <div className="page"><header className="page-header compact"><div><div className="eyebrow">Workspace preferences</div><h1>Settings</h1><p className="lede">Macro Studio is local-first by design.</p></div></header><div className="settings-list"><div><b>Appearance</b><span>Dark / Obsidian</span></div><div><b>Default action timeout</b><span>30 seconds</span></div><div><b>Execution policy</b><span>Commands require explicit approval</span></div><div><b>Storage</b><span>Browser local storage · offline</span></div></div></div>; }
