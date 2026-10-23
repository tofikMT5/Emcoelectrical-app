"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DEFAULT_SHAFT_TEMPLATE,
  DEFAULT_SHAFT_TEMPLATES,
  type ShaftDrawing,
  type ShaftDrawingTemplate,
} from "@/lib/winding";

// ─── SVG VIEWER / RENDERER COMPONENT ──────────────────────────────────────────

export function ShaftDrawingSVG({
  drawing,
  className = "",
}: {
  drawing?: ShaftDrawing | null;
  interactive?: boolean;
  selectedId?: string | null;
  onSelectElement?: (id: string | null) => void;
  className?: string;
}) {
  if (!drawing || !drawing.elements || drawing.elements.length === 0) {
    return (
      <div className="shaft-empty-preview">
        <p>No shaft profile drawing selected.</p>
      </div>
    );
  }

  const viewBoxWidth = drawing.viewBoxWidth || 800;
  const viewBoxHeight = drawing.viewBoxHeight || 360;
  const dimValues = drawing.dimensionValues || {};
  const dimLabels = drawing.dimensionLabels || {};

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={`shaft-svg-canvas ${className}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Crisp technical dimension arrows */}
        <marker
          id="dim-arrow-start"
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 8 1.5 L 2 5 L 8 8.5 z" fill="#1e293b" />
        </marker>
        <marker
          id="dim-arrow-end"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 2 1.5 L 8 5 L 2 8.5 z" fill="#1e293b" />
        </marker>
      </defs>

      {/* Clean technical white sheet */}
      <rect
        x="0"
        y="0"
        width={viewBoxWidth}
        height={viewBoxHeight}
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {/* Render elements */}
      {drawing.elements.map((el) => {
        if (el.type === "line") {
          const isCenter = el.id.includes("center") || el.strokeDasharray;
          return (
            <line
              key={el.id}
              x1={el.x1}
              y1={el.y1}
              x2={el.x2}
              y2={el.y2}
              stroke={isCenter ? "#94a3b8" : "#0f172a"}
              strokeWidth={el.strokeWidth || 2}
              strokeDasharray={el.strokeDasharray || (isCenter ? "8 5" : undefined)}
              strokeLinecap="round"
            />
          );
        }

        if (el.type === "dimension") {
          const rawValue = dimValues[el.id] !== undefined ? dimValues[el.id] : el.value || "";
          const rawLabel = dimLabels[el.id] !== undefined ? dimLabels[el.id] : el.label || "";
          const isVertical = Math.abs(el.x1 - el.x2) < 2;

          if (isVertical) {
            const x = el.x1;
            const minY = Math.min(el.y1, el.y2);
            const maxY = Math.max(el.y1, el.y2);
            const midY = (minY + maxY) / 2;

            const trimmedVal = rawValue.trim();
            const displayText = trimmedVal
              ? (trimmedVal.toLowerCase().endsWith("mm") ? trimmedVal : `${trimmedVal} mm`)
              : "— mm";
            const subText = rawLabel ? rawLabel : "";

            // Keep pill compact to prevent overlap with adjacent steps
            const stepWidth = x === 100 ? 80 : x === 175 ? 70 : x === 240 ? 60 : x === 420 ? 300 : x === 600 ? 60 : x === 660 ? 60 : 50;
            const maxW = Math.min(stepWidth - 6, 76);
            const textChars = Math.max(displayText.length, subText.length);
            const pillWidth = Math.max(44, Math.min(maxW, textChars * 6.5 + 10));
            const pillHeight = subText ? 22 : 16;

            return (
              <g key={el.id} className="dimension-group dimension-vertical">
                {/* Vertical dimension line with arrowheads touching top and bottom step profile edges */}
                <line
                  x1={x}
                  y1={minY}
                  x2={x}
                  y2={maxY}
                  stroke="#1e293b"
                  strokeWidth={1.25}
                  markerStart="url(#dim-arrow-start)"
                  markerEnd="url(#dim-arrow-end)"
                />

                {/* Small boundary ticks */}
                <line
                  x1={x - 4}
                  y1={minY}
                  x2={x + 4}
                  y2={minY}
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <line
                  x1={x - 4}
                  y1={maxY}
                  x2={x + 4}
                  y2={maxY}
                  stroke="#64748b"
                  strokeWidth="1"
                />

                {/* Technical white pill centered at red square position */}
                <rect
                  x={x - pillWidth / 2}
                  y={midY - pillHeight / 2}
                  width={pillWidth}
                  height={pillHeight}
                  fill="#ffffff"
                  rx="3"
                  stroke="#cbd5e1"
                  strokeWidth="0.5"
                />

                {/* Dimension measurement value (e.g. 25 mm or — mm) */}
                <text
                  x={x}
                  y={midY - (subText ? 4 : 0)}
                  fill={trimmedVal ? "#0f172a" : "#94a3b8"}
                  fontSize={pillWidth < 50 ? "9" : "10"}
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {displayText}
                </text>

                {/* Secondary descriptive label */}
                {subText && (
                  <text
                    x={x}
                    y={midY + 5.5}
                    fill="#64748b"
                    fontSize={pillWidth < 50 ? "6.5" : "7.5"}
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {subText}
                  </text>
                )}
              </g>
            );
          }

          const offset = el.offset || -30;

          // Dimension line is shifted by offset perpendicular to profile
          const dimY = el.y1 + offset;
          const minX = Math.min(el.x1, el.x2);
          const maxX = Math.max(el.x1, el.x2);
          const midX = (minX + maxX) / 2;

          // Extension lines from profile points towards dimension line
          const ext1Y1 = Math.min(el.y1, dimY) - 4;
          const ext1Y2 = Math.max(el.y1, dimY) + 4;
          const ext2Y1 = Math.min(el.y2, dimY) - 4;
          const ext2Y2 = Math.max(el.y2, dimY) + 4;

          const trimmedVal = rawValue.trim();
          const displayText = trimmedVal
            ? (trimmedVal.toLowerCase().endsWith("mm") ? trimmedVal : `${trimmedVal} mm`)
            : "— mm";
          const subText = rawLabel ? rawLabel : "";
          const pillWidth = Math.max(76, Math.max(displayText.length * 7, subText.length * 6) + 14);

          return (
            <g key={el.id} className="dimension-group dimension-horizontal">
              {/* Extension lines at both ends */}
              <line
                x1={el.x1}
                y1={ext1Y1}
                x2={el.x1}
                y2={ext1Y2}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <line
                x1={el.x2}
                y1={ext2Y1}
                x2={el.x2}
                y2={ext2Y2}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />

              {/* Main dimension line with arrowheads */}
              <line
                x1={minX}
                y1={dimY}
                x2={maxX}
                y2={dimY}
                stroke="#1e293b"
                strokeWidth={1.25}
                markerStart="url(#dim-arrow-start)"
                markerEnd="url(#dim-arrow-end)"
              />

              {/* Text label background pill */}
              <rect
                x={midX - pillWidth / 2}
                y={dimY - (subText ? 18 : 11)}
                width={pillWidth}
                height={subText ? 24 : 16}
                fill="#ffffff"
                rx="3"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />

              {/* Dimension measurement value (e.g. 60 mm or — mm placeholder) */}
              <text
                x={midX}
                y={dimY - (subText ? 5 : 0)}
                fill={trimmedVal ? "#0f172a" : "#94a3b8"}
                fontSize="11"
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {displayText}
              </text>

              {/* Optional secondary descriptive label (e.g. Front Extension) */}
              {subText && (
                <text
                  x={midX}
                  y={dimY + 5}
                  fill="#64748b"
                  fontSize="7.5"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {subText}
                </text>
              )}
            </g>
          );
        }

        if (el.type === "text") {
          return (
            <text
              key={el.id}
              x={el.x}
              y={el.y}
              fill="#1e293b"
              fontSize={el.fontSize || 12}
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              textAnchor="middle"
            >
              {el.text}
            </text>
          );
        }

        return null;
      })}
    </svg>
  );
}

// ─── COSTING SECTION COMPONENT (EMBEDDED IN COSTING FORM) ─────────────────────

export function CostingShaftSection({
  drawing,
  onChangeDrawing,
}: {
  drawing?: ShaftDrawing | null;
  onChangeDrawing: (drawing: ShaftDrawing | null) => void;
}) {
  const [templates, setTemplates] = useState<ShaftDrawingTemplate[]>([]);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function initTemplates() {
      try {
        const res = await fetch("/api/costing/templates");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && Array.isArray(data.templates)) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.warn("Could not load templates:", err);
      }
    }
    void initTemplates();
    return () => {
      ignore = true;
    };
  }, []);

  const reloadTemplates = async () => {
    try {
      const res = await fetch("/api/costing/templates");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
      }
    } catch (err) {
      console.warn("Could not reload templates:", err);
    }
  };

  // Current drawing object (or null if user selected none)
  const currentDrawing: ShaftDrawing | null = useMemo(() => {
    if (drawing === null) {
      return null;
    }
    if (drawing && drawing.elements && drawing.elements.length > 0) {
      if (drawing.templateId) {
        const tpl = DEFAULT_SHAFT_TEMPLATES.find((t) => t.id === drawing.templateId);
        if (tpl) {
          return {
            ...drawing,
            elements: JSON.parse(JSON.stringify(tpl.elements)),
            viewBoxWidth: tpl.viewBoxWidth,
            viewBoxHeight: tpl.viewBoxHeight,
          };
        }
      }
      return drawing;
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
  }, [drawing]);

  // Select a template from the dropdown
  const handleSelectTemplate = (templateId: string) => {
    if (!templateId) {
      // None / remove drawing
      onChangeDrawing(null);
      return;
    }

    const t = templates.find((tpl) => tpl.id === templateId);
    if (t) {
      onChangeDrawing({
        templateId: t.id,
        templateName: t.name,
        elements: JSON.parse(JSON.stringify(t.elements)),
        dimensionValues: {},
        dimensionLabels: {},
        viewBoxWidth: t.viewBoxWidth || 800,
        viewBoxHeight: t.viewBoxHeight || 360,
      });
    }
  };

  // Change a dimension value right in the costing form
  const handleDimensionValueChange = (dimId: string, newValue: string) => {
    if (!currentDrawing) return;
    const updatedValues = {
      ...(currentDrawing.dimensionValues || {}),
      [dimId]: newValue,
    };
    onChangeDrawing({
      ...currentDrawing,
      dimensionValues: updatedValues,
    });
  };

  // Change a dimension label right in the costing form
  const handleDimensionLabelChange = (dimId: string, newLabel: string) => {
    if (!currentDrawing) return;
    const updatedLabels = {
      ...(currentDrawing.dimensionLabels || {}),
      [dimId]: newLabel,
    };
    onChangeDrawing({
      ...currentDrawing,
      dimensionLabels: updatedLabels,
    });
  };

  // Extract all dimension elements for instant inline number editing
  const dimensionElements = useMemo(() => {
    return (currentDrawing?.elements || []).filter((el) => el.type === "dimension");
  }, [currentDrawing?.elements]);

  const handleOpenRename = () => {
    if (!currentDrawing?.templateId) return;
    setRenameDraft(currentDrawing.templateName || "");
    setRenameError("");
    setRenameModalOpen(true);
  };

  const handleSaveRename = async () => {
    if (!currentDrawing?.templateId) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      setRenameError("Template name cannot be empty.");
      return;
    }

    const isDuplicate = templates.some(
      (t) =>
        t.id !== currentDrawing.templateId &&
        t.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) {
      setRenameError("A template with this name already exists. Please choose a different name.");
      return;
    }

    setSavingRename(true);
    setRenameError("");
    try {
      const res = await fetch(`/api/costing/templates/${encodeURIComponent(currentDrawing.templateId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to rename template.");
      }

      await reloadTemplates();

      // Update active drawing templateName in this costing sheet
      onChangeDrawing({
        ...currentDrawing,
        templateName: trimmed,
      });

      setRenameModalOpen(false);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename template.");
    } finally {
      setSavingRename(false);
    }
  };

  return (
    <section className="form-section shaft-drawing-form-section">
      <div className="section-heading">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Technical Reference Sketch</p>
            <h3>Shaft / Profile Drawing & Dimensions</h3>
          </div>
          <span className="workshop-pill">Workshop Tool</span>
        </div>
        <p>
          Select a reusable shaft template. Edit dimension values below for this costing sheet without
          changing the master template.
        </p>
      </div>

      {/* TEMPLATE PICKER BAR */}
      <div className="shaft-template-bar">
        <div className="template-select-wrap">
          <label className="field-label" htmlFor="shaft-template-select">
            Template:
          </label>
          <select
            id="shaft-template-select"
            className="input select-input"
            value={currentDrawing ? (currentDrawing.templateId || "") : ""}
            onChange={(e) => handleSelectTemplate(e.target.value)}
          >
            <option value="">— None (No Drawing) —</option>
            <optgroup label="Saved Master Templates">
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {currentDrawing && currentDrawing.templateId && (
          <div className="template-actions-wrap">
            <button
              type="button"
              className="button button-secondary compact"
              onClick={handleOpenRename}
              title="Rename the currently selected master template"
            >
              ✏️ Rename Template
            </button>
          </div>
        )}
      </div>

      {/* DRAWING PREVIEW CANVAS */}
      {currentDrawing ? (
        <div className="shaft-preview-container">
          <div className="shaft-preview-card">
            <div className="shaft-preview-header">
              <span className="shaft-template-badge">
                {currentDrawing.templateName || "Shaft Profile"}
              </span>
              <small className="shaft-hint">
                Thin black outline • mm dimension labels • Included in quotation print & PDF
              </small>
            </div>

            <div className="shaft-svg-box">
              <ShaftDrawingSVG drawing={currentDrawing} />
            </div>
          </div>

          {/* DIMENSION NUMBERS QUICK-EDIT */}
          {dimensionElements.length > 0 && (
            <div className="dimension-numbers-panel">
              <div className="dim-panel-header">
                <h4>Per-Record Dimension Numbers (mm)</h4>
                <p>
                  Changing these numbers updates the drawing immediately for this costing sheet only.
                </p>
              </div>

              <div className="dim-fields-grid">
                {dimensionElements.map((dim, idx) => {
                  const currentVal =
                    currentDrawing.dimensionValues?.[dim.id] !== undefined
                      ? currentDrawing.dimensionValues[dim.id]
                      : dim.value || "";
                  const currentLabel =
                    currentDrawing.dimensionLabels?.[dim.id] !== undefined
                      ? currentDrawing.dimensionLabels[dim.id]
                      : dim.label || `Dimension ${idx + 1}`;

                  return (
                    <div key={dim.id} className="dim-field-card">
                      <input
                        type="text"
                        className="dim-field-label-input"
                        value={currentLabel}
                        onChange={(e) => handleDimensionLabelChange(dim.id, e.target.value)}
                        placeholder="Label"
                        title="Click to edit dimension label"
                      />
                      <input
                        type="text"
                        className="input dim-field-input"
                        value={currentVal}
                        onChange={(e) => handleDimensionValueChange(dim.id, e.target.value)}
                        placeholder="e.g. mm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="shaft-empty-preview">
          <p>No shaft profile drawing selected for this costing sheet.</p>
        </div>
      )}

      {/* RENAME TEMPLATE MODAL */}
      {renameModalOpen && (
        <div className="submodal-backdrop" role="dialog" aria-modal="true">
          <div className="submodal-box" style={{ maxWidth: 420 }}>
            <h3>Rename Master Template</h3>
            <p>
              Enter a new name for the saved template. Existing and future records
              referencing this template will display the updated name.
            </p>

            {renameError && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {renameError}
              </div>
            )}

            <input
              type="text"
              className="input"
              value={renameDraft}
              onChange={(e) => {
                setRenameDraft(e.target.value);
                setRenameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveRename();
                } else if (e.key === "Escape") {
                  setRenameModalOpen(false);
                }
              }}
              placeholder="e.g. Single Phase Common Shaft"
              autoFocus
            />

            <div className="submodal-actions">
              <button
                type="button"
                className="button button-ghost compact"
                onClick={() => setRenameModalOpen(false)}
                disabled={savingRename}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary compact"
                onClick={handleSaveRename}
                disabled={savingRename || !renameDraft.trim()}
              >
                {savingRename ? "Saving…" : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── QUOTATION / PRINT VIEW SECTION ───────────────────────────────────────────

export function CostingQuotationDrawingView({
  record,
}: {
  record: {
    companyName: string;
    frameSize?: string;
    hp?: string;
    phase?: string;
    rpm?: string;
    bodyLength?: string;
    drawing?: ShaftDrawing | null;
    drawingData?: string | null;
  };
}) {
  const drawing = useMemo(() => {
    let resolved: ShaftDrawing | null = null;
    if (record.drawing && record.drawing.elements && record.drawing.elements.length > 0) {
      resolved = record.drawing;
    } else if (record.drawingData) {
      try {
        const parsed = JSON.parse(record.drawingData);
        if (parsed && parsed.elements && parsed.elements.length > 0) {
          resolved = parsed as ShaftDrawing;
        }
      } catch {}
    }
    if (resolved && resolved.templateId) {
      const tpl = DEFAULT_SHAFT_TEMPLATES.find((t) => t.id === resolved.templateId);
      if (tpl) {
        return {
          ...resolved,
          elements: JSON.parse(JSON.stringify(tpl.elements)),
          viewBoxWidth: tpl.viewBoxWidth,
          viewBoxHeight: tpl.viewBoxHeight,
        };
      }
    }
    return resolved;
  }, [record.drawing, record.drawingData]);

  if (!drawing) return null;

  return (
    <section className="quotation-section quotation-drawing-section">
      <div className="section-header-flex">
        <h3 className="section-title">3. Shaft Profile & Reference Dimensions</h3>
        {drawing.templateName && (
          <span className="drawing-template-pill">{drawing.templateName}</span>
        )}
      </div>

      {/* MOTOR IDENTITY STRIP */}
      <div className="drawing-identity-strip">
        <span>
          <strong>Motor:</strong> {record.companyName}
        </span>
        {record.frameSize && (
          <span>
            <strong>Frame:</strong> {record.frameSize}
          </span>
        )}
        {record.hp && (
          <span>
            <strong>HP:</strong> {record.hp} HP
          </span>
        )}
        {record.phase && (
          <span>
            <strong>Phase:</strong> {record.phase} Ph
          </span>
        )}
        {record.rpm && (
          <span>
            <strong>RPM:</strong> {record.rpm}
          </span>
        )}
        {record.bodyLength && (
          <span>
            <strong>Body Length:</strong> {record.bodyLength} mm
          </span>
        )}
      </div>

      {/* CLEAN TECHNICAL SVG DRAWING */}
      <div className="quotation-drawing-paper">
        <ShaftDrawingSVG drawing={drawing} />
      </div>

      <p className="quotation-drawing-note">
        * Dimensions shown in millimeters (mm). Workshop reference drawing for shaft machining and
        fitment.
      </p>
    </section>
  );
}
