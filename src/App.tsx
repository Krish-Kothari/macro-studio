import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, Check, CheckCircle2, ChevronDown, Command, Copy, Download, Eye, EyeOff, History, LayoutDashboard, LockKeyhole, LogOut, Maximize2, Play, Plus, Redo2, Search, Settings, ShieldCheck, Sparkles, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Execution, NodeType, Workflow, WorkflowNode } from "./types";
import { nodeMeta } from "./types";
import { validateWorkflow } from "./validation";
import { executeWorkflow } from "./execution";
import { duplicateWorkflow, parseWorkflow, serializeWorkflow } from "./workflow-io";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function sample(): Workflow {
  const types: NodeType[] = ["trigger", "website", "wait", "application", "command", "notification", "end"];
  const labels = ["Manual Trigger", "Open Documentation", "Wait 2 seconds", "Open Application", "Run Approved Local Command", "Desktop Notification", "End"];
  const configs: Record<NodeType, Record<string, string>> = {
    trigger: {}, website: { url: "https://developer.apple.com" }, wait: { duration: "2" },
    application: { applicationPath: "" }, openPath: { path: "" }, copyText: { text: "" }, currentDate: { format: "localized" },
    command: { executable: "printf", arguments: "Macro Studio ready" },
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
function defaultConfig(type: NodeType): Record<string, string> {
  switch (type) {
    case "website": return { url: "https://" };
    case "wait": return { duration: "1" };
    case "application": return { applicationPath: "" };
    case "openPath": return { path: "" };
    case "copyText": return { text: "" };
    case "currentDate": return { format: "localized" };
    case "command": return { executable: "printf", arguments: "Macro Studio ready" };
    case "notification": return { title: "Macro complete", message: "Workflow completed." };
    default: return {};
  }
}
type LocalAccount = { email: string; name: string; passwordHash: string; createdAt: string };
async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function App() {
  const [sessionEmail, setSessionEmail] = useState(() => sessionStorage.getItem("macro-session"));
  const [account, setAccount] = useState<LocalAccount | null>(() => readStored<LocalAccount | null>("macro-account", null));
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const historyRef = useRef<Record<string, { undo: Workflow[]; redo: Workflow[] }>>({});
  const active = workflows.find((w) => w.id === activeId) ?? workflows[0];

  useEffect(() => { localStorage.setItem("macro-workflows", JSON.stringify(workflows)); }, [workflows]);
  useEffect(() => { localStorage.setItem("macro-executions", JSON.stringify(executions)); }, [executions]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(""), 2400); return () => clearTimeout(t); } }, [notice]);
  useEffect(() => {
    function handlePaletteShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        setPaletteQuery("");
      }
    }
    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, []);

  function openBuilder(workflow = active) { if (workflow) { setActiveId(workflow.id); setPage("builder"); setSelectedId(workflow.nodes[0]?.id); } }
  function createWorkflow() { const workflow = { ...sample(), id: uid(), name: "Untitled workflow", description: "" }; setWorkflows((items) => [workflow, ...items]); openBuilder(workflow); }
  function duplicateWorkflowFrom(workflow: Workflow) {
    const copy = duplicateWorkflow(workflow, uid);
    setWorkflows((items) => [copy, ...items]);
    setActiveId(copy.id);
    setNotice(`Duplicated "${workflow.name}".`);
  }
  function updateWorkflow(patch: Partial<Workflow>, recordHistory = true) {
    if (!active) return;
    if (recordHistory) {
      const history = historyRef.current[active.id] ?? { undo: [], redo: [] };
      history.undo = [...history.undo.slice(-49), active];
      history.redo = [];
      historyRef.current[active.id] = history;
    }
    setWorkflows((items) => items.map((w) => w.id === active.id ? { ...w, ...patch, updatedAt: now() } : w));
  }
  function undoWorkflow() {
    if (!active) return;
    const history = historyRef.current[active.id];
    const previous = history?.undo.pop();
    if (!previous) return;
    history.redo.push(active);
    setWorkflows((items) => items.map((workflow) => workflow.id === active.id ? previous : workflow));
  }
  function redoWorkflow() {
    if (!active) return;
    const history = historyRef.current[active.id];
    const next = history?.redo.pop();
    if (!next) return;
    history.undo.push(active);
    setWorkflows((items) => items.map((workflow) => workflow.id === active.id ? next : workflow));
  }
  function updateNode(id: string, patch: Partial<WorkflowNode>) { if (!active) return; updateWorkflow({ nodes: active.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) }); }
  function addNode(type: NodeType) {
    if (!active) return;
    const previous = active.nodes[active.nodes.length - 2]; const end = active.nodes[active.nodes.length - 1]; const newNode: WorkflowNode = { id: uid(), type, label: nodeMeta[type].label, config: defaultConfig(type), x: (previous?.x ?? 100) + 150, y: 150 };
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
  async function chooseApplication(node: WorkflowNode) {
    if (!window.macroSystem?.chooseApplication) {
      setNotice("Application selection is only available in the desktop app.");
      return;
    }
    try {
      const applicationPath = await window.macroSystem.chooseApplication();
      if (applicationPath) updateNode(node.id, { config: { ...node.config, applicationPath } });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Application selection failed.");
    }
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
  function runPaletteAction(action: string) {
    setPaletteOpen(false);
    setPaletteQuery("");
    if (action === "run") void runWorkflow();
    if (action === "undo") undoWorkflow();
    if (action === "redo") redoWorkflow();
    if (action === "dashboard") setPage("dashboard");
    if (action === "builder") openBuilder();
  }
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      if (page !== "builder") return;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redoWorkflow() : undoWorkflow();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoWorkflow();
      } else if (modifier && event.key === "Enter") {
        event.preventDefault();
        void runWorkflow();
      } else if (event.key === "Escape" && running) {
        cancelWorkflow();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [page, active, running, workflows]);
  if (!sessionEmail || !account) {
    return <AuthPage account={account} onAuthenticated={(nextAccount) => { setAccount(nextAccount); setSessionEmail(nextAccount.email); sessionStorage.setItem("macro-session", nextAccount.email); }} />;
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
      {page === "dashboard" && <Dashboard workflows={workflows} executions={executions} query={query} setQuery={setQuery} onCreate={createWorkflow} onOpen={openBuilder} onExport={exportWorkflow} onDuplicate={duplicateWorkflowFrom} onDelete={deleteWorkflow} onImport={() => importInput.current?.click()} />}
      {page === "builder" && active && <Builder workflow={active} selectedId={selectedId} setSelectedId={setSelectedId} updateNode={updateNode} updateWorkflow={updateWorkflow} addNode={addNode} removeNode={removeNode} chooseApplication={chooseApplication} running={!!running} onRun={runWorkflow} onCancel={cancelWorkflow} onBack={() => setPage("dashboard")} onUndo={undoWorkflow} onRedo={redoWorkflow} />}
      {page === "history" && <HistoryPage executions={executions} query={historyQuery} setQuery={setHistoryQuery} onClear={clearHistory} />}
      {page === "settings" && <SettingsPage account={account} onSignOut={() => { sessionStorage.removeItem("macro-session"); setSessionEmail(null); }} />}
    </main>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importWorkflow(file); event.target.value = ""; }} />
    {paletteOpen && <CommandPalette query={paletteQuery} setQuery={setPaletteQuery} onClose={() => setPaletteOpen(false)} onAction={runPaletteAction} canRun={!!active && !running} />}
    {notice && <div className="toast"><Check size={15} />{notice}</div>}
  </div>;
}

function CommandPalette({ query, setQuery, onClose, onAction, canRun }: { query: string; setQuery: (value: string) => void; onClose: () => void; onAction: (action: string) => void; canRun: boolean }) {
  const actions = [
    { id: "run", label: "Run active workflow", hint: "⌘ Enter", enabled: canRun },
    { id: "undo", label: "Undo last change", hint: "⌘ Z", enabled: true },
    { id: "redo", label: "Redo last change", hint: "⇧ ⌘ Z", enabled: true },
    { id: "builder", label: "Open workflow builder", hint: "Workspace", enabled: true },
    { id: "dashboard", label: "Open dashboard", hint: "Workspace", enabled: true }
  ].filter((action) => action.enabled && action.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="palette-backdrop" onClick={onClose}><div className="command-palette" onClick={(event) => event.stopPropagation()}><div className="palette-input"><Command size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Enter" && actions[0]) onAction(actions[0].id); }} placeholder="Search commands..." /></div><div className="palette-list">{actions.length ? actions.map((action) => <button key={action.id} onClick={() => onAction(action.id)}><span>{action.label}</span><small>{action.hint}</small></button>) : <div className="empty-state">No commands match.</div>}</div><div className="palette-footer">Press <b>⌘ K</b> anytime to open · <b>Esc</b> to close</div></div></div>;
}

function AuthPage({ account, onAuthenticated }: { account: LocalAccount | null; onAuthenticated: (account: LocalAccount) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordChecks = [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "Number", valid: /\d/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) }
  ];
  const strength = passwordChecks.filter((check) => check.valid).length;
  const strengthLabel = strength === 0 ? "Waiting for your password" : strength < 2 ? "Getting started" : strength < 4 ? "Building momentum" : "Workspace secured";
  const visualState = password.length === 0 ? "idle" : strength === 4 ? "ready" : "typing";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (mode === "signup" && name.trim().length < 2) return setError("Tell us your name to personalize the studio.");
    setBusy(true);
    try {
      const passwordHash = await hashPassword(password);
      const stored = readStored<LocalAccount | null>("macro-account", null);
      if (mode === "signin") {
        if (!stored || stored.email !== normalizedEmail || stored.passwordHash !== passwordHash) {
          setError("Those credentials do not match this local workspace.");
          return;
        }
        onAuthenticated(stored);
      } else {
        if (stored && stored.email !== normalizedEmail) {
          setError("This local app supports one workspace account. Sign in with the existing account or reset local data.");
          return;
        }
        const nextAccount: LocalAccount = { email: normalizedEmail, name: name.trim(), passwordHash, createdAt: now() };
        localStorage.setItem("macro-account", JSON.stringify(nextAccount));
        onAuthenticated(nextAccount);
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className={`auth-shell auth-${visualState}`}><div className="auth-visual"><div className="auth-brand"><span className="brand-mark">M</span><span>MACRO<br /><b>STUDIO</b></span></div><div className="auth-hero"><span className="eyebrow">LOCAL-FIRST AUTOMATION</span><h1>Make repetition<br /><em>disappear.</em></h1><p>{strength === 4 ? "Your workspace is ready for a calm, focused start." : "Design precise desktop workflows, connect every action, and run with confidence."}</p><div className="auth-orbit"><span className="orbit-node orbit-one">↗</span><span className="orbit-node orbit-two">◷</span><span className="orbit-node orbit-three">◇</span><div className="orbit-core">{strength === 4 ? <CheckCircle2 size={25} /> : "M"}</div></div><div className="auth-security-card"><div className="security-card-top"><span><LockKeyhole size={13} /> LOCAL ENCRYPTION</span><strong>{strength}/4</strong></div><div className="security-meter"><i style={{ width: `${strength * 25}%` }} /></div><div className="security-card-bottom"><span>{strengthLabel}</span><Sparkles size={13} /></div></div></div><div className="auth-trust"><ShieldCheck size={15} /> Your workspace stays on this device</div></div><div className="auth-panel"><div className="auth-panel-top"><span className="eyebrow">PRIVATE WORKSPACE</span><span className="auth-mode">OFFLINE MODE</span></div><div className="auth-card"><div className="auth-card-heading"><h2>{mode === "signin" ? "Welcome back." : "Start your studio."}</h2><p>{mode === "signin" ? "Continue where your workflows left off." : "Create a local account in seconds."}</p></div><div className="auth-tabs"><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Sign up</button></div><form onSubmit={submit}>{mode === "signup" && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Krish Kothari" autoComplete="name" /></label>}<label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" type="email" autoComplete="email" /></label><label>Password<div className="password-field"><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><div className="password-feedback" aria-live="polite"><div className="password-feedback-heading"><span>Password readiness</span><b>{strengthLabel}</b></div><div className="password-checks">{passwordChecks.map((check) => <span className={check.valid ? "valid" : ""} key={check.label}>{check.valid ? <Check size={11} /> : <i />} {check.label}</span>)}</div></div></label>{error && <div className="auth-error">{error}</div>}<button className="primary auth-submit" disabled={busy}>{busy ? "Preparing your workspace..." : mode === "signin" ? "Enter workspace" : "Create local workspace"} <ArrowLeft size={15} className="auth-arrow" /></button></form><p className="auth-note"><ShieldCheck size={13} /> Passwords are hashed locally. No account is sent to a server.</p></div><div className="auth-footer">Macro Studio <span>·</span> Precision automation for calm, focused work.</div></div></div>;
}

function Nav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <i />}</button>; }
function Dashboard({ workflows, executions, query, setQuery, onCreate, onOpen, onExport, onDuplicate, onDelete, onImport }: { workflows: Workflow[]; executions: Execution[]; query: string; setQuery: (v: string) => void; onCreate: () => void; onOpen: (w: Workflow) => void; onExport: (w: Workflow) => void; onDuplicate: (w: Workflow) => void; onDelete: (w: Workflow) => void; onImport: () => void }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = workflows.filter((w) => `${w.name} ${w.description}`.toLowerCase().includes(normalizedQuery)); const success = executions.filter((e) => e.status === "completed").length;
  return <div className="page"><header className="page-header"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</div><h1>Make repetition<br /><em>disappear.</em></h1><p className="lede">A quiet place to design, run, and refine your desktop workflows.</p></div><div className="header-actions"><button className="secondary" onClick={onImport}><Upload size={14} /> Import</button><button className="primary" onClick={onCreate}><Plus size={17} /> New workflow</button></div></header>
    <section className="stats"><div><span>WORKFLOWS</span><strong>{workflows.length.toString().padStart(2, "0")}</strong></div><div><span>COMPLETED RUNS</span><strong>{success.toString().padStart(2, "0")}</strong></div><div><span>LAST ACTIVITY</span><strong>{executions[0] ? "Just now" : "—"}</strong></div></section>
    <div className="section-heading"><div><div className="eyebrow">Your workspace</div><h2>Workflows</h2></div><label className="search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workflows" /></label></div>
    <div className="workflow-list">{filtered.map((w, i) => <div className="workflow-row" key={w.id}><button className="workflow-open" onClick={() => onOpen(w)}><span className="row-index">0{i + 1}</span><span className="workflow-name"><b>{w.name}</b><small>{w.description || "No description"} · Updated {new Date(w.updatedAt).toLocaleDateString()}</small></span><span className="node-count">{w.nodes.length} steps</span><ChevronDown size={16} className="rotate" /></button><button className="row-action" title="Duplicate workflow" onClick={() => onDuplicate(w)}><Copy size={14} /></button><button className="row-action" title="Export workflow" onClick={() => onExport(w)}><Download size={14} /></button><button className="row-action danger" title="Delete workflow" onClick={() => onDelete(w)}><Trash2 size={14} /></button></div>)}{!filtered.length && <div className="empty-state">No workflows match that search.</div>}</div>
    <div className="template-line"><span className="eyebrow">START FROM A TEMPLATE</span><button onClick={onCreate}><Command size={15} /> Developer Morning Setup <Plus size={15} /></button></div>
  </div>;
}

function Builder({ workflow, selectedId, setSelectedId, updateNode, updateWorkflow, addNode, removeNode, chooseApplication, running, onRun, onCancel, onBack, onUndo, onRedo }: { workflow: Workflow; selectedId?: string; setSelectedId: (id: string) => void; updateNode: (id: string, patch: Partial<WorkflowNode>) => void; updateWorkflow: (patch: Partial<Workflow>) => void; addNode: (type: NodeType) => void; removeNode: (id: string) => void; chooseApplication: (node: WorkflowNode) => Promise<void>; running: boolean; onRun: () => void; onCancel: () => void; onBack: () => void; onUndo: () => void; onRedo: () => void }) {
  const selected = workflow.nodes.find((n) => n.id === selectedId); const [consoleOpen, setConsoleOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const healthErrors = validateWorkflow(workflow);
  const libraryActions = (Object.keys(nodeMeta) as NodeType[]).filter((type) => !["trigger", "end"].includes(type) && nodeMeta[type].label.toLowerCase().includes(libraryQuery.toLowerCase()));
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number }>();
  const connectionDragRef = useRef<{ sourceId: string; x: number; y: number }>();
  const [connectionDrag, setConnectionDrag] = useState<{ sourceId: string; x: number; y: number }>();
  function startDragging(event: React.PointerEvent<HTMLButtonElement>, node: WorkflowNode) {
    if (running || !canvasRef.current || (event.target as HTMLElement).closest(".handle")) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: node.id, offsetX: (event.clientX - bounds.left) / zoom - node.x, offsetY: (event.clientY - bounds.top) / zoom - node.y };
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function dragNode(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    updateNode(drag.id, {
      x: Math.max(8, Math.round((event.clientX - bounds.left) / zoom - drag.offsetX)),
      y: Math.max(8, Math.round((event.clientY - bounds.top) / zoom - drag.offsetY))
    });
  }
  function stopDragging(event?: React.PointerEvent<HTMLElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = undefined;
  }
  function startConnection(event: React.PointerEvent<HTMLSpanElement>, node: WorkflowNode) {
    if (running || node.type === "end" || !canvasRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    const bounds = canvasRef.current.getBoundingClientRect();
    const next = { sourceId: node.id, x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom };
    connectionDragRef.current = next;
    setConnectionDrag(next);
  }
  function moveConnection(event: React.PointerEvent<HTMLDivElement>) {
    const drag = connectionDragRef.current;
    if (!drag || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const next = { ...drag, x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom };
    connectionDragRef.current = next;
    setConnectionDrag(next);
    dragNode(event);
  }
  function finishConnection(targetId?: string) {
    const drag = connectionDragRef.current;
    connectionDragRef.current = undefined;
    if (!targetId) {
      setConnectionDrag(undefined);
      return;
    }
    if (!drag || drag.sourceId === targetId) {
      setConnectionDrag(undefined);
      return;
    }
    const source = workflow.nodes.find((node) => node.id === drag.sourceId);
    const target = workflow.nodes.find((node) => node.id === targetId);
    if (!source || !target || source.type === "end" || target.type === "trigger") {
      setConnectionDrag(undefined);
      return;
    }
    const edges = workflow.edges
      .filter((edge) => edge.source !== source.id && edge.target !== target.id)
      .concat({ source: source.id, target: target.id });
    updateWorkflow({ edges });
    setSelectedId(target.id);
    setConnectionDrag(undefined);
  }
  function finishConnectionAtPointer(event: React.PointerEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>(".node");
    finishConnection(target?.dataset.nodeId);
  }
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
  return <div className={`builder ${focusMode ? "focus-mode" : ""}`}><header className="builder-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={17} /></button><input className="workflow-title" value={workflow.name} onChange={(e) => updateWorkflow({ name: e.target.value })} /><span className={`health-badge ${healthErrors.length ? "invalid" : "valid"}`}>{healthErrors.length ? `${healthErrors.length} issue${healthErrors.length === 1 ? "" : "s"}` : "Workflow healthy"}</span><span className="saved"><span /> Saved locally</span><span className="header-spacer" /><button className="icon-button" title="Undo (⌘Z)" onClick={onUndo}><Undo2 size={16} /></button><button className="icon-button" title="Redo (⇧⌘Z)" onClick={onRedo}><Redo2 size={16} /></button><button className="icon-button" title={focusMode ? "Exit focus mode" : "Focus canvas"} onClick={() => setFocusMode((mode) => !mode)}><Maximize2 size={16} /></button><button className="icon-button" title="Duplicate selected action" onClick={() => selected && addNode(selected.type)}><Copy size={16} /></button>{running ? <button className="danger-button header-cancel" onClick={onCancel}><X size={14} /> Cancel</button> : <button className="primary small" title="Run workflow (⌘Enter)" onClick={onRun}><Play size={14} /> Run workflow</button>}</header>
    <div className="builder-body">{!focusMode && <aside className="library"><div className="eyebrow">Action library</div><label className="library-search"><Search size={14} /><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Find an action" /></label>{libraryActions.map((type) => <button className="action-item" key={type} onClick={() => addNode(type)}><span className={`action-icon ${type}`}>{nodeMeta[type].icon}</span><span><b>{nodeMeta[type].label}</b><small>{nodeMeta[type].category}</small></span><Plus size={14} /></button>)}{!libraryActions.length && <div className="empty-state">No actions found.</div>}</aside>}
      <section className="canvas-wrap"><div className="canvas-toolbar"><span className="eyebrow">CANVAS / SEQUENTIAL PATH</span><span>{workflow.nodes.length} actions · Drag ● to ● to rewire · {Math.round(zoom * 100)}%</span><span className="canvas-controls"><button className="icon-button" title="Zoom out" onClick={() => setZoom((value) => Math.max(.5, value - .1))}><ZoomOut size={14} /></button><button className="icon-button" title="Reset zoom" onClick={() => setZoom(1)}><Maximize2 size={14} /></button><button className="icon-button" title="Zoom in" onClick={() => setZoom((value) => Math.min(2, value + .1))}><ZoomIn size={14} /></button></span></div><div ref={canvasRef} className="canvas" onPointerMove={moveConnection} onPointerUp={(event) => { stopDragging(); finishConnectionAtPointer(event); }} onPointerCancel={() => { stopDragging(); setConnectionDrag(undefined); }}><div className="canvas-content" style={{ zoom }}><div className="grid" />{workflow.edges.map((edge) => { const source = workflow.nodes.find((node) => node.id === edge.source); const target = workflow.nodes.find((node) => node.id === edge.target); return source && target ? <div key={`${edge.source}-${edge.target}`} className="connector" style={connectionStyle(source, target)} /> : null; })}{connectionDrag && <div className="connector connection-preview" style={{ left: (workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.x ?? 0) + 122, top: (workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.y ?? 0) + 38, width: Math.hypot(connectionDrag.x - ((workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.x ?? 0) + 122), connectionDrag.y - ((workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.x ?? 0) + 38)), transform: `rotate(${Math.atan2(connectionDrag.y - ((workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.y ?? 0) + 38), connectionDrag.x - ((workflow.nodes.find((node) => node.id === connectionDrag.sourceId)?.x ?? 0) + 122))}rad)`, transformOrigin: "left center" }} />}{workflow.nodes.map((node) =>             <button key={node.id} data-node-id={node.id} className={`node ${node.type} ${selectedId === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={(event) => startDragging(event, node)} onPointerMove={dragNode} onPointerUp={(event) => { stopDragging(event); finishConnection(node.id); }} onPointerCancel={(event) => { stopDragging(event); finishConnection(); }} onClick={() => setSelectedId(node.id)} title="Drag to move action"><span className="input-handle handle" data-node-id={node.id} onPointerUp={(event) => { event.stopPropagation(); finishConnection(node.id); }} aria-label={`Connect into ${node.label}`} /><span className="node-icon">{nodeMeta[node.type].icon}</span><span><small>{nodeMeta[node.type].category}</small><b>{node.label}</b></span><span className="output-handle handle" onPointerDown={(event) => startConnection(event, node)} aria-label={`Connect from ${node.label}`} /></button>)}</div></div><button className="console-toggle" onClick={() => setConsoleOpen(!consoleOpen)}><Activity size={14} /> Execution console <span>{consoleOpen ? "Collapse" : "Expand"}</span></button>{consoleOpen && <div className="console"><span className="status-dot" /> {running ? "Execution in progress" : "Ready for execution"} <span>{running ? "Actions are reported as they complete." : "Validate your path before running."}</span></div>}</section>
      {!focusMode && <aside className="inspector"><div className="eyebrow">Properties</div><label>Workflow description<textarea value={workflow.description} onChange={(e) => updateWorkflow({ description: e.target.value })} /></label>{selected ? <><div className="inspector-title"><span className={`action-icon ${selected.type}`}>{nodeMeta[selected.type].icon}</span><div><b>{selected.label}</b><small>{selected.type.toUpperCase()} ACTION</small></div></div><label>Display name<input value={selected.label} onChange={(e) => updateNode(selected.id, { label: e.target.value })} /></label>{Object.entries(selected.config).map(([key, value]) => <label key={key}>{key.replace(/([A-Z])/g, " $1")}<input value={value} onChange={(e) => updateNode(selected.id, { config: { ...selected.config, [key]: e.target.value } })} /></label>      )}{selected.type === "application" && <button className="secondary" onClick={() => void chooseApplication(selected)}>Choose application</button>}{selected.type === "website" && !selected.config.url && <button className="text-button" onClick={() => updateNode(selected.id, { config: { url: "https://" } })}>+ Add URL</button>}{selected.type !== "trigger" && selected.type !== "end" && <button className="danger-button" onClick={() => removeNode(selected.id)}><Trash2 size={14} /> Remove action</button>}</> : <div className="inspector-empty">Select an action on the canvas to configure it.</div>}</aside>}
    </div></div>;
}

function HistoryPage({ executions, query, setQuery, onClear }: { executions: Execution[]; query: string; setQuery: (value: string) => void; onClear: () => void }) {
  const [statusFilter, setStatusFilter] = useState<"all" | Execution["status"]>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = executions.filter((execution) => (statusFilter === "all" || execution.status === statusFilter) && `${execution.workflowName} ${execution.status}`.toLowerCase().includes(normalizedQuery));
  return <div className="page"><header className="page-header compact"><div><div className="eyebrow">Observability</div><h1>Run history</h1><p className="lede">Every execution, recorded locally.</p></div><button className="secondary" onClick={onClear} disabled={!executions.length}><Trash2 size={14} /> Clear history</button></header><div className="history-filters"><label className="search history-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter runs" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter runs by status"><option value="all">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="running">Running</option></select></div><div className="history-list">{filtered.length ? filtered.map((e) => <div className="history-row" key={e.id}><span className={`run-status ${e.status}`}>{e.status === "completed" ? <Check size={13} /> : e.status === "cancelled" ? <X size={13} /> : <Activity size={13} />}</span><span><b>{e.workflowName}</b><small>{new Date(e.startedAt).toLocaleString()}</small></span><span className="history-meta">{e.completedSteps}/{e.steps} steps · {e.status}{e.error ? ` · ${e.error}` : ""}</span><code>{e.id.slice(0, 8)}</code></div>) : <div className="empty-state">{executions.length ? "No runs match this filter." : "No runs yet. Open a workflow and press Run."}</div>}</div></div>;
}
function SettingsPage({ account, onSignOut }: { account: LocalAccount; onSignOut: () => void }) { return <div className="page"><header className="page-header compact"><div><div className="eyebrow">Workspace preferences</div><h1>Settings</h1><p className="lede">Macro Studio is local-first by design.</p></div><button className="secondary" onClick={onSignOut}><LogOut size={14} /> Sign out</button></header><div className="profile-card"><span className="profile-avatar">{account.name.slice(0, 1).toUpperCase()}</span><div><b>{account.name}</b><small>{account.email}</small></div><span className="auth-mode">LOCAL ACCOUNT</span></div><div className="settings-list"><div><b>Appearance</b><span>Dark / Obsidian</span></div><div><b>Default action timeout</b><span>30 seconds</span></div><div><b>Execution policy</b><span>Commands require explicit approval</span></div><div><b>Storage</b><span>Browser local storage · offline</span></div></div></div>; }
