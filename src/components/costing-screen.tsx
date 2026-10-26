"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  COST_ITEM_KEYS,
  COST_ITEM_LABELS,
  COMMON_COST_UNITS,
  calculateCostTotal,
  emptyCostItems,
  DEFAULT_SHAFT_TEMPLATE,
  type CostItemKey,
  type CostItems,
  type CostItemDetails,
  type CostItemLabels,
  type MotorCostingRecord,
  type Settings,
  type ShaftDrawing,
  type WindingRecord,
} from "@/lib/winding";
import { parseDrawingData } from "./technical-drawing";
import { CostingQuotationDrawingView, CostingShaftSection } from "./shaft-drawing-editor";
import { parseCostExpression, type CalcParsedOutput } from "@/lib/cost-calculator";

function formatCurrency(amount: number | string | undefined): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

export function CostingScreen({
  records,
  motorRecords,
  settings,
  loading,
  onAddCosting,
  onEditCosting,
  onDeleteCosting,
  onReload,
}: {
  records: MotorCostingRecord[];
  motorRecords: WindingRecord[];
  settings: Settings;
  loading: boolean;
  onAddCosting: () => void;
  onEditCosting: (record: MotorCostingRecord) => void;
  onDeleteCosting: (record: MotorCostingRecord) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<MotorCostingRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTargetRecord, setAdjustTargetRecord] = useState<MotorCostingRecord | null>(null);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.companyName, r.jobName, r.frameSize, r.hp, r.notes].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }, [records, query]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((r) => r.id));
    }
  };

  const openAdjustModal = (singleRecord?: MotorCostingRecord) => {
    if (singleRecord) {
      setAdjustTargetRecord(singleRecord);
    } else {
      setAdjustTargetRecord(null);
    }
    setAdjustModalOpen(true);
  };

  const handleRevertAdjustment = async (record: MotorCostingRecord) => {
    if (
      !window.confirm(
        `Revert the last price adjustment on “${record.companyName}” and restore previous prices?`,
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/costing/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revert: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not revert adjustment.");
      alert("Previous prices successfully restored.");
      await onReload();
      if (selectedRecord && selectedRecord.id === record.id) {
        setSelectedRecord(data.record as MotorCostingRecord);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error reverting adjustment.");
    }
  };

  if (selectedRecord) {
    return (
      <CostingQuotationView
        record={selectedRecord}
        settings={settings}
        onBack={() => setSelectedRecord(null)}
        onEdit={() => {
          const rec = selectedRecord;
          setSelectedRecord(null);
          onEditCosting(rec);
        }}
        onDelete={async () => {
          const rec = selectedRecord;
          setSelectedRecord(null);
          await onDeleteCosting(rec);
        }}
        onAdjust={() => openAdjustModal(selectedRecord)}
        onRevert={() => handleRevertAdjustment(selectedRecord)}
      />
    );
  }

  return (
    <>
      <section className="page-intro compact no-print">
        <div>
          <p className="eyebrow">Workshop Costing & Quotations</p>
          <h1>Motor Costing</h1>
          <p>
            Calculate itemized manufacturing, rewinding, and material costs for electric motors with
            instant totals and percentage adjustment tools.
          </p>
        </div>
        <div className="header-button-group">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => openAdjustModal()}
            disabled={records.length === 0}
          >
            📈 Apply % Price Increase
          </button>
          <button type="button" className="button button-primary" onClick={onAddCosting}>
            + New Costing Record
          </button>
        </div>
      </section>

      <section className="saved-toolbar no-print">
        <div className="quick-search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search costing records by machine, customer, or frame size"
            aria-label="Filter costing records"
          />
        </div>
        <div className="costing-stats-chip">
          <span>{filteredRecords.length} Costing Record{filteredRecords.length === 1 ? "" : "s"}</span>
          {selectedIds.length > 0 && (
            <span className="selection-count">({selectedIds.length} selected)</span>
          )}
        </div>
      </section>

      <section className="results-section">
        <div className="results-heading no-print">
          <div>
            <p className="eyebrow">Costing Library</p>
            <h2>{loading ? "Loading costing sheets…" : `${filteredRecords.length} Saved Costing Records`}</h2>
          </div>
          {filteredRecords.length > 0 && (
            <div className="selection-tools">
              <button type="button" className="button button-ghost compact" onClick={selectAll}>
                {selectedIds.length === filteredRecords.length ? "Deselect All" : "Select All"}
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="button button-secondary compact"
                  onClick={() => openAdjustModal()}
                >
                  Adjust {selectedIds.length} Selected
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-card">
            <span className="spinner" /> Loading motor costing records…
          </div>
        ) : filteredRecords.length ? (
          <div className="record-list">
            {filteredRecords.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              const hasAdjust = typeof record.lastAdjustmentPercentage === "number";

              return (
                <article
                  key={record.id}
                  className={`record-card costing-card ${isSelected ? "selected-card" : ""}`}
                >
                  <div className="record-card-top">
                    <div className="costing-card-meta">
                      <div className="selection-checkbox no-print">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(record.id)}
                          aria-label={`Select ${record.companyName}`}
                        />
                      </div>
                      <div>
                        <p className="record-type">Motor Costing Sheet</p>
                        <h3>{record.companyName}</h3>
                        {record.jobName && (
                          <span className="job-tag">Job: {record.jobName}</span>
                        )}
                      </div>
                    </div>
                    <span className="frame-badge">Frame {record.frameSize || "—"}</span>
                  </div>

                  <div className="metric-row">
                    <span>
                      <b>{record.hp || "—"} HP</b>
                    </span>
                    <span>{record.phase ? `${record.phase} Phase` : "—"}</span>
                    <span>{record.rpm ? `${record.rpm} RPM` : "—"}</span>
                    {record.jobDate && <span>Date: {record.jobDate}</span>}
                  </div>

                  {/* Dimensions mini-strip */}
                  <div className="record-specs costing-specs">
                    <div className="spec">
                      <span>Body Length</span>
                      <strong>{record.bodyLength ? `${record.bodyLength} mm` : "—"}</strong>
                    </div>
                    <div className="spec">
                      <span>Front Cover</span>
                      <strong>{record.frontBearingCover ? `${record.frontBearingCover} mm` : "—"}</strong>
                    </div>
                    <div className="spec">
                      <span>Back Cover</span>
                      <strong>{record.backBearingCover ? `${record.backBearingCover} mm` : "—"}</strong>
                    </div>
                    <div className="spec">
                      <span>Copper Wire</span>
                      <strong>{formatCurrency(record.items.copperWire)}</strong>
                    </div>
                    <div className="spec">
                      <span>Winding Labor</span>
                      <strong>{formatCurrency(record.items.windingLabor)}</strong>
                    </div>
                  </div>

                  {/* TOTAL AMOUNT HIGHLIGHT */}
                  <div className="costing-total-banner">
                    <div>
                      <span className="total-label">Total Amount</span>
                      <strong className="total-val">{formatCurrency(record.totalAmount)}</strong>
                    </div>
                    {hasAdjust ? (
                      <span className="adjustment-badge" title={`Adjusted on ${formatDate(record.lastAdjustmentDate)}`}>
                        +{record.lastAdjustmentPercentage}% Adjusted
                      </span>
                    ) : (
                      <span className="base-price-badge">Base Price</span>
                    )}
                  </div>

                  <div className="card-actions no-print">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setSelectedRecord(record)}
                    >
                      View Sheet / Print ➔
                    </button>
                    <button
                      type="button"
                      className="icon-text-button"
                      onClick={() => openAdjustModal(record)}
                      title="Adjust prices by %"
                    >
                      📈 Adjust %
                    </button>
                    <button
                      type="button"
                      className="icon-text-button"
                      onClick={() => onEditCosting(record)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="icon-text-button danger-text"
                      onClick={() => void onDeleteCosting(record)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>{query ? "No matching costing records" : "No motor costing records yet"}</h3>
            <p>
              {query
                ? "Try searching with a different motor or customer keyword."
                : "Create itemized costing records with C.I. casting, copper, bearings, labor, and automatic totals."}
            </p>
            <button type="button" className="button button-primary" onClick={onAddCosting}>
              + Create First Costing Record
            </button>
          </div>
        )}
      </section>

      {/* PRICE INCREASE / ADJUSTMENT MODAL */}
      {adjustModalOpen && (
        <PriceAdjustmentModal
          targetRecord={adjustTargetRecord}
          selectedIds={selectedIds}
          records={records}
          onClose={() => setAdjustModalOpen(false)}
          onSuccess={async () => {
            setAdjustModalOpen(false);
            setSelectedIds([]);
            await onReload();
          }}
        />
      )}
    </>
  );
}

export function CostingQuotationView({
  record,
  settings,
  onBack,
  onEdit,
  onDelete,
  onAdjust,
  onRevert,
}: {
  record: MotorCostingRecord;
  settings: Settings;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
  onRevert: () => void;
}) {
  const hasAdjustments = record.adjustmentHistory && record.adjustmentHistory.length > 0;

  return (
    <article className="detail-page costing-sheet-page">
      <div className="detail-toolbar no-print">
        <button type="button" className="button button-ghost" onClick={onBack}>
          ← Back to Costing Records
        </button>
        <div>
          <button type="button" className="button button-secondary" onClick={() => window.print()}>
            🖨️ Print / Save Quotation
          </button>
          <button type="button" className="button button-secondary" onClick={onAdjust}>
            📈 Increase Price %
          </button>
          {hasAdjustments && (
            <button type="button" className="button button-secondary" onClick={onRevert}>
              ↩️ Revert Last Adjustment
            </button>
          )}
          <button type="button" className="button button-primary" onClick={onEdit}>
            ✏️ Edit Costing
          </button>
          <button type="button" className="button button-danger" onClick={onDelete}>
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* PRINT-FRIENDLY QUOTATION SHEET */}
      <div className="quotation-sheet-card">
        <header className="quotation-head">
          <div className="company-branding">
            <h1 className="quotation-company">{settings.appName || "EMCO ELECTRICAL"}</h1>
            <p className="quotation-subtitle">{settings.workshopName || "MOTOR WINDING DATA & WORKSHOP"}</p>
            <p className="quotation-doc-type">MOTOR COSTING & QUOTATION SHEET</p>
          </div>
          <div className="quotation-meta">
            <div>
              <span>Job Date:</span> <strong>{record.jobDate || new Date().toISOString().slice(0, 10)}</strong>
            </div>
            <div>
              <span>Quotation ID:</span> <strong>{record.id.slice(0, 8).toUpperCase()}</strong>
            </div>
            {record.jobName && (
              <div>
                <span>Customer / Job:</span> <strong>{record.jobName}</strong>
              </div>
            )}
          </div>
        </header>

        {/* MOTOR SPECIFICATIONS */}
        <section className="quotation-section">
          <h3 className="section-title">1. Motor Specifications & Bench Dimensions</h3>
          <div className="quotation-specs-grid">
            <div className="q-spec">
              <span>Company / Machine</span>
              <strong>{record.companyName}</strong>
            </div>
            <div className="q-spec">
              <span>Frame Size</span>
              <strong>{record.frameSize || "—"}</strong>
            </div>
            <div className="q-spec">
              <span>HP / Power</span>
              <strong>{record.hp ? `${record.hp} HP` : "—"}</strong>
            </div>
            <div className="q-spec">
              <span>Phase</span>
              <strong>{record.phase ? `${record.phase} Phase` : "—"}</strong>
            </div>
            <div className="q-spec">
              <span>RPM</span>
              <strong>{record.rpm || "—"}</strong>
            </div>
            <div className="q-spec">
              <span>Body Length</span>
              <strong>{record.bodyLength ? `${record.bodyLength} mm` : "—"}</strong>
            </div>
            <div className="q-spec">
              <span>Front Bearing Cover</span>
              <strong>{record.frontBearingCover ? `${record.frontBearingCover} mm` : "—"}</strong>
            </div>
            <div className="q-spec">
              <span>Back Bearing Cover</span>
              <strong>{record.backBearingCover ? `${record.backBearingCover} mm` : "—"}</strong>
            </div>
          </div>
        </section>

        {/* ITEMIZED COST TABLE */}
        <section className="quotation-section">
          <h3 className="section-title">2. Itemized Cost Breakdown</h3>
          <table className="quotation-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>Sr.</th>
                <th>Cost Item Description</th>
                <th style={{ textAlign: "right", width: 170 }}>Amount (INR ₹)</th>
              </tr>
            </thead>
            <tbody>
              {COST_ITEM_KEYS.map((key, index) => {
                const customLabel = record.itemLabels?.[key] || (key === "tbfc" ? record.tbfcLabel : undefined);
                const resolvedCustom = (key === "tbfc" && (customLabel === "T.B.F.C." || !customLabel)) ? "T.E.F.C." : customLabel;
                const label = resolvedCustom || COST_ITEM_LABELS[key];
                const detail = record.itemDetails?.[key];
                const amount = Number(record.items[key]) || 0;
                const hasQty = detail?.quantity !== undefined && detail.quantity > 0;
                return (
                  <tr key={key}>
                    <td className="text-center">{index + 1}</td>
                    <td>
                      <strong>{label}</strong>
                      {hasQty && (
                        <div style={{ fontSize: "11.5px", color: "#516d89", marginTop: "2px" }}>
                          Qty: <strong>{detail.quantity} {detail.unit || "pcs"}</strong>
                          {detail.rate !== undefined && (
                            <span> @ {formatCurrency(detail.rate)} / {detail.unit || "pcs"}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      {amount > 0 ? formatCurrency(amount) : "₹ 0.00"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="quotation-total-row">
                <td colSpan={2} style={{ textAlign: "right", fontSize: 16, fontWeight: 800 }}>
                  TOTAL AMOUNT:
                </td>
                <td style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: "#10253f" }}>
                  {formatCurrency(record.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* SHAFT / PROFILE REFERENCE DRAWING */}
        <CostingQuotationDrawingView record={record} />

        {record.notes && (
          <section className="quotation-section">
            <h3 className="section-title">4. Remarks & Notes</h3>
            <p className="quotation-notes">{record.notes}</p>
          </section>
        )}

        {/* PRICE ADJUSTMENT HISTORY (Shown in details, subtle in print) */}
        {hasAdjustments && (
          <section className="quotation-section no-print">
            <div className="section-header-flex">
              <h3 className="section-title">Price Adjustment History</h3>
              <button
                type="button"
                className="button button-ghost compact"
                onClick={onRevert}
              >
                ↩️ Revert Most Recent Adjustment
              </button>
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Adjustment</th>
                  <th>Previous Total</th>
                  <th>Updated Total</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {record.adjustmentHistory!.map((adj) => (
                  <tr key={adj.id}>
                    <td>{formatDate(adj.appliedAt)}</td>
                    <td>
                      <span className="badge-pos">+{adj.percentage}%</span>
                    </td>
                    <td>{formatCurrency(adj.previousTotal)}</td>
                    <td>
                      <strong>{formatCurrency(adj.updatedTotal)}</strong>
                    </td>
                    <td>{adj.note || "Standard percentage update"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="quotation-footer">
          <p>This costing record was generated by EMCO ELECTRICAL Motor Winding Management System.</p>
          <div className="signature-area">
            <div>
              <div className="sig-line" />
              <span>Prepared By</span>
            </div>
            <div>
              <div className="sig-line" />
              <span>Authorized Workshop Signature</span>
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function CostingForm({
  initialRecord,
  motorRecords,
  saving,
  onSave,
  onCancel,
}: {
  initialRecord?: MotorCostingRecord | null;
  motorRecords: WindingRecord[];
  saving: boolean;
  onSave: (data: Partial<MotorCostingRecord>) => Promise<void>;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState(initialRecord?.companyName || "");
  const [motorRecordId, setMotorRecordId] = useState(initialRecord?.motorRecordId || "");
  const [jobName, setJobName] = useState(initialRecord?.jobName || "");
  const [jobDate, setJobDate] = useState(
    initialRecord?.jobDate || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initialRecord?.notes || "");

  // Dimensions
  const [frameSize, setFrameSize] = useState(initialRecord?.frameSize || "");
  const [hp, setHp] = useState(initialRecord?.hp || "");
  const [phase, setPhase] = useState(initialRecord?.phase || "");
  const [rpm, setRpm] = useState(initialRecord?.rpm || "");
  const [bodyLength, setBodyLength] = useState(initialRecord?.bodyLength || "");
  const [frontBearingCover, setFrontBearingCover] = useState(
    initialRecord?.frontBearingCover || "",
  );
  const [backBearingCover, setBackBearingCover] = useState(
    initialRecord?.backBearingCover || "",
  );
  const [tbfcLabel, setTbfcLabel] = useState(
    initialRecord?.tbfcLabel && initialRecord.tbfcLabel !== "T.B.F.C."
      ? initialRecord.tbfcLabel
      : "T.E.F.C."
  );

  // Shaft / Profile Drawing Template State
  const [drawing, setDrawing] = useState<ShaftDrawing | null>(() => {
    if (initialRecord?.drawing && initialRecord.drawing.elements?.length) {
      return initialRecord.drawing;
    }
    if (initialRecord?.drawingData) {
      try {
        const parsed = JSON.parse(initialRecord.drawingData);
        if (parsed && typeof parsed === "object" && parsed.elements?.length) {
          return parsed as ShaftDrawing;
        }
      } catch {}
    }
    return {
      templateId: DEFAULT_SHAFT_TEMPLATE.id,
      templateName: DEFAULT_SHAFT_TEMPLATE.name,
      elements: JSON.parse(JSON.stringify(DEFAULT_SHAFT_TEMPLATE.elements)),
      dimensionValues: {},
      dimensionLabels: {},
      viewBoxWidth: DEFAULT_SHAFT_TEMPLATE.viewBoxWidth,
      viewBoxHeight: DEFAULT_SHAFT_TEMPLATE.viewBoxHeight,
    };
  });

const STORAGE_LABELS_KEY = "emco_costing_custom_labels";

function getPersistentLabels(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_LABELS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function savePersistentLabels(labels: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_LABELS_KEY, JSON.stringify(labels));
  } catch {}
}

function computeLineAmount(qtyStr: string, rateStr: string): number {
  const rateNum = parseFloat(rateStr.replace(/[₹\s,]/g, ""));
  if (Number.isNaN(rateNum) || rateNum <= 0) return 0;
  const qtyNum = parseFloat(qtyStr);
  if (!Number.isNaN(qtyNum) && qtyNum > 0) {
    return Math.round(qtyNum * rateNum * 100) / 100;
  }
  return Math.round(rateNum * 100) / 100;
}

function formatLineAmount(val: number | string | undefined): string {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[₹\s,]/g, ""));
  if (Number.isNaN(num) || num <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

  // Cost Item Labels state (persisted across sessions and saved with record)
  const [itemLabels, setItemLabels] = useState<Record<CostItemKey, string>>(() => {
    const saved = getPersistentLabels();
    const result: Record<CostItemKey, string> = { ...COST_ITEM_LABELS };
    for (const k of COST_ITEM_KEYS) {
      if (saved[k]) {
        result[k] = (k === "tbfc" && saved[k] === "T.B.F.C.") ? "T.E.F.C." : saved[k];
      }
    }
    if (initialRecord?.itemLabels) {
      for (const k of COST_ITEM_KEYS) {
        if (initialRecord.itemLabels[k]) {
          result[k] = (k === "tbfc" && initialRecord.itemLabels[k] === "T.B.F.C.") ? "T.E.F.C." : initialRecord.itemLabels[k]!;
        }
      }
    }
    if (initialRecord?.tbfcLabel) {
      result.tbfc = initialRecord.tbfcLabel === "T.B.F.C." ? "T.E.F.C." : initialRecord.tbfcLabel;
    }
    return result;
  });

  // Rename inline editing state
  const [renamingKey, setRenamingKey] = useState<CostItemKey | null>(null);
  const [tempLabel, setTempLabel] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Quantities state (saved with record, reset for fresh records)
  const [quantities, setQuantities] = useState<Record<CostItemKey, string>>(() => {
    const q: Record<CostItemKey, string> = {} as any;
    for (const k of COST_ITEM_KEYS) {
      if (initialRecord?.itemDetails?.[k]?.quantity !== undefined) {
        q[k] = String(initialRecord.itemDetails[k]!.quantity);
      } else {
        q[k] = "";
      }
    }
    return q;
  });

  // Units state
  const [units, setUnits] = useState<Record<CostItemKey, string>>(() => {
    const u: Record<CostItemKey, string> = {} as any;
    for (const k of COST_ITEM_KEYS) {
      if (initialRecord?.itemDetails?.[k]?.unit) {
        u[k] = initialRecord.itemDetails[k]!.unit!;
      } else {
        u[k] = k === "ciCasting" || k === "copperWire" ? "kg" : "pcs";
      }
    }
    return u;
  });

  // Unit Rates state
  const [rates, setRates] = useState<Record<CostItemKey, string>>(() => {
    const r: Record<CostItemKey, string> = {} as any;
    for (const k of COST_ITEM_KEYS) {
      if (initialRecord?.itemDetails?.[k]?.rate !== undefined) {
        r[k] = String(initialRecord.itemDetails[k]!.rate);
      } else if (initialRecord?.items?.[k]) {
        // Backwards compatibility for older records without quantity/rate fields
        const q = initialRecord.itemDetails?.[k]?.quantity;
        if (q && q > 0) {
          r[k] = String(Math.round((initialRecord.items[k] / q) * 100) / 100);
        } else {
          r[k] = String(initialRecord.items[k]);
        }
      } else {
        r[k] = "";
      }
    }
    return r;
  });

  // Line amounts (items) state
  const [items, setItems] = useState<CostItems>(() => {
    if (initialRecord?.items) {
      return { ...initialRecord.items };
    }
    return emptyCostItems();
  });

  // Price input display strings (shows formatted line amount, e.g. "75,000.00")
  const [priceInputs, setPriceInputs] = useState<Record<CostItemKey, string>>(() => {
    const p: Record<CostItemKey, string> = {} as any;
    for (const k of COST_ITEM_KEYS) {
      if (initialRecord?.items?.[k]) {
        p[k] = formatLineAmount(initialRecord.items[k]);
      } else {
        p[k] = "";
      }
    }
    return p;
  });

  // Compact inline calculator modal state
  const [calcKey, setCalcKey] = useState<CostItemKey | null>(null);
  const [calcExpr, setCalcExpr] = useState("");
  const [calcResult, setCalcResult] = useState<CalcParsedOutput | null>(null);
  const calcInputRef = useRef<HTMLInputElement>(null);

  const [companyError, setCompanyError] = useState("");

  // Instant calculated total
  const totalAmount = useMemo(() => calculateCostTotal(items), [items]);

  const handleStartRename = (key: CostItemKey, currentLabel: string) => {
    setRenamingKey(key);
    setTempLabel(currentLabel);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  };

  const handleSaveRename = (key: CostItemKey) => {
    const trimmed = tempLabel.trim();
    if (trimmed) {
      const updated = { ...itemLabels, [key]: trimmed };
      setItemLabels(updated);
      savePersistentLabels(updated);
      if (key === "tbfc") {
        setTbfcLabel(trimmed);
      }
    }
    setRenamingKey(null);
    setTempLabel("");
  };

  const handleCancelRename = () => {
    setRenamingKey(null);
    setTempLabel("");
  };

  const handleQtyChange = (key: CostItemKey, rawVal: string) => {
    setQuantities((prev) => {
      const nextQ = { ...prev, [key]: rawVal };
      const qNum = parseFloat(rawVal);
      let curRateNum = rates[key] ? parseFloat(rates[key]) : NaN;
      if (Number.isNaN(curRateNum) || curRateNum <= 0) {
        const prevQ = prev[key] ? parseFloat(prev[key]) : NaN;
        if (!Number.isNaN(prevQ) && prevQ > 0 && items[key] > 0) {
          curRateNum = Math.round((items[key] / prevQ) * 100) / 100;
        } else if (items[key] > 0) {
          curRateNum = items[key];
        }
      }

      if (!Number.isNaN(qNum) && qNum > 0 && !Number.isNaN(curRateNum) && curRateNum > 0) {
        const lineAmt = Math.round(qNum * curRateNum * 100) / 100;
        setItems((prevItems) => ({ ...prevItems, [key]: lineAmt }));
        setPriceInputs((prevP) => ({ ...prevP, [key]: formatLineAmount(lineAmt) }));
        setRates((prevR) => ({ ...prevR, [key]: String(curRateNum) }));
      }
      return nextQ;
    });
  };

  const handleUnitChange = (key: CostItemKey, rawUnit: string) => {
    setUnits((prev) => ({ ...prev, [key]: rawUnit }));
  };

  const handlePriceChange = (key: CostItemKey, rawVal: string) => {
    setPriceInputs((prev) => ({ ...prev, [key]: rawVal }));
    const cleaned = rawVal.replace(/[₹\s,]/g, "");
    if (!cleaned) {
      setItems((prev) => ({ ...prev, [key]: 0 }));
      return;
    }
    const num = parseFloat(cleaned);
    if (!Number.isNaN(num) && num >= 0) {
      setItems((prev) => ({ ...prev, [key]: num }));
      const q = quantities[key] ? parseFloat(quantities[key]) : NaN;
      if (!Number.isNaN(q) && q > 0) {
        setRates((prev) => ({ ...prev, [key]: String(Math.round((num / q) * 100) / 100) }));
      } else {
        setRates((prev) => ({ ...prev, [key]: String(num) }));
      }
    }
  };

  const handlePriceBlur = (key: CostItemKey) => {
    const num = items[key] || 0;
    setPriceInputs((prev) => ({ ...prev, [key]: num > 0 ? formatLineAmount(num) : "" }));
  };

  const openCalculator = (key: CostItemKey) => {
    setCalcKey(key);
    const curQty = quantities[key] || "";
    const curUnit = units[key] || (key === "ciCasting" || key === "copperWire" ? "kg" : "pcs");
    let curRate = rates[key] || "";
    if (!curRate || parseFloat(curRate) <= 0) {
      const qNum = curQty ? parseFloat(curQty) : NaN;
      if (!Number.isNaN(qNum) && qNum > 0 && items[key] > 0) {
        curRate = String(Math.round((items[key] / qNum) * 100) / 100);
      } else if (items[key] > 0) {
        curRate = String(items[key]);
      }
    }

    let defaultExpr = "";
    if (curQty && parseFloat(curQty) > 0 && curRate && parseFloat(curRate) > 0) {
      defaultExpr = `${curQty}${curUnit} x ${curRate}`;
    } else if (curRate && parseFloat(curRate) > 0) {
      defaultExpr = curRate;
    } else if (curQty && parseFloat(curQty) > 0) {
      defaultExpr = `${curQty}${curUnit} x `;
    }

    setCalcExpr(defaultExpr);
    if (defaultExpr) {
      setCalcResult(parseCostExpression(defaultExpr, curQty, curUnit));
    } else {
      setCalcResult(null);
    }
    setTimeout(() => {
      calcInputRef.current?.focus();
      calcInputRef.current?.select();
    }, 60);
  };

  const handleCalcExprChange = (expr: string) => {
    setCalcExpr(expr);
    if (!calcKey) return;
    const curQty = quantities[calcKey] || "";
    const curUnit = units[calcKey] || "pcs";
    const res = parseCostExpression(expr, curQty, curUnit);
    setCalcResult(res);
  };

  const handleKeypadAppend = (token: string) => {
    const nextExpr = calcExpr + token;
    handleCalcExprChange(nextExpr);
  };

  const applyCalculator = () => {
    if (!calcKey || !calcResult || !calcResult.isValid) return;

    const key = calcKey;
    if (calcResult.quantity !== undefined) {
      setQuantities((prev) => ({ ...prev, [key]: String(calcResult.quantity) }));
    }
    if (calcResult.unit !== undefined) {
      setUnits((prev) => ({ ...prev, [key]: calcResult.unit! }));
    }
    if (calcResult.rate !== undefined) {
      setRates((prev) => ({ ...prev, [key]: String(calcResult.rate) }));
    }

    const finalAmount =
      calcResult.lineAmount !== undefined
        ? calcResult.lineAmount
        : computeLineAmount(
            calcResult.quantity !== undefined ? String(calcResult.quantity) : (quantities[key] || ""),
            calcResult.rate !== undefined ? String(calcResult.rate) : (rates[key] || "")
          );

    setItems((prev) => ({ ...prev, [key]: finalAmount }));
    setPriceInputs((prev) => ({ ...prev, [key]: formatLineAmount(finalAmount) }));

    setCalcKey(null);
    setCalcExpr("");
    setCalcResult(null);
  };

  const cancelCalculator = () => {
    setCalcKey(null);
    setCalcExpr("");
    setCalcResult(null);
  };

  // Link from existing motor record
  const handleSelectMotor = (selectedId: string) => {
    setMotorRecordId(selectedId);
    if (!selectedId) return;
    const motor = motorRecords.find((m) => m.id === selectedId);
    if (motor) {
      if (!companyName) setCompanyName(motor.companyName);
      setFrameSize(motor.frameSize || "");
      setHp(motor.hp || "");
      setPhase(motor.phase || "");
      setRpm(motor.rpm || "");
      const drawingData = parseDrawingData(motor.drawingData);
      if (drawingData) {
        if (drawingData.bodyLength) setBodyLength(drawingData.bodyLength);
        if (drawingData.frontBearingCover) setFrontBearingCover(drawingData.frontBearingCover);
        if (drawingData.backBearingCover) setBackBearingCover(drawingData.backBearingCover);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setCompanyError("Enter a company or machine name.");
      return;
    }
    setCompanyError("");

    const detailsToSave: CostItemDetails = {};
    for (const key of COST_ITEM_KEYS) {
      const qNum = quantities[key] !== "" ? parseFloat(quantities[key]) : undefined;
      const rNum = rates[key] !== "" ? parseFloat(rates[key]) : undefined;
      detailsToSave[key] = {
        label: itemLabels[key] || COST_ITEM_LABELS[key],
        quantity: qNum !== undefined && !Number.isNaN(qNum) ? qNum : undefined,
        unit: units[key] || "pcs",
        rate: rNum !== undefined && !Number.isNaN(rNum) ? rNum : undefined,
        amount: items[key] || 0,
      };
    }

    await onSave({
      companyName: companyName.trim(),
      motorRecordId: motorRecordId || null,
      jobName: jobName.trim(),
      jobDate: jobDate.trim(),
      notes: notes.trim(),
      frameSize: frameSize.trim(),
      hp: hp.trim(),
      phase: phase.trim(),
      rpm: rpm.trim(),
      bodyLength: bodyLength.trim(),
      frontBearingCover: frontBearingCover.trim(),
      backBearingCover: backBearingCover.trim(),
      tbfcLabel: (itemLabels.tbfc === "T.B.F.C." ? "T.E.F.C." : itemLabels.tbfc) || (tbfcLabel.trim() === "T.B.F.C." ? "T.E.F.C." : tbfcLabel.trim()) || "T.E.F.C.",
      itemLabels,
      itemDetails: detailsToSave,
      items,
      totalAmount,
      drawing: drawing || null,
      drawingData: drawing ? JSON.stringify(drawing) : "",
    });
  };

  return (
    <>
      <section className="page-intro compact no-print">
        <div>
          <p className="eyebrow">{initialRecord ? "Edit Costing" : "New Costing Sheet"}</p>
          <h1>{initialRecord ? "Update Costing Record." : "Create Motor Costing Sheet."}</h1>
          <p>
            Enter motor specifications and itemized prices in INR (₹). Total Amount is calculated
            automatically and updates live as you type.
          </p>
        </div>
      </section>

      <form className="record-form costing-form" onSubmit={handleSubmit} noValidate>
        {/* LINK WITH MOTOR RECORD */}
        {motorRecords.length > 0 && (
          <section className="form-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Link Motor Library</p>
                <h3>Reuse Existing Motor Information</h3>
              </div>
              <p>Select a motor to avoid re-entering frame size, HP, and dimensions.</p>
            </div>
            <div className="field-grid single-column" style={{ marginTop: 14 }}>
              <label className="field">
                <span className="field-label">Choose Saved Motor Record <em>Optional</em></span>
                <select
                  className="input"
                  value={motorRecordId}
                  onChange={(e) => handleSelectMotor(e.target.value)}
                >
                  <option value="">— Select an existing motor (or enter custom) —</option>
                  {motorRecords.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.companyName} (Frame {m.frameSize}, {m.hp} HP, {m.rpm} RPM)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {/* MOTOR IDENTIFICATION & DIMENSIONS */}
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Motor / Dimensions</p>
              <h3>Motor & Dimension Specifications</h3>
            </div>
            <p>Physical characteristics (excluded from total cost calculation).</p>
          </div>
          <div className="field-grid motor-grid">
            <label className="field wide">
              <span className="field-label">Company / Machine Name <b>Required</b></span>
              <input
                className={`input ${companyError ? "input-error" : ""}`}
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (companyError) setCompanyError("");
                }}
                placeholder="e.g. EMCO ELECTRICAL — 5HP Submersible"
                required
              />
              {companyError && <span className="field-error">{companyError}</span>}
            </label>
            <label className="field">
              <span className="field-label">Frame <em>Optional</em></span>
              <input
                className="input"
                value={frameSize}
                onChange={(e) => setFrameSize(e.target.value)}
                placeholder="e.g. 71, 80, 90"
              />
            </label>
            <label className="field">
              <span className="field-label">HP <em>Optional</em></span>
              <input
                className="input"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="e.g. 0.5, 3, 5"
              />
            </label>
            <label className="field">
              <span className="field-label">Phase <em>Optional</em></span>
              <input
                className="input"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="1 or 3"
              />
            </label>
            <label className="field">
              <span className="field-label">RPM <em>Optional</em></span>
              <input
                className="input"
                value={rpm}
                onChange={(e) => setRpm(e.target.value)}
                placeholder="e.g. 1440"
              />
            </label>
            <label className="field">
              <span className="field-label">Body Length (mm) <em>Optional</em></span>
              <input
                className="input"
                value={bodyLength}
                onChange={(e) => setBodyLength(e.target.value)}
                placeholder="e.g. 210"
              />
            </label>
            <label className="field">
              <span className="field-label">Front Bearing Cover (mm) <em>Optional</em></span>
              <input
                className="input"
                value={frontBearingCover}
                onChange={(e) => setFrontBearingCover(e.target.value)}
                placeholder="e.g. 35"
              />
            </label>
            <label className="field">
              <span className="field-label">Back Bearing Cover (mm) <em>Optional</em></span>
              <input
                className="input"
                value={backBearingCover}
                onChange={(e) => setBackBearingCover(e.target.value)}
                placeholder="e.g. 30"
              />
            </label>
          </div>
        </section>

        {/* COST ITEMS SECTION */}
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cost Items</p>
              <h3>Materials, Parts & Labor (INR ₹)</h3>
            </div>
            <p>Enter the cost for each line item. Non-negative decimal numbers permitted.</p>
          </div>

          <div className="field-grid costing-items-grid">
            {COST_ITEM_KEYS.map((key) => {
              const defaultLabel = COST_ITEM_LABELS[key];
              const currentLabel = itemLabels[key] || defaultLabel;
              const currentQty = quantities[key] || "";
              const currentUnit = units[key] || (key === "ciCasting" || key === "copperWire" ? "kg" : "pcs");
              const lineAmount = items[key] || 0;
              const isStandardUnit = (COMMON_COST_UNITS as readonly string[]).includes(currentUnit);

              return (
                <div key={key} className="cost-input-card">
                  {/* LABEL & RENAME AREA */}
                  <div className="cost-input-label-area">
                    {renamingKey === key ? (
                      <div className="rename-item-form">
                        <input
                          ref={renameInputRef}
                          type="text"
                          className="input rename-item-input"
                          value={tempLabel}
                          onChange={(e) => setTempLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveRename(key);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              handleCancelRename();
                            }
                          }}
                          placeholder="Item name"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="rename-action-btn save"
                          onClick={() => handleSaveRename(key)}
                          title="Save renamed label"
                          aria-label="Save renamed label"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="rename-action-btn cancel"
                          onClick={handleCancelRename}
                          title="Cancel rename"
                          aria-label="Cancel rename"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="cost-label-title-row">
                        <span className="field-label cost-item-name">{currentLabel}</span>
                        <button
                          type="button"
                          className="rename-item-btn"
                          onClick={() => handleStartRename(key, currentLabel)}
                          title="Rename item"
                          aria-label={`Rename ${currentLabel}`}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CONTROLS AREA (QTY, UNIT & PRICE) */}
                  <div className="cost-item-controls">
                    {/* QUANTITY & UNIT AREA */}
                    <div className="cost-qty-unit-area">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="input cost-qty-input"
                        value={currentQty}
                        onChange={(e) => handleQtyChange(key, e.target.value)}
                        placeholder="Qty"
                        title="Quantity (e.g. 15)"
                      />
                      <select
                        className="input cost-unit-select"
                        value={isStandardUnit ? currentUnit : "__custom__"}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            handleUnitChange(key, "");
                          } else {
                            handleUnitChange(key, e.target.value);
                          }
                        }}
                        title="Select unit of measurement"
                      >
                        {COMMON_COST_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {!isStandardUnit && (
                        <input
                          type="text"
                          className="input cost-unit-custom-input"
                          value={currentUnit}
                          onChange={(e) => handleUnitChange(key, e.target.value)}
                          placeholder="Unit"
                          title="Enter custom unit (e.g. set, coil, box)"
                          autoFocus
                        />
                      )}
                    </div>

                    {/* PRICE & CALCULATOR AREA */}
                    <div className="cost-rate-area">
                      <div className="currency-input-wrapper">
                        <span className="currency-prefix">₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input currency-input"
                          value={priceInputs[key] ?? ""}
                          onChange={(e) => handlePriceChange(key, e.target.value)}
                          onBlur={() => handlePriceBlur(key)}
                          onClick={() => openCalculator(key)}
                          placeholder="0.00"
                          title="Click to open compact calculator"
                        />
                        <button
                          type="button"
                          className="calc-open-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCalculator(key);
                          }}
                          title="Open calculator"
                          aria-label={`Open calculator for ${currentLabel}`}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="4" y="2" width="16" height="20" rx="2" />
                            <line x1="8" y1="6" x2="16" y2="6" />
                            <line x1="16" y1="14" x2="16" y2="18" />
                            <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LIVE TOTAL AMOUNT BAR */}
          <div className="live-total-bar">
            <div>
              <span className="live-total-title">Total Amount (Automatically Calculated)</span>
              <small>Sum of all 12 cost items. Excludes dimensions and identity values.</small>
            </div>
            <div className="live-total-display">
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </section>

        {/* SHAFT / PROFILE DRAWING TEMPLATE SECTION */}
        <CostingShaftSection
          drawing={drawing}
          onChangeDrawing={setDrawing}
        />

        {/* OPTIONAL SECONDARY DETAILS */}
        <section className="form-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quotation Details</p>
              <h3>Customer & Job Info (Optional)</h3>
            </div>
            <p>Kept visually secondary to maintain a clean workshop form.</p>
          </div>
          <div className="field-grid two-grid">
            <label className="field">
              <span className="field-label">Customer / Job Name <em>Optional</em></span>
              <input
                className="input"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Patel Brothers Farms"
              />
            </label>
            <label className="field">
              <span className="field-label">Job Date <em>Optional</em></span>
              <input
                type="date"
                className="input"
                value={jobDate}
                onChange={(e) => setJobDate(e.target.value)}
              />
            </label>
            <label className="field wide-mobile" style={{ gridColumn: "1 / -1" }}>
              <span className="field-label">Notes & Remarks <em>Optional</em></span>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Includes delivery to bench, copper grade F class"
              />
            </label>
          </div>
        </section>

        <div className="form-actions no-print">
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? "Saving Costing…" : initialRecord ? "Update Costing Sheet" : "Save Costing Sheet"}
          </button>
          <button
            type="button"
            className="button button-ghost"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* COMPACT INLINE CALCULATOR MODAL */}
      {calcKey && (
        <div className="modal-backdrop" onClick={cancelCalculator}>
          <div className="inline-calc-card" onClick={(e) => e.stopPropagation()}>
            <div className="calc-card-head">
              <div>
                <span className="calc-eyebrow">Cost Calculator</span>
                <h4>{itemLabels[calcKey] || COST_ITEM_LABELS[calcKey]}</h4>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={cancelCalculator}
                aria-label="Close calculator"
              >
                ✕
              </button>
            </div>

            <div className="calc-body">
              <label className="field">
                <span className="field-label">Formula or Price Expression</span>
                <input
                  ref={calcInputRef}
                  type="text"
                  className="input calc-expr-input"
                  value={calcExpr}
                  onChange={(e) => handleCalcExprChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCalculator();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelCalculator();
                    }
                  }}
                  placeholder="e.g. 15kg x 500 or 500 + 50"
                  autoFocus
                />
              </label>

              <div
                className={`calc-preview-box ${
                  calcResult?.isValid ? "valid" : calcExpr.trim() ? "invalid" : "idle"
                }`}
              >
                {calcResult?.isValid ? (
                  <div>
                    <div className="calc-preview-top">
                      <span className="calc-preview-label">Live Line Amount:</span>
                      <strong className="calc-preview-total">
                        {formatCurrency(calcResult.lineAmount)}
                      </strong>
                    </div>
                    <div className="calc-preview-detail">{calcResult.displayText}</div>
                  </div>
                ) : calcExpr.trim() ? (
                  <div className="calc-error-preview">
                    ⚠️ {calcResult?.error || "Invalid calculation expression."}
                  </div>
                ) : (
                  <div className="calc-hint-preview">
                    Type direct price, arithmetic (<code>450 + 50</code>), or formula with unit (
                    <code>15kg x 500</code>).
                  </div>
                )}
              </div>

              <div className="calc-keypad">
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("7")}>
                  7
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("8")}>
                  8
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("9")}>
                  9
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend(" ÷ ")}
                >
                  ÷
                </button>
                <button
                  type="button"
                  className="calc-key danger"
                  onClick={() => handleCalcExprChange("")}
                  title="Clear"
                >
                  C
                </button>

                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("4")}>
                  4
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("5")}>
                  5
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("6")}>
                  6
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend(" × ")}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="calc-key unit"
                  onClick={() => handleKeypadAppend("kg")}
                >
                  kg
                </button>

                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("1")}>
                  1
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("2")}>
                  2
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("3")}>
                  3
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend(" - ")}
                >
                  -
                </button>
                <button
                  type="button"
                  className="calc-key unit"
                  onClick={() => handleKeypadAppend("pcs")}
                >
                  pcs
                </button>

                <button type="button" className="calc-key" onClick={() => handleKeypadAppend("0")}>
                  0
                </button>
                <button type="button" className="calc-key" onClick={() => handleKeypadAppend(".")}>
                  .
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend(" + ")}
                >
                  +
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend("(")}
                >
                  (
                </button>
                <button
                  type="button"
                  className="calc-key op"
                  onClick={() => handleKeypadAppend(")")}
                >
                  )
                </button>
              </div>

              <div className="calc-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={cancelCalculator}
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={applyCalculator}
                  disabled={!calcResult?.isValid}
                >
                  Confirm & Apply (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PriceAdjustmentModal({
  targetRecord,
  selectedIds,
  records,
  onClose,
  onSuccess,
}: {
  targetRecord: MotorCostingRecord | null;
  selectedIds: string[];
  records: MotorCostingRecord[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [percentage, setPercentage] = useState("5");
  const [scope, setScope] = useState<"single" | "selected" | "all">(
    targetRecord ? "single" : selectedIds.length > 0 ? "selected" : "all",
  );
  const [note, setNote] = useState("");
  const [previewData, setPreviewData] = useState<{
    percentage?: number;
    totalRecords: number;
    totalOldAmount: number;
    totalNewAmount: number;
    preview: Array<{
      id: string;
      companyName: string;
      frameSize: string;
      oldTotal: number;
      newTotal: number;
      diff: number;
      hasSamePercentage: boolean;
      lastAdjustmentPercentage?: number;
      lastAdjustmentDate?: string;
    }>;
  } | null>(null);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const targetIds = useMemo(() => {
    if (scope === "single" && targetRecord) return [targetRecord.id];
    if (scope === "selected") return selectedIds;
    return [];
  }, [scope, targetRecord, selectedIds]);

  const loadPreview = async () => {
    const pct = parseFloat(percentage);
    if (!Number.isFinite(pct)) {
      setErrorMsg("Please enter a valid percentage number.");
      return;
    }
    setErrorMsg("");
    setLoadingPreview(true);
    try {
      const response = await fetch("/api/costing/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          recordIds: targetIds,
          percentage: pct,
          note,
          preview: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to calculate preview.");
      setPreviewData(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    const pct = parseFloat(percentage);
    if (!previewData) {
      await loadPreview();
      return;
    }

    const hasDuplicateWarning = previewData.preview.some((p) => p.hasSamePercentage);
    let confirmPrompt = `Apply +${pct}% price increase to ${previewData.totalRecords} costing record(s)?\n\nOld Total: ${formatCurrency(previewData.totalOldAmount)} ➔ New Total: ${formatCurrency(previewData.totalNewAmount)}`;
    if (hasDuplicateWarning) {
      confirmPrompt = `⚠️ WARNING: A +${pct}% increase was already applied to one or more of these records previously.\n\nAre you sure you want to apply another +${pct}% increase?\n\n` + confirmPrompt;
    }

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setApplying(true);
    try {
      const response = await fetch("/api/costing/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          recordIds: targetIds,
          percentage: pct,
          note,
          preview: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not apply price adjustment.");
      alert(`Successfully updated prices for ${data.updatedCount} record(s).`);
      await onSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error applying price adjustment.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="drawing-modal adjust-modal">
        <div className="drawing-modal-head">
          <div>
            <h3>Apply Percentage Price Adjustment</h3>
            <p>Enter a percentage increase (e.g. 5%) and preview the old vs. new line items before applying.</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="adjust-modal-body">
          {errorMsg && <div className="notice error">{errorMsg}</div>}

          {/* Scope selection */}
          <div className="field">
            <span className="field-label">Scope of Adjustment</span>
            <div className="scope-radio-grid">
              {targetRecord && (
                <label className="radio-choice">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "single"}
                    onChange={() => {
                      setScope("single");
                      setPreviewData(null);
                    }}
                  />
                  <span>
                    <b>This Record Only:</b> {targetRecord.companyName}
                  </span>
                </label>
              )}
              {selectedIds.length > 0 && (
                <label className="radio-choice">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "selected"}
                    onChange={() => {
                      setScope("selected");
                      setPreviewData(null);
                    }}
                  />
                  <span>
                    <b>Selected Records ({selectedIds.length})</b>
                  </span>
                </label>
              )}
              <label className="radio-choice">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "all"}
                  onChange={() => {
                    setScope("all");
                    setPreviewData(null);
                  }}
                />
                <span>
                  <b>All Applicable Records</b> ({records.length} active records)
                </span>
              </label>
            </div>
          </div>

          <div className="modal-grid-2">
            <label className="field">
              <span className="field-label">Increase Percentage (%) <b>Required</b></span>
              <div className="percentage-input-wrapper">
                <input
                  type="number"
                  step="0.5"
                  className="input percentage-input"
                  value={percentage}
                  onChange={(e) => {
                    setPercentage(e.target.value);
                    setPreviewData(null);
                  }}
                  placeholder="e.g. 5"
                  required
                />
                <span className="pct-symbol">%</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">Reason / Adjustment Note <em>Optional</em></span>
              <input
                type="text"
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Copper price rise Q4"
              />
            </label>
          </div>

          <div className="preview-trigger-area">
            <button
              type="button"
              className="button button-secondary"
              onClick={loadPreview}
              disabled={loadingPreview}
            >
              {loadingPreview ? "Calculating Preview…" : "👁️ Preview Increase Details"}
            </button>
          </div>

          {/* PREVIEW TABLE */}
          {previewData && (
            <div className="adjustment-preview-box">
              <div className="preview-summary-card">
                <div>
                  <span>Affected Records: <b>{previewData.totalRecords}</b></span>
                  <span>Adjustment: <b>+{previewData.percentage}%</b></span>
                </div>
                <div className="preview-total-diff">
                  <span>Old Total: {formatCurrency(previewData.totalOldAmount)}</span>
                  <span>➔</span>
                  <span className="new-total">New Total: {formatCurrency(previewData.totalNewAmount)}</span>
                  <span className="diff-badge">
                    (+{formatCurrency(previewData.totalNewAmount - previewData.totalOldAmount)})
                  </span>
                </div>
              </div>

              <div className="preview-records-table-wrapper">
                <table className="preview-records-table">
                  <thead>
                    <tr>
                      <th>Motor Record</th>
                      <th>Frame</th>
                      <th>Old Total</th>
                      <th>New Total (+{percentage}%)</th>
                      <th>Difference</th>
                      <th>Status / Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.companyName}</strong></td>
                        <td>{p.frameSize || "—"}</td>
                        <td>{formatCurrency(p.oldTotal)}</td>
                        <td><strong>{formatCurrency(p.newTotal)}</strong></td>
                        <td className="text-pos">+{formatCurrency(p.diff)}</td>
                        <td>
                          {p.hasSamePercentage ? (
                            <span className="badge-warn" title="Same percentage already applied previously">
                              ⚠️ +{percentage}% already applied
                            </span>
                          ) : p.lastAdjustmentPercentage ? (
                            <span className="badge-neutral">
                              Prev: +{p.lastAdjustmentPercentage}%
                            </span>
                          ) : (
                            <span className="badge-ok">Base Price</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="button button-primary"
              disabled={applying || !previewData}
              onClick={handleApply}
            >
              {applying ? "Applying…" : `Confirm & Apply +${percentage}% Increase`}
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={applying}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
