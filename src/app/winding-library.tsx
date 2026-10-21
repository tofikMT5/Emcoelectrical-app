"use client";

import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  emptyRecord,
  FRAME_SIZES,
  HP_VALUES,
  PHASE_VALUES,
  RPM_VALUES,
  SLOT_VALUES,
  PITCH_VALUES,
  SWG_VALUES,
  CONNECTION_VALUES,
  CAPACITOR_VALUES,
  DIMENSION_VALUES,
  WEIGHT_VALUES,
  displayPhase,
  isThreePhase,
  normalizeNumber,
  normalizePhase,
  type RecordField,
  type RecordInput,
  type Settings,
  type WindingRecord,
} from "@/lib/winding";

type View = "search" | "add" | "saved" | "recycle" | "settings" | "details";
type FilterState = { q: string; frameSize: string; hp: string; phase: string; rpm: string };
type Notice = { type: "success" | "error"; text: string } | null;
type IconName = "search" | "plus" | "archive" | "settings" | "arrow" | "edit" | "trash" | "print" | "download" | "upload" | "close" | "sliders" | "check" | "database" | "share";

const defaultSettings: Settings = { appName: "Motor Winding Library", workshopName: "Workshop Library" };
const blankFilters = (): FilterState => ({ q: "", frameSize: "", hp: "", phase: "", rpm: "" });
const navItems: { id: Exclude<View, "details">; label: string; icon: IconName }[] = [
  { id: "search", label: "Search records", icon: "search" },
  { id: "add", label: "Add new record", icon: "plus" },
  { id: "saved", label: "Saved records", icon: "archive" },
  { id: "recycle", label: "Recycle bin", icon: "trash" },
  { id: "settings", label: "Settings & backup", icon: "settings" },
];
const SHARE_NUMBER = "919824129886";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    archive: <><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.3 2.3-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.1h-3.25v-.1a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.3-2.3.06-.06A1.7 1.7 0 0 0 6.4 15a1.7 1.7 0 0 0-1.56-1.04h-.1v-3.25h.1A1.7 1.7 0 0 0 6.4 9.67a1.7 1.7 0 0 0-.34-1.88L6 7.73l2.3-2.3.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.04-1.56v-.1h3.25v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.3 2.3-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.1v3.25h-.1A1.7 1.7 0 0 0 19.4 15Z" /></>,
    arrow: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
    edit: <><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m13.8 7.3 3 3" /></>,
    trash: <><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    print: <><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
    upload: <><path d="M12 15V3M7 8l5-5 5 5M5 21h14" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.1M8.6 13.3l6.8 4.1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

function Field({ label, name, value, onChange, error, hint, required, list, inputMode = "text", placeholder = "", className = "", type = "text" }: {
  label: string; name: RecordField; value: string; onChange: (name: RecordField, value: string) => void; error?: string; hint?: string; required?: boolean; list?: string; inputMode?: "text" | "numeric" | "decimal"; placeholder?: string; className?: string; type?: string;
}) {
  return <label className={`field ${className}`}>
    <span className="field-label">{label} {required ? <b>Required</b> : <em>Optional</em>}</span>
    <input name={name} value={value} onChange={(event) => onChange(name, event.target.value)} list={list} inputMode={inputMode} placeholder={placeholder} type={type} className={error ? "input input-error" : "input"} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
    {hint && !error ? <span className="field-hint">{hint}</span> : null}
    {error ? <span id={`${name}-error`} className="field-error">{error}</span> : null}
  </label>;
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div className="spec"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="form-section"><div className="section-heading"><div><p className="eyebrow">Winding data</p><h3>{title}</h3></div>{note ? <p>{note}</p> : null}</div>{children}</section>;
}

function formatDate(value: string) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; }
}

function csvValue(value: string) { return `"${value.replace(/"/g, '""')}"`; }

function recordsToCsv(records: WindingRecord[]) {
  const fields: (keyof WindingRecord)[] = ["id", "companyName", "description", "frameSize", "hp", "phase", "rpm", "od", "idDimension", "eLength", "slot", "rSlot", "runningPitch", "runningTurns", "runningSwg", "runningWeight", "runningConnection", "startingPitch", "startingTurns", "startingSwg", "startingWeight", "startingConnection", "startingCapacitor", "runningCapacitor", "createdAt", "updatedAt"];
  return [fields.join(","), ...records.map((record) => fields.map((field) => csvValue(String(record[field] ?? ""))).join(","))].join("\n");
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one record.");
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function buildShareMessage(record: WindingRecord) {
  const threePhase = isThreePhase(record.phase);
  if (threePhase) {
    return [
      `Company Name: ${record.companyName}`,
      ...(record.description ? [`Description: ${record.description}`] : []),
      `Frame Size: ${record.frameSize}`,
      `HP: ${record.hp}`,
      `Phase: ${displayPhase(record.phase)}`,
      `RPM: ${record.rpm}`,
      `OD: ${record.od || "-"}`,
      `ID: ${record.idDimension || "-"}`,
      `E Length: ${record.eLength || "-"}`,
      `Slot: ${record.slot || "-"}`,
      `R. Slot: ${record.rSlot || "-"}`,
      "",
      "Coil Data:",
      `Pitch: ${record.runningPitch || "-"}`,
      `Turns: ${record.runningTurns || "-"}`,
      `SWG: ${record.runningSwg || "-"}`,
      `Weight: ${record.runningWeight || "-"}`,
      `Connection: ${record.runningConnection || "-"}`,
    ].join("\n");
  }

  return [
    `Company Name: ${record.companyName}`,
    ...(record.description ? [`Description: ${record.description}`] : []),
    `Frame Size: ${record.frameSize}`,
    `HP: ${record.hp}`,
    `Phase: ${displayPhase(record.phase)}`,
    `RPM: ${record.rpm}`,
    `OD: ${record.od || "-"}`,
    `ID: ${record.idDimension || "-"}`,
    `E Length: ${record.eLength || "-"}`,
    `Slot: ${record.slot || "-"}`,
    `R. Slot: ${record.rSlot || "-"}`,
    "",
    "Running Coil:",
    `Pitch: ${record.runningPitch || "-"}`,
    `Turns: ${record.runningTurns || "-"}`,
    `SWG: ${record.runningSwg || "-"}`,
    `Weight: ${record.runningWeight || "-"}`,
    `Connection: ${record.runningConnection || "-"}`,
    "",
    "Starting Coil:",
    `Pitch: ${record.startingPitch || "-"}`,
    `Turns: ${record.startingTurns || "-"}`,
    `SWG: ${record.startingSwg || "-"}`,
    `Weight: ${record.startingWeight || "-"}`,
    `Connection: ${record.startingConnection || "-"}`,
    "",
    "Capacitors:",
    `Starting Capacitor: ${record.startingCapacitor || "-"}`,
    `Running Capacitor: ${record.runningCapacitor || "-"}`,
  ].join("\n");
}

function shareRecord(record: WindingRecord) {
  const message = encodeURIComponent(buildShareMessage(record));
  window.open(`https://wa.me/${SHARE_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
}

export default function WindingLibrary() {
  const [view, setView] = useState<View>("search");
  const [returnView, setReturnView] = useState<View>("search");
  const [records, setRecords] = useState<WindingRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [filters, setFilters] = useState<FilterState>(blankFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(blankFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [selected, setSelected] = useState<WindingRecord | null>(null);
  const [form, setForm] = useState<RecordInput>(emptyRecord);
  const [formStart, setFormStart] = useState<RecordInput>(emptyRecord);
  const [formErrors, setFormErrors] = useState<Partial<Record<RecordField, string>>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(defaultSettings);
  const [savedQuery, setSavedQuery] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importing, setImporting] = useState(false);

  const [recycleRecords, setRecycleRecords] = useState<WindingRecord[]>([]);
  const [recycleLoading, setRecycleLoading] = useState(false);

  const loadRecycleRecords = useCallback(async () => {
    setRecycleLoading(true);
    try {
      const response = await fetch("/api/records?recycle=true", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setRecycleRecords(data.records as WindingRecord[]);
      }
    } catch {
      // ignore
    } finally {
      setRecycleLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async (activeFilters: FilterState = blankFilters()) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      const response = await fetch(`/api/records${params.size ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load records.");
      setRecords(data.records as WindingRecord[]);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not load records." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialise = async () => {
      try {
        const [settingsResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          loadRecords(),
          loadRecycleRecords(),
        ]);
        const settingsData = await settingsResponse.json();
        if (settingsResponse.ok && settingsData.settings) {
          setSettings(settingsData.settings); setSettingsDraft(settingsData.settings);
        }
      } catch { setNotice({ type: "error", text: "Could not connect to the workshop library." }); }
    };
    void initialise();
  }, [loadRecords, loadRecycleRecords]);

  const isDirty = useMemo(() => (view === "add" && JSON.stringify(form) !== JSON.stringify(formStart)), [view, form, formStart]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4500); return () => window.clearTimeout(timer); }, [notice]);

  const navigate = (next: View) => {
    if (next === view) return;
    if (isDirty && !window.confirm("You have unsaved record changes. Leave without saving?")) return;
    setView(next); setSelected(null);
  };

  const openCreate = () => {
    if (isDirty && !window.confirm("You have unsaved record changes. Start a new record instead?")) return;
    const blank = emptyRecord(); setForm(blank); setFormStart(blank); setFormErrors({}); setEditingId(null); setSelected(null); setView("add");
  };

  const changeForm = (name: RecordField, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    if (formErrors[name]) setFormErrors((current) => ({ ...current, [name]: undefined }));
  };

  const startEdit = (record: WindingRecord, fromView?: View) => {
    const next = Object.fromEntries(Object.entries(emptyRecord()).map(([key]) => [key, record[key as RecordField] ?? ""])) as RecordInput;
    setForm(next); setFormStart(next); setFormErrors({}); setEditingId(record.id); if (fromView) setReturnView(fromView); setSelected(null); setView("add"); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showDetails = (record: WindingRecord, fromView?: View) => { setSelected(record); if (fromView) setReturnView(fromView); setView("details"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const saveRecord = async (event?: FormEvent<HTMLFormElement>, addAnother = false) => {
    event?.preventDefault(); setSaving(true); setFormErrors({});
    const payload = isThreePhase(form.phase)
      ? {
          ...form,
          startingPitch: "",
          startingTurns: "",
          startingSwg: "",
          startingWeight: "",
          startingConnection: "",
          startingCapacitor: "",
          runningCapacitor: "",
        }
      : form;
    try {
      const response = await fetch(editingId ? `/api/records/${editingId}` : "/api/records", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 422 && data.errors) { setFormErrors(data.errors); setNotice({ type: "error", text: "Please fill in the required motor information." }); return; }
      if (!response.ok) throw new Error(data.message || "Could not save this record.");
      setNotice({ type: "success", text: editingId ? "Record updated." : "Record saved to the library." });
      await loadRecords(filters);
      if (addAnother) { const blank = emptyRecord(); setForm(blank); setFormStart(blank); setEditingId(null); }
      else { setFormStart(payload); setSelected(data.record as WindingRecord); setView("details"); }
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not save this record." }); }
    finally { setSaving(false); }
  };

  const deleteRecord = async (record: WindingRecord) => {
    if (!window.confirm(`Move “${record.companyName}” to Recycle bin? You can restore it anytime.`)) return;
    try {
      const response = await fetch(`/api/records/${record.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not move to Recycle bin.");
      setNotice({ type: "success", text: `“${record.companyName}” moved to Recycle bin.` });
      setSelected(null);
      if (view === "details") setView(returnView || "saved");
      await Promise.all([loadRecords(filters), loadRecycleRecords()]);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not delete record." });
    }
  };

  const restoreRecord = async (record: WindingRecord) => {
    try {
      const response = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not restore record.");
      setNotice({ type: "success", text: `“${record.companyName}” restored to library.` });
      await Promise.all([loadRecords(filters), loadRecycleRecords()]);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not restore record." });
    }
  };

  const permanentDeleteRecord = async (record: WindingRecord) => {
    if (!window.confirm(`Permanently delete “${record.companyName}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/records/${record.id}?permanent=true`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not permanently delete record.");
      setNotice({ type: "success", text: "Record permanently deleted." });
      await loadRecycleRecords();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not delete record." });
    }
  };

  const clearRecycleBin = async () => {
    if (!recycleRecords.length) return;
    if (!window.confirm(`Permanently delete all ${recycleRecords.length} records in Recycle bin? This cannot be undone.`)) return;
    try {
      const response = await fetch("/api/records?emptyRecycle=true", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not empty recycle bin.");
      setNotice({ type: "success", text: `Recycle bin emptied (${data.cleared || recycleRecords.length} records removed).` });
      await loadRecycleRecords();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not empty recycle bin." });
    }
  };

  const performSearch = async (event?: FormEvent) => { event?.preventDefault(); const next = { ...draftFilters }; setFilters(next); await loadRecords(next); };
  const clearFilters = async () => { const empty = blankFilters(); setDraftFilters(empty); setFilters(empty); await loadRecords(empty); };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settingsDraft) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not save settings.");
      setSettings(data.settings); setSettingsDraft(data.settings); setNotice({ type: "success", text: "Workshop settings saved." });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not save settings." }); }
  };

  const download = (content: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  };

  const exportRecords = async (format: "json" | "csv") => {
    try {
      const response = await fetch("/api/records", { cache: "no-store" }); const data = await response.json();
      if (!response.ok) throw new Error("Could not prepare the backup.");
      const all = data.records as WindingRecord[]; const date = new Date().toISOString().slice(0, 10);
      if (format === "json") download(JSON.stringify({ app: "Motor Winding Library", exportedAt: new Date().toISOString(), settings, records: all }, null, 2), `motor-winding-library-${date}.json`, "application/json");
      else download(recordsToCsv(all), `motor-winding-library-${date}.csv`, "text/csv;charset=utf-8");
      setNotice({ type: "success", text: `${all.length} record(s) exported as ${format.toUpperCase()}.` });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not export records." }); }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setImporting(true);
    try {
      const content = await file.text(); let imported: unknown[];
      if (file.name.toLowerCase().endsWith(".csv")) imported = parseCsv(content);
      else { const parsed = JSON.parse(content); imported = Array.isArray(parsed) ? parsed : parsed.records; if (!Array.isArray(imported)) throw new Error("JSON backup must include a records list."); }
      if (!imported.length) throw new Error("There are no records to import.");
      const warning = importMode === "replace" ? `Replace every current record with ${imported.length} imported record(s)? This cannot be undone.` : `Add ${imported.length} imported record(s) to the current library?`;
      if (!window.confirm(warning)) return;
      const response = await fetch("/api/records/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: imported, mode: importMode, confirmed: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not import the backup.");
      await loadRecords(filters); setNotice({ type: "success", text: `${data.imported} record(s) ${data.mode === "replace" ? "replaced the library" : "added to the library"}.` });
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not import this backup." }); }
    finally { setImporting(false); }
  };

  const savedRecords = useMemo(() => {
    const term = savedQuery.trim().toLowerCase();
    if (!term) return records;
    const normTerm = normalizeNumber(term);
    const normPhaseTerm = normalizePhase(term);
    return records.filter((record) => {
      const basic = [record.companyName, record.description || "", record.frameSize, record.hp, record.phase, record.rpm].some((value) =>
        value.toLowerCase().includes(term),
      );
      if (basic) return true;
      if (normTerm && (normalizeNumber(record.hp) === normTerm || normalizeNumber(record.rpm) === normTerm)) {
        return true;
      }
      if (normPhaseTerm && normalizePhase(record.phase) === normPhaseTerm) {
        return true;
      }
      return false;
    });
  }, [records, savedQuery]);

  const filterActive = Object.values(filters).some((value) => value.trim());

  return <div className="app-shell">
    <aside className="sidebar no-print"><div className="brand-mark"><Image src="/logo.png" alt="EMCO Electrical Logo" width={42} height={42} className="brand-logo-img" priority /><div><strong>{settings.appName}</strong><small>{settings.workshopName}</small></div></div><nav className="side-nav" aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={view === item.id || (view === "details" && item.id === "saved") ? "nav-link active" : "nav-link"} onClick={() => item.id === "add" ? openCreate() : navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === "recycle" && recycleRecords.length > 0 ? <span className="nav-count-badge">{recycleRecords.length}</span> : null}</button>)}</nav><div className="sidebar-note"><Icon name="database" size={20} /><p><strong>Workshop-ready records</strong><span>Stored securely in your library database.</span></p></div></aside>
    <main className="main-content">
      <header className="topbar no-print"><div className="mobile-brand"><Image src="/logo.png" alt="EMCO Electrical Logo" width={36} height={36} className="brand-logo-img" priority /><div><strong>{settings.appName}</strong><small>{settings.workshopName}</small></div></div><div className="topbar-actions"><span className="record-total"><b>{records.length}</b> record{records.length === 1 ? "" : "s"}</span><Button onClick={openCreate}><Icon name="plus" size={18} /> <span>Add record</span></Button></div></header>
      {notice ? <div className={`notice ${notice.type}`} role="status"><Icon name={notice.type === "success" ? "check" : "close"} size={18} /><span>{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button></div> : null}
      {view === "search" ? <SearchScreen filters={draftFilters} setFilters={setDraftFilters} onSearch={performSearch} onClear={clearFilters} loading={loading} records={records} filterActive={filterActive} onView={(rec) => showDetails(rec, "search")} onEdit={(rec) => startEdit(rec, "search")} onDelete={deleteRecord} onAdd={openCreate} onShare={shareRecord} /> : null}
      {view === "saved" ? <SavedScreen records={savedRecords} query={savedQuery} setQuery={setSavedQuery} loading={loading} onView={(rec) => showDetails(rec, "saved")} onEdit={(rec) => startEdit(rec, "saved")} onDelete={deleteRecord} onAdd={openCreate} onShare={shareRecord} /> : null}
      {view === "add" ? <RecordForm form={form} errors={formErrors} editing={Boolean(editingId)} saving={saving} onChange={changeForm} onSubmit={saveRecord} onCancel={() => navigate(editingId ? (returnView || "saved") : "search")} /> : null}
      {view === "details" && selected ? <DetailsScreen record={selected} onBack={() => navigate(returnView || "search")} onEdit={() => startEdit(selected, returnView)} onDelete={() => deleteRecord(selected)} onShare={() => shareRecord(selected)} /> : null}
      {view === "recycle" ? <RecycleScreen records={recycleRecords} loading={recycleLoading} onRestore={restoreRecord} onPermanentDelete={permanentDeleteRecord} onEmpty={clearRecycleBin} /> : null}
      {view === "settings" ? <SettingsScreen settings={settingsDraft} setSettings={setSettingsDraft} onSave={saveSettings} onExport={exportRecords} importMode={importMode} setImportMode={setImportMode} onImport={importFile} importing={importing} /> : null}
    </main>
    <nav className="mobile-nav no-print" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => item.id === "add" ? openCreate() : navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.id === "settings" ? "Settings" : item.id === "search" ? "Search" : item.id === "saved" ? "Saved" : item.id === "recycle" ? "Recycle" : "Add"}</span></button>)}</nav>
  </div>;
}

function SearchScreen({ filters, setFilters, onSearch, onClear, loading, records, filterActive, onView, onEdit, onDelete, onAdd, onShare }: { filters: FilterState; setFilters: (value: FilterState) => void; onSearch: (event?: FormEvent) => Promise<void>; onClear: () => Promise<void>; loading: boolean; records: WindingRecord[]; filterActive: boolean; onView: (record: WindingRecord) => void; onEdit: (record: WindingRecord) => void; onDelete: (record: WindingRecord) => void; onAdd: () => void; onShare: (record: WindingRecord) => void; }) {
  const setFilter = (name: keyof FilterState, value: string) => setFilters({ ...filters, [name]: value });
  return <>
    <section className="page-intro no-print"><div><p className="eyebrow"><span className="live-dot" /> Library search</p><h1><span className="hero-blue">EMCO ELECTRICAL</span><br /><span className="hero-red">motor winding data</span></h1><p>Search by motor specification or machine name. Every matching winding record stays separate.</p></div><Button className="intro-add" onClick={onAdd}><Icon name="plus" size={18} /> Add new record</Button></section>
    <section className="search-panel no-print" aria-label="Search motor records"><form onSubmit={onSearch}><div className="quick-search"><Icon name="search" size={20} /><input list="search-machine-options" value={filters.q} onChange={(event) => setFilter("q", event.target.value)} placeholder="Search company, machine, frame, HP or RPM" aria-label="Search all record fields" /><datalist id="search-machine-options">{records.map((record) => <option key={record.id} value={record.companyName} />)}</datalist></div><div className="filter-grid"><label className="filter-field"><span>Frame size</span><input list="frame-options" value={filters.frameSize} onChange={(event) => setFilter("frameSize", event.target.value)} inputMode="numeric" placeholder="Any frame" /><datalist id="frame-options">{FRAME_SIZES.map((option) => <option key={option} value={option} />)}</datalist></label><label className="filter-field"><span>HP</span><input list="hp-options" value={filters.hp} onChange={(event) => setFilter("hp", event.target.value)} inputMode="decimal" placeholder="Any HP" /><datalist id="hp-options">{HP_VALUES.map((option) => <option key={option} value={option} />)}</datalist></label><label className="filter-field"><span>Phase</span><input list="phase-options" value={filters.phase} onChange={(event) => setFilter("phase", event.target.value)} inputMode="numeric" placeholder="Any phase" /><datalist id="phase-options">{PHASE_VALUES.map((option) => <option key={option} value={option} label={`${option} phase`} />)}</datalist></label><label className="filter-field"><span>RPM</span><input list="rpm-options" value={filters.rpm} onChange={(event) => setFilter("rpm", event.target.value)} inputMode="numeric" placeholder="Any RPM" /><datalist id="rpm-options">{RPM_VALUES.map((option) => <option key={option} value={option} />)}</datalist></label><div className="filter-actions"><Button type="submit"><Icon name="search" size={18} /> Search</Button><Button type="button" variant="secondary" onClick={() => void onClear()}>Clear filters</Button></div></div></form></section>
    <section className="results-section"><div className="results-heading"><div><p className="eyebrow">Results</p><h2>{loading ? "Searching records…" : `${records.length} matching record${records.length === 1 ? "" : "s"}`}</h2></div>{filterActive ? <span className="filter-chip"><Icon name="sliders" size={15} /> Filters active</span> : <span className="all-records">Showing all saved records</span>}</div>{loading ? <div className="loading-card"><span className="spinner" /> Loading your library…</div> : records.length ? <div className="record-list">{records.map((record) => <RecordCard key={record.id} record={record} onView={() => onView(record)} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} onShare={() => onShare(record)} />)}</div> : <EmptyState filtered={filterActive} onAdd={onAdd} onClear={onClear} />}</section>
  </>;
}

function RecordCard({ record, onView, onEdit, onDelete, onShare }: { record: WindingRecord; onView: () => void; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  return <article className="record-card"><div className="record-card-top"><div><p className="record-type">Motor winding record</p><h3>{record.companyName}</h3></div><span className="frame-badge">Frame {record.frameSize}</span></div><div className="metric-row"><span><b>{record.hp} HP</b></span><span>{displayPhase(record.phase)}</span><span>{record.rpm} RPM</span></div>{record.description ? <p className="card-description">{record.description}</p> : null}<div className="record-specs"><Spec label="OD" value={record.od} /><Spec label="ID" value={record.idDimension} /><Spec label="E length" value={record.eLength} /><Spec label="Slot" value={record.slot} /><Spec label="R. slot" value={record.rSlot} /></div><div className="card-actions"><Button variant="secondary" onClick={onView}>View details <Icon name="arrow" size={17} /></Button><button className="icon-text-button share-text" onClick={onShare}><Icon name="share" size={17} /> Share</button><button className="icon-text-button" onClick={onEdit}><Icon name="edit" size={17} /> Edit</button><button className="icon-text-button danger-text" onClick={onDelete}><Icon name="trash" size={17} /> Delete</button></div></article>;
}

function EmptyState({ filtered, onAdd, onClear }: { filtered: boolean; onAdd: () => void; onClear: () => Promise<void> }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="search" size={30} /></div><h3>{filtered ? "No matching winding records" : "Your winding library is ready"}</h3><p>{filtered ? "Try clearing a filter or search with a different motor specification." : "Add the first motor record to build a reliable workshop reference."}</p><div>{filtered ? <Button variant="secondary" onClick={() => void onClear()}>Clear filters</Button> : null}<Button onClick={onAdd}><Icon name="plus" size={18} /> Add new record</Button></div></div>;
}

function SavedScreen({ records, query, setQuery, loading, onView, onEdit, onDelete, onAdd, onShare }: { records: WindingRecord[]; query: string; setQuery: (value: string) => void; loading: boolean; onView: (record: WindingRecord) => void; onEdit: (record: WindingRecord) => void; onDelete: (record: WindingRecord) => void; onAdd: () => void; onShare: (record: WindingRecord) => void; }) {
  return <><section className="page-intro compact no-print"><div><p className="eyebrow">Saved records</p><h1>Your workshop library.</h1><p>Browse every saved motor; similar frame sizes remain individual records.</p></div><Button onClick={onAdd}><Icon name="plus" size={18} /> Add record</Button></section><section className="saved-toolbar no-print"><div className="quick-search"><Icon name="search" size={20} /><input list="saved-machine-options" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter saved records" aria-label="Filter saved records" /><datalist id="saved-machine-options">{records.map((record) => <option key={record.id} value={record.companyName} />)}</datalist></div><span>{records.length} record{records.length === 1 ? "" : "s"}</span></section><section className="results-section">{loading ? <div className="loading-card"><span className="spinner" /> Loading your library…</div> : records.length ? <div className="record-list">{records.map((record) => <RecordCard key={record.id} record={record} onView={() => onView(record)} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} onShare={() => onShare(record)} />)}</div> : <EmptyState filtered={Boolean(query)} onAdd={onAdd} onClear={async () => setQuery("")} />}</section></>;
}

function RecordForm({ form, errors, editing, saving, onChange, onSubmit, onCancel }: { form: RecordInput; errors: Partial<Record<RecordField, string>>; editing: boolean; saving: boolean; onChange: (name: RecordField, value: string) => void; onSubmit: (event?: FormEvent<HTMLFormElement>, addAnother?: boolean) => Promise<void>; onCancel: () => void; }) {
  const submitAnother = () => void onSubmit(undefined, true);
  const threePhase = isThreePhase(form.phase);
  return <><section className="page-intro compact no-print"><div><p className="eyebrow">{editing ? "Edit record" : "New record"}</p><h1>{editing ? "Update winding data." : "Add a winding record."}</h1><p>Fields marked <b>Required</b> identify the motor in search. All other workshop measurements are optional.</p></div></section><form className="record-form" onSubmit={(event) => void onSubmit(event)} noValidate>
    <Section title="Motor information" note="Used to find this record later."><div className="field-grid motor-grid"><Field label="Company / Machine Name" name="companyName" value={form.companyName} onChange={onChange} error={errors.companyName} required list="form-company-options" placeholder="e.g. Emco Electrical — Pump Motor" className="wide" /><Field label="Description" name="description" value={form.description} onChange={onChange} placeholder="e.g. Submersible pump, single phase, 24 slots, aluminium body note" className="wide" /><Field label="Frame Size" name="frameSize" value={form.frameSize} onChange={onChange} error={errors.frameSize} required list="form-frame-options" inputMode="numeric" placeholder="e.g. 90" /><Field label="HP" name="hp" value={form.hp} onChange={onChange} error={errors.hp} required list="form-hp-options" inputMode="decimal" placeholder="e.g. 0.5" /><Field label="Phase" name="phase" value={form.phase} onChange={onChange} error={errors.phase} required list="form-phase-options" inputMode="numeric" placeholder="1 or 3" /><Field label="RPM" name="rpm" value={form.rpm} onChange={onChange} error={errors.rpm} required list="form-rpm-options" inputMode="numeric" placeholder="e.g. 1440" /></div></Section>
    <datalist id="form-company-options"><option value="EMCO ELECTRICAL" /></datalist><datalist id="form-frame-options">{FRAME_SIZES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="form-hp-options">{HP_VALUES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="form-phase-options">{PHASE_VALUES.map((value) => <option key={value} value={value} label={`${value} phase`} />)}</datalist><datalist id="form-rpm-options">{RPM_VALUES.map((value) => <option key={value} value={value} />)}</datalist>
    <Section title="Dimensions & slots" note="Use the same notation you use at the bench."><div className="field-grid five-grid"><Field label="OD" name="od" value={form.od} onChange={onChange} list="dimension-options" placeholder="e.g. 126 mm" /><Field label="ID" name="idDimension" value={form.idDimension} onChange={onChange} list="dimension-options" placeholder="e.g. 72 mm" /><Field label="E Length" name="eLength" value={form.eLength} onChange={onChange} list="dimension-options" placeholder="e.g. 80 mm" /><Field label="Slot" name="slot" value={form.slot} onChange={onChange} list="slot-options" placeholder="e.g. 24" inputMode="numeric" /><Field label="R. Slot" name="rSlot" value={form.rSlot} onChange={onChange} list="slot-options" placeholder="e.g. 2.5" /></div></Section>
    <datalist id="dimension-options">{DIMENSION_VALUES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="slot-options">{SLOT_VALUES.map((value) => <option key={value} value={value} />)}</datalist>
    <div className={threePhase ? "coil-columns single-column" : "coil-columns"}>
      <Section title={threePhase ? "Coil data" : "Running coil"} note={threePhase ? "3-phase winding values." : "Main/run winding values."}>
        <div className={`field-grid ${threePhase ? "five-grid" : "two-grid"}`}>
          <Field label="Pitch" name="runningPitch" value={form.runningPitch} onChange={onChange} list="pitch-options" placeholder="e.g. 1–7" />
          <Field label="Turns" name="runningTurns" value={form.runningTurns} onChange={onChange} list="turn-options" placeholder="e.g. 120" />
          <Field label="SWG" name="runningSwg" value={form.runningSwg} onChange={onChange} list="swg-options" placeholder="e.g. 22" />
          <Field label="Weight" name="runningWeight" value={form.runningWeight} onChange={onChange} list="weight-options" placeholder="e.g. 0.85 kg" />
          <Field label="Connection" name="runningConnection" value={form.runningConnection} onChange={onChange} list="connection-options" placeholder="e.g. Series" className={threePhase ? "" : "wide-mobile"} />
        </div>
      </Section>
      {!threePhase ? (
        <Section title="Starting coil" note="Start/auxiliary winding values.">
          <div className="field-grid two-grid">
            <Field label="Pitch" name="startingPitch" value={form.startingPitch} onChange={onChange} list="pitch-options" placeholder="e.g. 1–6" />
            <Field label="Turns" name="startingTurns" value={form.startingTurns} onChange={onChange} list="turn-options" placeholder="e.g. 160" />
            <Field label="SWG" name="startingSwg" value={form.startingSwg} onChange={onChange} list="swg-options" placeholder="e.g. 24" />
            <Field label="Weight" name="startingWeight" value={form.startingWeight} onChange={onChange} list="weight-options" placeholder="e.g. 0.55 kg" />
            <Field label="Connection" name="startingConnection" value={form.startingConnection} onChange={onChange} list="connection-options" placeholder="e.g. Parallel" className="wide-mobile" />
          </div>
        </Section>
      ) : null}
    </div>
    <datalist id="pitch-options">{PITCH_VALUES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="turn-options"><option value="80" /><option value="100" /><option value="120" /><option value="140" /><option value="160" /><option value="180" /><option value="200" /></datalist><datalist id="swg-options">{SWG_VALUES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="weight-options">{WEIGHT_VALUES.map((value) => <option key={value} value={value} />)}</datalist><datalist id="connection-options">{CONNECTION_VALUES.map((value) => <option key={value} value={value} />)}</datalist>
    {!threePhase ? (
      <Section title="Capacitors" note="Enter the value and units exactly as noted in the workshop.">
        <div className="field-grid capacitor-grid">
          <Field label="Starting Capacitor" name="startingCapacitor" value={form.startingCapacitor} onChange={onChange} list="capacitor-options" placeholder="e.g. 100 µF / 250 VAC" />
          <Field label="Running Capacitor" name="runningCapacitor" value={form.runningCapacitor} onChange={onChange} list="capacitor-options" placeholder="e.g. 60 µF / 440 VAC" />
        </div>
      </Section>
    ) : null}
    <datalist id="capacitor-options">{CAPACITOR_VALUES.map((value) => <option key={value} value={value} />)}</datalist>
    <div className="form-actions no-print"><Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save record"}</Button><Button type="button" variant="secondary" disabled={saving} onClick={submitAnother}>{saving ? "Saving…" : "Save & add another"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>Cancel</Button></div>
  </form></>;
}

function DetailsScreen({ record, onBack, onEdit, onDelete, onShare }: { record: WindingRecord; onBack: () => void; onEdit: () => void; onDelete: () => void; onShare: () => void; }) {
  const threePhase = isThreePhase(record.phase);
  return <article className="detail-page"><div className="detail-toolbar no-print"><Button variant="ghost" onClick={onBack}>← Back to records</Button><div><Button variant="secondary" onClick={onShare}><Icon name="share" size={17} /> Share</Button><Button variant="secondary" onClick={() => window.print()}><Icon name="print" size={17} /> Print / Save as PDF</Button><Button onClick={onEdit}><Icon name="edit" size={17} /> Edit</Button><Button variant="danger" onClick={onDelete}><Icon name="trash" size={17} /> Delete</Button></div></div><header className="detail-head"><div><p className="eyebrow">Motor winding record</p><h1>{record.companyName}</h1><p>Last updated {formatDate(record.updatedAt)}</p></div><span className="frame-badge large">Frame {record.frameSize}</span></header><div className="detail-summary"><span><b>{record.hp} HP</b></span><span>{displayPhase(record.phase)}</span><span>{record.rpm} RPM</span></div><div className={`detail-grid ${threePhase ? "three-phase-grid" : ""}`}><DetailSection title="Motor information"><Spec label="Company Name" value={record.companyName} /><Spec label="Description" value={record.description} /><Spec label="Frame Size" value={record.frameSize} /><Spec label="HP" value={record.hp} /><Spec label="Phase" value={displayPhase(record.phase)} /><Spec label="RPM" value={record.rpm} /></DetailSection><DetailSection title="Dimensions & slots"><Spec label="OD" value={record.od} /><Spec label="ID" value={record.idDimension} /><Spec label="E Length" value={record.eLength} /><Spec label="Slot" value={record.slot} /><Spec label="R. Slot" value={record.rSlot} /></DetailSection><DetailSection title={threePhase ? "Coil data" : "Running coil"} className={threePhase ? "three-phase-coil" : ""}><Spec label="Pitch" value={record.runningPitch} /><Spec label="Turns" value={record.runningTurns} /><Spec label="SWG" value={record.runningSwg} /><Spec label="Weight" value={record.runningWeight} /><Spec label="Connection" value={record.runningConnection} /></DetailSection>{!threePhase ? (<DetailSection title="Starting coil"><Spec label="Pitch" value={record.startingPitch} /><Spec label="Turns" value={record.startingTurns} /><Spec label="SWG" value={record.startingSwg} /><Spec label="Weight" value={record.startingWeight} /><Spec label="Connection" value={record.startingConnection} /></DetailSection>) : null}{!threePhase ? (<DetailSection title="Capacitors" className="capacitor-section"><Spec label="Starting Capacitor" value={record.startingCapacitor} /><Spec label="Running Capacitor" value={record.runningCapacitor} /></DetailSection>) : null}</div><footer className="detail-footer">Record created {formatDate(record.createdAt)} <span>•</span> Unique library ID {record.id}</footer></article>;
}

function DetailSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) { return <section className={`detail-section ${className}`}><h2>{title}</h2><div>{children}</div></section>; }

function SettingsScreen({ settings, setSettings, onSave, onExport, importMode, setImportMode, onImport, importing }: { settings: Settings; setSettings: (settings: Settings) => void; onSave: (event: FormEvent) => void; onExport: (format: "json" | "csv") => void; importMode: "append" | "replace"; setImportMode: (value: "append" | "replace") => void; onImport: (event: ChangeEvent<HTMLInputElement>) => void; importing: boolean; }) {
  return <><section className="page-intro compact no-print"><div><p className="eyebrow">Settings & data backup</p><h1>Keep the library yours.</h1><p>Set the workshop identity, then export or restore the winding database whenever you need.</p></div></section><div className="settings-layout"><form className="settings-card" onSubmit={onSave}><div className="settings-card-head"><div className="setting-icon"><Icon name="settings" size={21} /></div><div><h2>Workshop identity</h2><p>Shown in the navigation and printed records.</p></div></div><label className="field"><span className="field-label">App name <b>Required</b></span><input className="input" value={settings.appName} maxLength={120} onChange={(event) => setSettings({ ...settings, appName: event.target.value })} placeholder="Motor Winding Library" /></label><label className="field"><span className="field-label">Workshop / company name <b>Required</b></span><input className="input" value={settings.workshopName} maxLength={160} onChange={(event) => setSettings({ ...settings, workshopName: event.target.value })} placeholder="Your workshop name" /></label><Button type="submit">Save settings</Button></form><section className="settings-card"><div className="settings-card-head"><div className="setting-icon"><Icon name="download" size={21} /></div><div><h2>Export backup</h2><p>Download every saved winding record for safekeeping.</p></div></div><div className="backup-buttons"><Button variant="secondary" onClick={() => onExport("json")}><Icon name="download" size={17} /> Export JSON</Button><Button variant="secondary" onClick={() => onExport("csv")}><Icon name="download" size={17} /> Export CSV</Button></div><p className="backup-note">JSON is best for full restore. CSV is useful for sharing or spreadsheet review.</p></section><section className="settings-card import-card"><div className="settings-card-head"><div className="setting-icon"><Icon name="upload" size={21} /></div><div><h2>Restore / import</h2><p>Accepts Motor Winding Library JSON backups or CSV exports.</p></div></div><label className="mode-choice"><input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} /><span><b>Add to current library</b><small>Keep existing records and add imported records.</small></span></label><label className="mode-choice warning"><input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} /><span><b>Replace current library</b><small>Deletes current records after confirmation.</small></span></label><label className={importing ? "file-button disabled" : "file-button"}><Icon name="upload" size={18} /> {importing ? "Importing…" : "Choose backup file"}<input type="file" accept=".json,.csv,application/json,text/csv" disabled={importing} onChange={onImport} /></label></section></div></>;
}

function RecycleScreen({
  records,
  loading,
  onRestore,
  onPermanentDelete,
  onEmpty,
}: {
  records: WindingRecord[];
  loading: boolean;
  onRestore: (record: WindingRecord) => void;
  onPermanentDelete: (record: WindingRecord) => void;
  onEmpty: () => void;
}) {
  return (
    <>
      <section className="page-intro compact no-print">
        <div>
          <p className="eyebrow">Data protection & recovery</p>
          <h1>Recycle Bin</h1>
          <p>Deleted records stay here safely. You can restore them back to your workshop library anytime.</p>
        </div>
        {records.length > 0 ? (
          <Button variant="danger" onClick={onEmpty}>
            <Icon name="trash" size={17} /> Empty recycle bin
          </Button>
        ) : null}
      </section>
      <section className="results-section">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Recovery</p>
            <h2>{loading ? "Loading recycle bin…" : `${records.length} deleted record${records.length === 1 ? "" : "s"}`}</h2>
          </div>
          <span className="all-records">Safe storage for deleted records</span>
        </div>
        {loading ? (
          <div className="loading-card"><span className="spinner" /> Loading recycle bin…</div>
        ) : records.length ? (
          <div className="record-list">
            {records.map((record) => (
              <article key={record.id} className="record-card recycle-card">
                <div className="record-card-top">
                  <div>
                    <span className="recycle-badge">In Recycle Bin</span>
                    <h3 style={{ marginTop: 6 }}>{record.companyName}</h3>
                  </div>
                  <span className="frame-badge">Frame {record.frameSize}</span>
                </div>
                <div className="metric-row">
                  <span><b>{record.hp} HP</b></span>
                  <span>{displayPhase(record.phase)}</span>
                  <span>{record.rpm} RPM</span>
                </div>
                {record.description ? <p className="card-description">{record.description}</p> : null}
                <div className="record-specs">
                  <Spec label="OD" value={record.od} />
                  <Spec label="ID" value={record.idDimension} />
                  <Spec label="E length" value={record.eLength} />
                  <Spec label="Slot" value={record.slot} />
                  <Spec label="R. slot" value={record.rSlot} />
                </div>
                <div className="card-actions">
                  <Button variant="primary" onClick={() => onRestore(record)}>
                    <Icon name="check" size={17} /> Restore record
                  </Button>
                  <button className="icon-text-button danger-text" onClick={() => onPermanentDelete(record)}>
                    <Icon name="trash" size={17} /> Delete forever
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="trash" size={30} /></div>
            <h3>Recycle bin is empty</h3>
            <p>When you delete a motor record, it will safely appear here so you can restore it anytime in the future.</p>
          </div>
        )}
      </section>
    </>
  );
}
