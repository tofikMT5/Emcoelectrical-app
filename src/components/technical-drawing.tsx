"use client";

import { useMemo, useRef, useState } from "react";
import {
  NOTEBOOK_SEGMENT_TEMPLATE,
  type MotorDrawingData,
  type ShaftSegment,
  type WindingRecord,
} from "@/lib/winding";

export function parseDrawingData(drawingData?: string | null): MotorDrawingData | null {
  if (!drawingData) return null;
  try {
    const parsed = typeof drawingData === "string" ? JSON.parse(drawingData) : drawingData;
    if (parsed && typeof parsed === "object") {
      return parsed as MotorDrawingData;
    }
  } catch {
    // ignore
  }
  return null;
}

export function hasDrawingDimensions(data: MotorDrawingData | null): boolean {
  if (!data) return false;
  return Boolean(
    data.bodyLength ||
      data.frontBearingCover ||
      data.backBearingCover ||
      (data.shaftSegments && data.shaftSegments.length > 0),
  );
}

export function TechnicalDrawingViewer({
  record,
  onSaveDrawing,
  readOnly = false,
}: {
  record: WindingRecord;
  onSaveDrawing?: (data: MotorDrawingData) => Promise<void>;
  readOnly?: boolean;
}) {
  const drawingData = useMemo(() => parseDrawingData(record.drawingData), [record.drawingData]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const hasData = hasDrawingDimensions(drawingData);

  const bodyLength = drawingData?.bodyLength || "";
  const frontCover = drawingData?.frontBearingCover || "";
  const backCover = drawingData?.backBearingCover || "";
  const segments = drawingData?.shaftSegments || [];

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.6, Math.round((prev + delta) * 10) / 10)));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `motor-sketch-${record.companyName.replace(/\s+/g, "-")}-frame-${record.frameSize || "unknown"}.svg`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const exportPng = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 1760;
      canvas.height = 720;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = pngUrl;
          link.download = `motor-sketch-${record.companyName.replace(/\s+/g, "-")}-frame-${record.frameSize || "unknown"}.png`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(pngUrl);
          }, 1500);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="drawing-container">
      <div className="drawing-header no-print">
        <div className="drawing-title-area">
          <span className="drawing-eyebrow">Technical Reference Sketch</span>
          <h4>Motor Shaft & Body Profile</h4>
          <p>
            Reference 2D dimensioned drawing for Frame {record.frameSize || "—"} ({record.companyName})
          </p>
        </div>
        <div className="drawing-actions">
          <div className="zoom-controls">
            <button
              type="button"
              className="drawing-btn icon-only"
              onClick={() => handleZoom(0.15)}
              title="Zoom In"
              aria-label="Zoom in"
            >
              +
            </button>
            <span className="zoom-text">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="drawing-btn icon-only"
              onClick={() => handleZoom(-0.15)}
              title="Zoom Out"
              aria-label="Zoom out"
            >
              -
            </button>
            <button type="button" className="drawing-btn" onClick={handleReset} title="Reset Zoom">
              Reset
            </button>
          </div>
          {hasData && (
            <>
              <button type="button" className="drawing-btn" onClick={exportSvg} title="Export SVG">
                SVG
              </button>
              <button type="button" className="drawing-btn" onClick={exportPng} title="Export PNG">
                PNG
              </button>
            </>
          )}
          {!readOnly && onSaveDrawing && (
            <button
              type="button"
              className="drawing-btn primary"
              onClick={() => setIsEditing(true)}
            >
              {hasData ? "✏️ Edit Dimensions" : "+ Add Dimensions"}
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="drawing-empty-state">
          <div className="empty-sketch-icon">📐</div>
          <h5>No Dimensions Saved Yet</h5>
          <p>
            Add body length, bearing cover dimensions, and stepped shaft segments to render an
            interactive technical profile for this motor.
          </p>
          {!readOnly && onSaveDrawing && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsEditing(true)}
            >
              Add dimensions to complete drawing
            </button>
          )}
        </div>
      ) : (
        <div className="svg-wrapper">
          <div
            className="svg-zoom-surface"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
            }}
          >
            <svg
              ref={svgRef}
              viewBox="0 0 880 360"
              className="sketch-svg"
              aria-label="Motor Technical Drawing"
            >
              <defs>
                <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eef5" strokeWidth="0.8" />
                </pattern>
                <marker
                  id="arrow-left"
                  viewBox="0 0 10 10"
                  refX="1"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 9 1 L 1 5 L 9 9 z" fill="#1466b8" />
                </marker>
                <marker
                  id="arrow-right"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 1 1 L 9 5 L 1 9 z" fill="#1466b8" />
                </marker>
                <linearGradient id="body-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2c4d6f" />
                  <stop offset="50%" stopColor="#1e3752" />
                  <stop offset="100%" stopColor="#132437" />
                </linearGradient>
                <linearGradient id="shaft-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eef4fa" />
                  <stop offset="50%" stopColor="#c8d7e6" />
                  <stop offset="100%" stopColor="#9fb5cb" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <rect x="0" y="0" width="880" height="360" fill="url(#cad-grid)" rx="6" />

              {/* Title & Metadata Header inside SVG for export */}
              <text x="30" y="32" className="svg-label-bold" fill="#10253f" fontSize="13">
                EMCO ELECTRICAL — MOTOR PROFILE SKETCH
              </text>
              <text x="30" y="50" className="svg-label-sub" fill="#5a6f86" fontSize="11">
                Frame: {record.frameSize || "—"} | HP: {record.hp || "—"} | {record.companyName}
              </text>

              {/* Orientation Labels */}
              <g transform="translate(40, 75)">
                <rect x="0" y="0" width="105" height="22" rx="4" fill="#e9f3fc" stroke="#b8d5f2" />
                <text x="52" y="15" textAnchor="middle" fill="#1466b8" fontSize="10" fontWeight="700">
                  ◀ FRONT (DE)
                </text>
              </g>

              <g transform="translate(735, 75)">
                <rect x="0" y="0" width="105" height="22" rx="4" fill="#e9f3fc" stroke="#b8d5f2" />
                <text x="52" y="15" textAnchor="middle" fill="#1466b8" fontSize="10" fontWeight="700">
                  BACK (NDE) ▶
                </text>
              </g>

              {/* CENTERLINE */}
              <line
                x1="40"
                y1="190"
                x2="840"
                y2="190"
                stroke="#a0b3c6"
                strokeWidth="1"
                strokeDasharray="14, 4, 3, 4"
              />

              {/* SHAFT STEP PROFILE (Rendered along centerline Y=190) */}
              {segments.length > 0 ? (
                (() => {
                  const totalRawLength = segments.reduce((sum, s) => sum + (Number(s.length) || 10), 0);
                  const availableWidth = 720;
                  const startX = 80;
                  let currentX = startX;

                  const heights = [28, 38, 48, 64, 38, 28]; // stepped diameters for notebook profile

                  return (
                    <g className="shaft-segments">
                      {segments.map((seg, idx) => {
                        const len = Number(seg.length) || 20;
                        const segWidth = Math.max(35, Math.round((len / (totalRawLength || 1)) * availableWidth));
                        const segHeight = heights[idx % heights.length];
                        const segY = 190 - segHeight / 2;
                        const segX = currentX;
                        currentX += segWidth;

                        return (
                          <g key={seg.id || idx}>
                            {/* Shaft Segment Rect */}
                            <rect
                              x={segX}
                              y={segY}
                              width={segWidth}
                              height={segHeight}
                              fill="url(#shaft-grad)"
                              stroke="#446182"
                              strokeWidth="1.5"
                            />
                            {/* Segment Dimension line above */}
                            <line
                              x1={segX}
                              y1="115"
                              x2={segX + segWidth}
                              y2="115"
                              stroke="#1466b8"
                              strokeWidth="1.2"
                              markerStart="url(#arrow-left)"
                              markerEnd="url(#arrow-right)"
                            />
                            {/* Tick lines */}
                            <line x1={segX} y1="108" x2={segX} y2="122" stroke="#1466b8" strokeWidth="1" />
                            <line
                              x1={segX + segWidth}
                              y1="108"
                              x2={segX + segWidth}
                              y2="122"
                              stroke="#1466b8"
                              strokeWidth="1"
                            />
                            {/* Segment Value Label */}
                            <text
                              x={segX + segWidth / 2}
                              y="110"
                              textAnchor="middle"
                              fill="#1466b8"
                              fontSize="11"
                              fontWeight="700"
                            >
                              {seg.length} mm
                            </text>
                            {seg.name && (
                              <text
                                x={segX + segWidth / 2}
                                y={segY + segHeight / 2 + 3}
                                textAnchor="middle"
                                fill="#2c4d6f"
                                fontSize="9"
                                fontWeight="600"
                              >
                                {seg.name}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()
              ) : (
                /* Default simplified shaft representation */
                <g>
                  <rect
                    x="90"
                    y="178"
                    width="700"
                    height="24"
                    fill="url(#shaft-grad)"
                    stroke="#446182"
                    strokeWidth="1.5"
                  />
                  <text x="440" y="194" textAnchor="middle" fill="#446182" fontSize="11" fontWeight="600">
                    Shaft Axis
                  </text>
                </g>
              )}

              {/* MOTOR BODY / STATOR PROFILE (Superimposed around center) */}
              <g transform="translate(240, 125)">
                {/* Main Stator Frame Body */}
                <rect
                  x="0"
                  y="0"
                  width="400"
                  height="130"
                  rx="4"
                  fill="url(#body-grad)"
                  stroke="#0b1726"
                  strokeWidth="2"
                />

                {/* Stator Cooling Fins Texture */}
                {[...Array(14)].map((_, i) => (
                  <line
                    key={i}
                    x1={30 + i * 26}
                    y1="6"
                    x2={30 + i * 26}
                    y2="124"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="2"
                  />
                ))}

                {/* Terminal Box atop Frame */}
                <rect
                  x="145"
                  y="-22"
                  width="110"
                  height="22"
                  rx="3"
                  fill="#1b3957"
                  stroke="#0b1726"
                  strokeWidth="1.5"
                />
                <text x="200" y="-8" textAnchor="middle" fill="#e2edfa" fontSize="9" fontWeight="700">
                  TERMINAL BOX
                </text>

                {/* Body Label */}
                <text x="200" y="68" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
                  MOTOR BODY / STATOR
                </text>
                <text x="200" y="85" textAnchor="middle" fill="#93b9df" fontSize="10">
                  FRAME {record.frameSize || "—"}
                </text>
              </g>

              {/* FRONT BEARING COVER (Left shield) */}
              <g transform="translate(200, 140)">
                <path
                  d="M 40 0 L 15 15 L 15 85 L 40 100 Z"
                  fill="#547192"
                  stroke="#1c3755"
                  strokeWidth="1.5"
                />
                <circle cx="28" cy="50" r="14" fill="#e2edf7" stroke="#1c3755" strokeWidth="1.5" />
                <circle cx="28" cy="50" r="6" fill="#1466b8" />
              </g>

              {/* BACK BEARING COVER (Right shield) */}
              <g transform="translate(640, 140)">
                <path
                  d="M 0 0 L 25 15 L 25 85 L 0 100 Z"
                  fill="#547192"
                  stroke="#1c3755"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="50" r="14" fill="#e2edf7" stroke="#1c3755" strokeWidth="1.5" />
                <circle cx="12" cy="50" r="6" fill="#1466b8" />
              </g>

              {/* ================= DIMENSION CALLOUTS AT BOTTOM ================= */}

              {/* 1. Body Length Dimension */}
              {bodyLength && (
                <g transform="translate(240, 275)">
                  <line
                    x1="0"
                    y1="0"
                    x2="400"
                    y2="0"
                    stroke="#1466b8"
                    strokeWidth="1.5"
                    markerStart="url(#arrow-left)"
                    markerEnd="url(#arrow-right)"
                  />
                  <line x1="0" y1="-12" x2="0" y2="10" stroke="#1466b8" strokeWidth="1" />
                  <line x1="400" y1="-12" x2="400" y2="10" stroke="#1466b8" strokeWidth="1" />
                  <rect x="135" y="-10" width="130" height="20" fill="#ffffff" rx="3" />
                  <text x="200" y="4" textAnchor="middle" fill="#10253f" fontSize="11" fontWeight="800">
                    Body: {bodyLength} mm
                  </text>
                </g>
              )}

              {/* 2. Front Bearing Cover Dimension */}
              {frontCover && (
                <g transform="translate(180, 315)">
                  <line
                    x1="0"
                    y1="0"
                    x2="60"
                    y2="0"
                    stroke="#0b6aa6"
                    strokeWidth="1.3"
                    markerStart="url(#arrow-left)"
                    markerEnd="url(#arrow-right)"
                  />
                  <line x1="0" y1="-8" x2="0" y2="8" stroke="#0b6aa6" strokeWidth="1" />
                  <line x1="60" y1="-8" x2="60" y2="8" stroke="#0b6aa6" strokeWidth="1" />
                  <text x="30" y="-8" textAnchor="middle" fill="#0b6aa6" fontSize="10" fontWeight="700">
                    Front Cover: {frontCover} mm
                  </text>
                </g>
              )}

              {/* 3. Back Bearing Cover Dimension */}
              {backCover && (
                <g transform="translate(640, 315)">
                  <line
                    x1="0"
                    y1="0"
                    x2="60"
                    y2="0"
                    stroke="#0b6aa6"
                    strokeWidth="1.3"
                    markerStart="url(#arrow-left)"
                    markerEnd="url(#arrow-right)"
                  />
                  <line x1="0" y1="-8" x2="0" y2="8" stroke="#0b6aa6" strokeWidth="1" />
                  <line x1="60" y1="-8" x2="60" y2="8" stroke="#0b6aa6" strokeWidth="1" />
                  <text x="30" y="-8" textAnchor="middle" fill="#0b6aa6" fontSize="10" fontWeight="700">
                    Back Cover: {backCover} mm
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* SUMMARY SPECS TABLE */}
      {hasData && (
        <div className="drawing-summary-table">
          <div className="drawing-stat">
            <span>Body Length</span>
            <strong>{bodyLength ? `${bodyLength} mm` : "—"}</strong>
          </div>
          <div className="drawing-stat">
            <span>Front Bearing Cover</span>
            <strong>{frontCover ? `${frontCover} mm` : "—"}</strong>
          </div>
          <div className="drawing-stat">
            <span>Back Bearing Cover</span>
            <strong>{backCover ? `${backCover} mm` : "—"}</strong>
          </div>
          <div className="drawing-stat">
            <span>Shaft Segments</span>
            <strong>
              {segments.length > 0
                ? `${segments.map((s) => `${s.length}mm`).join(" + ")} (${segments.reduce((acc, s) => acc + (Number(s.length) || 0), 0)} mm)`
                : "—"}
            </strong>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditing && onSaveDrawing && (
        <DrawingEditorModal
          initialData={drawingData}
          frameSize={record.frameSize}
          saving={saving}
          onClose={() => setIsEditing(false)}
          onSave={async (data) => {
            setSaving(true);
            try {
              await onSaveDrawing(data);
              setIsEditing(false);
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}

function DrawingEditorModal({
  initialData,
  frameSize,
  saving,
  onClose,
  onSave,
}: {
  initialData: MotorDrawingData | null;
  frameSize: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: MotorDrawingData) => Promise<void>;
}) {
  const [bodyLength, setBodyLength] = useState(initialData?.bodyLength || "");
  const [frontCover, setFrontCover] = useState(initialData?.frontBearingCover || "");
  const [backCover, setBackCover] = useState(initialData?.backBearingCover || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [segments, setSegments] = useState<ShaftSegment[]>(
    initialData?.shaftSegments && initialData.shaftSegments.length > 0
      ? initialData.shaftSegments
      : [],
  );

  const addSegment = () => {
    setSegments((prev) => [
      ...prev,
      { id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, length: 25 },
    ]);
  };

  const updateSegment = (id: string, field: keyof ShaftSegment, value: string | number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const loadNotebookTemplate = () => {
    if (
      segments.length > 0 &&
      !window.confirm("Replace current segments with the notebook sample values (60, 40, 50, 100, 25, 25)?")
    ) {
      return;
    }
    setSegments(NOTEBOOK_SEGMENT_TEMPLATE);
  };

  const clearSegments = () => {
    setSegments([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      frameSize,
      bodyLength: bodyLength.trim(),
      frontBearingCover: frontCover.trim(),
      backBearingCover: backCover.trim(),
      shaftSegments: segments,
      notes: notes.trim(),
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="drawing-modal">
        <div className="drawing-modal-head">
          <div>
            <h3>Edit Motor Drawing Dimensions</h3>
            <p>Enter dimensions in millimeters (mm). Segments represent stepped shaft sections from Front to Back.</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="drawing-form">
          <div className="modal-grid-3">
            <label className="field">
              <span className="field-label">Body Length (mm)</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={bodyLength}
                onChange={(e) => setBodyLength(e.target.value)}
                placeholder="e.g. 210"
              />
            </label>
            <label className="field">
              <span className="field-label">Front Bearing Cover (mm)</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={frontCover}
                onChange={(e) => setFrontCover(e.target.value)}
                placeholder="e.g. 35"
              />
            </label>
            <label className="field">
              <span className="field-label">Back Bearing Cover (mm)</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={backCover}
                onChange={(e) => setBackCover(e.target.value)}
                placeholder="e.g. 30"
              />
            </label>
          </div>

          <div className="segments-section">
            <div className="segments-header">
              <div>
                <h5>Shaft Step Segments (Front ➔ Back)</h5>
                <small>Add custom shaft steps or use the notebook reference as an editable template.</small>
              </div>
              <div className="segment-actions">
                <button
                  type="button"
                  className="button button-secondary compact"
                  onClick={loadNotebookTemplate}
                  title="Load reference sample (60, 40, 50, 100, 25, 25)"
                >
                  📋 Load Notebook Template
                </button>
                <button
                  type="button"
                  className="button button-secondary compact"
                  onClick={addSegment}
                >
                  + Add Segment
                </button>
                {segments.length > 0 && (
                  <button
                    type="button"
                    className="button button-ghost compact danger-text"
                    onClick={clearSegments}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {segments.length === 0 ? (
              <div className="empty-segments-hint">
                No shaft segments added yet. Click &ldquo;+ Add Segment&rdquo; or &ldquo;Load Notebook Template&rdquo;.
              </div>
            ) : (
              <div className="segments-list">
                {segments.map((seg, idx) => (
                  <div key={seg.id} className="segment-row">
                    <span className="segment-index">#{idx + 1}</span>
                    <input
                      type="text"
                      className="input segment-name-input"
                      placeholder="Name / Step description (optional)"
                      value={seg.name || ""}
                      onChange={(e) => updateSegment(seg.id, "name", e.target.value)}
                    />
                    <div className="segment-len-wrapper">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        className="input segment-len-input"
                        placeholder="Length (mm)"
                        value={seg.length}
                        onChange={(e) =>
                          updateSegment(seg.id, "length", parseFloat(e.target.value) || 0)
                        }
                        required
                      />
                      <span className="unit-label">mm</span>
                    </div>
                    <button
                      type="button"
                      className="remove-seg-btn"
                      onClick={() => removeSegment(seg.id)}
                      title="Remove Segment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Drawing Notes / Bench Observations (Optional)</span>
            <input
              type="text"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Double-stepped drive end, keyway width 6mm"
            />
          </label>

          <div className="modal-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving ? "Saving Dimensions…" : "Save Drawing Dimensions"}
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
