export const FRAME_SIZES = ["63", "71", "80", "90", "100", "112", "132", "160"];
export const HP_VALUES = ["0.25", "0.5", "0.75", "1", "1.5", "2", "3", "5", "7.5", "10", "15", "20"];
export const RPM_VALUES = ["750", "960", "1440", "2880", "3000"];
export const PHASE_VALUES = ["1", "3"];
export const SLOT_VALUES = ["12", "18", "24", "30", "36", "48"];
export const PITCH_VALUES = ["1-5", "1-6", "1-7", "1-8", "2-7"];
export const SWG_VALUES = ["18", "20", "21", "22", "23", "24", "25", "26"];
export const CONNECTION_VALUES = ["Series", "Parallel", "Delta", "Star", "CCW", "CW"];
export const CAPACITOR_VALUES = ["40 µF", "60 µF", "80 µF", "100 µF", "120 µF"];
export const DIMENSION_VALUES = ["60", "63", "72", "80", "85", "90", "100", "105", "112", "126", "140"];
export const WEIGHT_VALUES = ["0.25 kg", "0.5 kg", "0.55 kg", "0.75 kg", "0.85 kg", "1 kg"];

export const RECORD_FIELDS = [
  "companyName",
  "description",
  "frameSize",
  "hp",
  "phase",
  "rpm",
  "od",
  "idDimension",
  "eLength",
  "slot",
  "rSlot",
  "runningPitch",
  "runningTurns",
  "runningSwg",
  "runningWeight",
  "runningConnection",
  "startingPitch",
  "startingTurns",
  "startingSwg",
  "startingWeight",
  "startingConnection",
  "startingCapacitor",
  "runningCapacitor",
] as const;

export type ShaftSegment = {
  id: string;
  name?: string;
  length: number; // in mm
  diameter?: number; // relative diameter/step height
};

export const NOTEBOOK_SEGMENT_TEMPLATE: ShaftSegment[] = [
  { id: "seg-1", name: "Front extension", length: 60 },
  { id: "seg-2", name: "Front bearing seat", length: 40 },
  { id: "seg-3", name: "Front collar", length: 50 },
  { id: "seg-4", name: "Rotor core seat", length: 100 },
  { id: "seg-5", name: "Back bearing seat", length: 25 },
  { id: "seg-6", name: "Back extension", length: 25 },
];

export type MotorDrawingData = {
  frameSize?: string;
  bodyLength?: string; // in mm
  frontBearingCover?: string; // in mm
  backBearingCover?: string; // in mm
  shaftSegments?: ShaftSegment[];
  notes?: string;
};

export type CostItemKey =
  | "ciCasting"
  | "stamping"
  | "rotorDieCast"
  | "shaft"
  | "frontBearing"
  | "backBearing"
  | "tbfc"
  | "copperWire"
  | "insulating"
  | "windingLabor"
  | "motorTestingLabor"
  | "otherCharges";

export const COST_ITEM_KEYS: CostItemKey[] = [
  "ciCasting",
  "stamping",
  "rotorDieCast",
  "shaft",
  "frontBearing",
  "backBearing",
  "tbfc",
  "copperWire",
  "insulating",
  "windingLabor",
  "motorTestingLabor",
  "otherCharges",
];

export const COST_ITEM_LABELS: Record<CostItemKey, string> = {
  ciCasting: "C.I. Casting",
  stamping: "Stamping",
  rotorDieCast: "Rotor Die Cast",
  shaft: "Shaft",
  frontBearing: "Front Bearing",
  backBearing: "Back Bearing",
  tbfc: "T.B.F.C.", // Handwritten abbreviation kept editable and visible
  copperWire: "Copper Wire",
  insulating: "Insulating",
  windingLabor: "Winding Labor",
  motorTestingLabor: "Motor Testing Labor",
  otherCharges: "Other Charges",
};

export type CostItems = Record<CostItemKey, number>;

export const emptyCostItems = (): CostItems => ({
  ciCasting: 0,
  stamping: 0,
  rotorDieCast: 0,
  shaft: 0,
  frontBearing: 0,
  backBearing: 0,
  tbfc: 0,
  copperWire: 0,
  insulating: 0,
  windingLabor: 0,
  motorTestingLabor: 0,
  otherCharges: 0,
});

export const calculateCostTotal = (items: Partial<CostItems>): number => {
  const sum = COST_ITEM_KEYS.reduce((acc, key) => {
    const val = Number(items[key]);
    return acc + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);
  return Math.round(sum * 100) / 100;
};

export type PriceAdjustmentHistoryEntry = {
  id: string;
  appliedAt: string;
  percentage: number;
  note?: string;
  previousTotal: number;
  updatedTotal: number;
  previousItems: Record<string, number>;
};

export type DrawingElement =
  | {
      id: string;
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      strokeWidth?: number;
      strokeDasharray?: string;
    }
  | {
      id: string;
      type: "dimension";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      value: string;
      label?: string;
      offset?: number;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize?: number;
    };

export type ShaftDrawing = {
  templateId?: string;
  templateName?: string;
  elements: DrawingElement[];
  dimensionValues?: Record<string, string>;
  dimensionLabels?: Record<string, string>;
  viewBoxWidth: number;
  viewBoxHeight: number;
  notes?: string;
};

export type ShaftDrawingTemplate = {
  id: string;
  name: string;
  description?: string;
  elements: DrawingElement[];
  viewBoxWidth: number;
  viewBoxHeight: number;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_SHAFT_TEMPLATE: ShaftDrawingTemplate = {
  id: "template-single-phase-common",
  name: "Single Phase Common Shaft",
  description: "Standard stepped shaft profile with bearing seats, collar steps, core seat, and extensions.",
  viewBoxWidth: 800,
  viewBoxHeight: 360,
  elements: [
    { id: "line-center", type: "line", x1: 40, y1: 180, x2: 760, y2: 180, strokeWidth: 1, strokeDasharray: "8 5" },
    { id: "line-1", type: "line", x1: 60, y1: 155, x2: 60, y2: 205 },
    { id: "line-2", type: "line", x1: 60, y1: 155, x2: 140, y2: 155 },
    { id: "line-3", type: "line", x1: 60, y1: 205, x2: 140, y2: 205 },
    { id: "line-4", type: "line", x1: 140, y1: 155, x2: 140, y2: 135 },
    { id: "line-5", type: "line", x1: 140, y1: 205, x2: 140, y2: 225 },
    { id: "line-6", type: "line", x1: 140, y1: 135, x2: 210, y2: 135 },
    { id: "line-7", type: "line", x1: 140, y1: 225, x2: 210, y2: 225 },
    { id: "line-8", type: "line", x1: 210, y1: 135, x2: 210, y2: 100 },
    { id: "line-9", type: "line", x1: 210, y1: 225, x2: 210, y2: 260 },
    { id: "line-10", type: "line", x1: 210, y1: 100, x2: 270, y2: 100 },
    { id: "line-11", type: "line", x1: 210, y1: 260, x2: 270, y2: 260 },
    { id: "line-12", type: "line", x1: 270, y1: 100, x2: 270, y2: 120 },
    { id: "line-13", type: "line", x1: 270, y1: 260, x2: 270, y2: 240 },
    { id: "line-14", type: "line", x1: 270, y1: 120, x2: 430, y2: 120 },
    { id: "line-15", type: "line", x1: 270, y1: 240, x2: 430, y2: 240 },
    { id: "line-16", type: "line", x1: 430, y1: 120, x2: 570, y2: 120 },
    { id: "line-17", type: "line", x1: 430, y1: 240, x2: 570, y2: 240 },
    { id: "line-18", type: "line", x1: 570, y1: 120, x2: 570, y2: 142 },
    { id: "line-19", type: "line", x1: 570, y1: 240, x2: 570, y2: 218 },
    { id: "line-20", type: "line", x1: 570, y1: 142, x2: 630, y2: 142 },
    { id: "line-21", type: "line", x1: 570, y1: 218, x2: 630, y2: 218 },
    { id: "line-22", type: "line", x1: 630, y1: 142, x2: 630, y2: 153 },
    { id: "line-23", type: "line", x1: 630, y1: 218, x2: 630, y2: 207 },
    { id: "line-24", type: "line", x1: 630, y1: 153, x2: 690, y2: 153 },
    { id: "line-25", type: "line", x1: 630, y1: 207, x2: 690, y2: 207 },
    { id: "line-26", type: "line", x1: 690, y1: 153, x2: 690, y2: 162 },
    { id: "line-27", type: "line", x1: 690, y1: 207, x2: 690, y2: 198 },
    { id: "line-28", type: "line", x1: 690, y1: 162, x2: 740, y2: 162 },
    { id: "line-29", type: "line", x1: 690, y1: 198, x2: 740, y2: 198 },
    { id: "line-30", type: "line", x1: 740, y1: 162, x2: 740, y2: 198 },
    { id: "dim-1", type: "dimension", x1: 60, y1: 155, x2: 140, y2: 155, offset: -35, value: "60 mm", label: "Front Extension" },
    { id: "dim-2", type: "dimension", x1: 140, y1: 135, x2: 210, y2: 135, offset: -35, value: "40 mm", label: "Front Bearing Seat" },
    { id: "dim-3", type: "dimension", x1: 210, y1: 100, x2: 270, y2: 100, offset: -35, value: "50 mm", label: "Front Collar" },
    { id: "dim-4", type: "dimension", x1: 270, y1: 120, x2: 430, y2: 120, offset: -35, value: "100 mm", label: "Rotor Core Seat" },
    { id: "dim-5", type: "dimension", x1: 430, y1: 120, x2: 570, y2: 120, offset: -35, value: "110 mm", label: "Body Shaft Length" },
    { id: "dim-6", type: "dimension", x1: 570, y1: 142, x2: 630, y2: 142, offset: -35, value: "25 mm", label: "Back Bearing Seat" },
    { id: "dim-7", type: "dimension", x1: 630, y1: 153, x2: 690, y2: 153, offset: -35, value: "25 mm", label: "Back Collar" },
    { id: "dim-8", type: "dimension", x1: 690, y1: 162, x2: 740, y2: 162, offset: -35, value: "25 mm", label: "Back Extension" },
    { id: "dim-overall", type: "dimension", x1: 60, y1: 100, x2: 740, y2: 100, offset: -68, value: "435 mm", label: "Total Shaft Length" },
    { id: "dim-inner-length", type: "dimension", x1: 270, y1: 240, x2: 690, y2: 240, offset: 45, value: "", label: "Inner Length" },
    { id: "dim-dia-1", type: "dimension", x1: 100, y1: 155, x2: 100, y2: 205, value: "", label: "Front Ext Dia" },
    { id: "dim-dia-2", type: "dimension", x1: 175, y1: 135, x2: 175, y2: 225, value: "", label: "Front Bearing Dia" },
    { id: "dim-dia-3", type: "dimension", x1: 240, y1: 100, x2: 240, y2: 260, value: "", label: "Front Collar Dia" },
    { id: "dim-dia-4", type: "dimension", x1: 420, y1: 120, x2: 420, y2: 240, value: "", label: "Rotor Core Dia" },
    { id: "dim-dia-5", type: "dimension", x1: 600, y1: 142, x2: 600, y2: 218, value: "", label: "Back Bearing Dia" },
    { id: "dim-dia-6", type: "dimension", x1: 660, y1: 153, x2: 660, y2: 207, value: "", label: "Back Collar Dia" },
    { id: "dim-dia-7", type: "dimension", x1: 715, y1: 162, x2: 715, y2: 198, value: "", label: "Back Ext Dia" },
    { id: "text-front", type: "text", x: 75, y: 330, text: "◄ FRONT (DE)", fontSize: 13 },
    { id: "text-back", type: "text", x: 670, y: 330, text: "BACK (NDE) ►", fontSize: 13 },
  ],
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
};

export const SHAFT_PROFILE_2_TEMPLATE: ShaftDrawingTemplate = {
  id: "template-shaft-profile-2",
  name: "Shaft Profile 2",
  description: "Stepped shaft outline with elongated front extension, collar, core seat, and 3-step rear journal.",
  viewBoxWidth: 800,
  viewBoxHeight: 360,
  elements: [
    { id: "p2-line-center", type: "line", x1: 40, y1: 180, x2: 760, y2: 180, strokeWidth: 1, strokeDasharray: "8 5" },
    { id: "p2-line-1", type: "line", x1: 50, y1: 158, x2: 50, y2: 202 },
    { id: "p2-line-2", type: "line", x1: 50, y1: 158, x2: 150, y2: 158 },
    { id: "p2-line-3", type: "line", x1: 50, y1: 202, x2: 150, y2: 202 },
    { id: "p2-line-4", type: "line", x1: 150, y1: 158, x2: 150, y2: 135 },
    { id: "p2-line-5", type: "line", x1: 150, y1: 202, x2: 150, y2: 225 },
    { id: "p2-line-6", type: "line", x1: 150, y1: 135, x2: 215, y2: 135 },
    { id: "p2-line-7", type: "line", x1: 150, y1: 225, x2: 215, y2: 225 },
    { id: "p2-line-8", type: "line", x1: 215, y1: 135, x2: 215, y2: 100 },
    { id: "p2-line-9", type: "line", x1: 215, y1: 225, x2: 215, y2: 260 },
    { id: "p2-line-10", type: "line", x1: 215, y1: 100, x2: 280, y2: 100 },
    { id: "p2-line-11", type: "line", x1: 215, y1: 260, x2: 280, y2: 260 },
    { id: "p2-line-12", type: "line", x1: 280, y1: 100, x2: 280, y2: 125 },
    { id: "p2-line-13", type: "line", x1: 280, y1: 260, x2: 280, y2: 235 },
    { id: "p2-line-14", type: "line", x1: 280, y1: 125, x2: 385, y2: 125 },
    { id: "p2-line-15", type: "line", x1: 280, y1: 235, x2: 385, y2: 235 },
    { id: "p2-line-16", type: "line", x1: 385, y1: 125, x2: 590, y2: 125 },
    { id: "p2-line-17", type: "line", x1: 385, y1: 235, x2: 590, y2: 235 },
    { id: "p2-line-18", type: "line", x1: 590, y1: 125, x2: 590, y2: 147 },
    { id: "p2-line-19", type: "line", x1: 590, y1: 235, x2: 590, y2: 213 },
    { id: "p2-line-20", type: "line", x1: 590, y1: 147, x2: 655, y2: 147 },
    { id: "p2-line-21", type: "line", x1: 590, y1: 213, x2: 655, y2: 213 },
    { id: "p2-line-22", type: "line", x1: 655, y1: 147, x2: 655, y2: 159 },
    { id: "p2-line-23", type: "line", x1: 655, y1: 213, x2: 655, y2: 201 },
    { id: "p2-line-24", type: "line", x1: 655, y1: 159, x2: 715, y2: 159 },
    { id: "p2-line-25", type: "line", x1: 655, y1: 201, x2: 715, y2: 201 },
    { id: "p2-line-26", type: "line", x1: 715, y1: 159, x2: 715, y2: 168 },
    { id: "p2-line-27", type: "line", x1: 715, y1: 201, x2: 715, y2: 192 },
    { id: "p2-line-28", type: "line", x1: 715, y1: 168, x2: 745, y2: 168 },
    { id: "p2-line-29", type: "line", x1: 715, y1: 192, x2: 745, y2: 192 },
    { id: "p2-line-30", type: "line", x1: 745, y1: 168, x2: 745, y2: 192 },
    { id: "p2-dim-1", type: "dimension", x1: 50, y1: 158, x2: 150, y2: 158, offset: -35, value: "", label: "Front Extension" },
    { id: "p2-dim-2", type: "dimension", x1: 150, y1: 135, x2: 215, y2: 135, offset: -35, value: "", label: "Front Bearing Seat" },
    { id: "p2-dim-3", type: "dimension", x1: 215, y1: 100, x2: 280, y2: 100, offset: -35, value: "", label: "Front Collar" },
    { id: "p2-dim-4", type: "dimension", x1: 280, y1: 125, x2: 385, y2: 125, offset: -35, value: "", label: "Rotor Core Seat" },
    { id: "p2-dim-5", type: "dimension", x1: 385, y1: 125, x2: 590, y2: 125, offset: -35, value: "", label: "Body Shaft Length" },
    { id: "p2-dim-6", type: "dimension", x1: 590, y1: 147, x2: 655, y2: 147, offset: -35, value: "", label: "Back Bearing Seat" },
    { id: "p2-dim-7", type: "dimension", x1: 655, y1: 159, x2: 715, y2: 159, offset: -35, value: "", label: "Back Collar" },
    { id: "p2-dim-8", type: "dimension", x1: 715, y1: 168, x2: 745, y2: 168, offset: -35, value: "", label: "Back Extension" },
    { id: "p2-dim-overall", type: "dimension", x1: 50, y1: 100, x2: 745, y2: 100, offset: -68, value: "", label: "Total Shaft Length" },
    { id: "p2-dim-inner-length", type: "dimension", x1: 280, y1: 235, x2: 590, y2: 235, offset: 50, value: "", label: "Inner Length" },
    { id: "p2-text-front", type: "text", x: 75, y: 330, text: "◄ FRONT (DE)", fontSize: 13 },
    { id: "p2-text-back", type: "text", x: 670, y: 330, text: "BACK (NDE) ►", fontSize: 13 },
  ],
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
};

export const SHAFT_PROFILE_3_TEMPLATE: ShaftDrawingTemplate = {
  id: "template-shaft-profile-3",
  name: "Shaft Profile 3",
  description: "Stepped shaft outline with stepped front collar and heavy rear journal extension.",
  viewBoxWidth: 800,
  viewBoxHeight: 360,
  elements: [
    { id: "p3-line-center", type: "line", x1: 40, y1: 180, x2: 760, y2: 180, strokeWidth: 1, strokeDasharray: "8 5" },
    { id: "p3-line-1", type: "line", x1: 50, y1: 155, x2: 50, y2: 205 },
    { id: "p3-line-2", type: "line", x1: 50, y1: 155, x2: 140, y2: 155 },
    { id: "p3-line-3", type: "line", x1: 50, y1: 205, x2: 140, y2: 205 },
    { id: "p3-line-4", type: "line", x1: 140, y1: 155, x2: 140, y2: 133 },
    { id: "p3-line-5", type: "line", x1: 140, y1: 205, x2: 140, y2: 227 },
    { id: "p3-line-6", type: "line", x1: 140, y1: 133, x2: 220, y2: 133 },
    { id: "p3-line-7", type: "line", x1: 140, y1: 227, x2: 220, y2: 227 },
    { id: "p3-line-8", type: "line", x1: 220, y1: 133, x2: 220, y2: 100 },
    { id: "p3-line-9", type: "line", x1: 220, y1: 227, x2: 220, y2: 260 },
    { id: "p3-line-10", type: "line", x1: 220, y1: 100, x2: 280, y2: 100 },
    { id: "p3-line-11", type: "line", x1: 220, y1: 260, x2: 280, y2: 260 },
    { id: "p3-line-12", type: "line", x1: 280, y1: 100, x2: 280, y2: 125 },
    { id: "p3-line-13", type: "line", x1: 280, y1: 260, x2: 280, y2: 235 },
    { id: "p3-line-14", type: "line", x1: 280, y1: 125, x2: 400, y2: 125 },
    { id: "p3-line-15", type: "line", x1: 280, y1: 235, x2: 400, y2: 235 },
    { id: "p3-line-16", type: "line", x1: 400, y1: 125, x2: 600, y2: 125 },
    { id: "p3-line-17", type: "line", x1: 400, y1: 235, x2: 600, y2: 235 },
    { id: "p3-line-18", type: "line", x1: 600, y1: 125, x2: 600, y2: 146 },
    { id: "p3-line-19", type: "line", x1: 600, y1: 235, x2: 600, y2: 214 },
    { id: "p3-line-20", type: "line", x1: 600, y1: 146, x2: 740, y2: 146 },
    { id: "p3-line-21", type: "line", x1: 600, y1: 214, x2: 740, y2: 214 },
    { id: "p3-line-22", type: "line", x1: 740, y1: 146, x2: 740, y2: 214 },
    { id: "p3-dim-1", type: "dimension", x1: 50, y1: 155, x2: 140, y2: 155, offset: -35, value: "", label: "Front Extension" },
    { id: "p3-dim-2", type: "dimension", x1: 140, y1: 133, x2: 220, y2: 133, offset: -35, value: "", label: "Front Bearing Seat" },
    { id: "p3-dim-3", type: "dimension", x1: 220, y1: 100, x2: 280, y2: 100, offset: -35, value: "", label: "Front Collar" },
    { id: "p3-dim-4", type: "dimension", x1: 280, y1: 125, x2: 400, y2: 125, offset: -35, value: "", label: "Rotor Core Seat" },
    { id: "p3-dim-5", type: "dimension", x1: 400, y1: 125, x2: 600, y2: 125, offset: -35, value: "", label: "Body Shaft Length" },
    { id: "p3-dim-6", type: "dimension", x1: 600, y1: 146, x2: 740, y2: 146, offset: -35, value: "", label: "Back Shaft / Extension" },
    { id: "p3-dim-overall", type: "dimension", x1: 50, y1: 100, x2: 740, y2: 100, offset: -68, value: "", label: "Total Shaft Length" },
    { id: "p3-dim-inner-length", type: "dimension", x1: 280, y1: 235, x2: 600, y2: 235, offset: 50, value: "", label: "Inner Length" },
    { id: "p3-text-front", type: "text", x: 75, y: 330, text: "◄ FRONT (DE)", fontSize: 13 },
    { id: "p3-text-back", type: "text", x: 670, y: 330, text: "BACK (NDE) ►", fontSize: 13 },
  ],
  createdAt: "2026-10-22T00:00:00.000Z",
  updatedAt: "2026-10-22T00:00:00.000Z",
};

export const DEFAULT_SHAFT_TEMPLATES: ShaftDrawingTemplate[] = [
  DEFAULT_SHAFT_TEMPLATE,
  SHAFT_PROFILE_2_TEMPLATE,
  SHAFT_PROFILE_3_TEMPLATE,
];

export type MotorCostingRecord = {
  id: string;
  motorRecordId?: string | null;
  companyName: string;
  jobName?: string;
  jobDate?: string;
  notes?: string;
  frameSize: string;
  hp: string;
  phase: string;
  rpm: string;
  bodyLength: string;
  frontBearingCover: string;
  backBearingCover: string;
  tbfcLabel?: string;
  items: CostItems;
  totalAmount: number;
  adjustmentHistory?: PriceAdjustmentHistoryEntry[];
  lastAdjustmentPercentage?: number;
  lastAdjustmentDate?: string;
  drawing?: ShaftDrawing | null;
  drawingData?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type RecordField = (typeof RECORD_FIELDS)[number];
export type RecordInput = Record<RecordField, string> & {
  drawingData?: string;
};

export type WindingRecord = RecordInput & {
  id: string;
  drawingData?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type Settings = {
  appName: string;
  workshopName: string;
};

export const emptyRecord = (): RecordInput => ({
  companyName: "",
  description: "",
  frameSize: "",
  hp: "",
  phase: "",
  rpm: "",
  od: "",
  idDimension: "",
  eLength: "",
  slot: "",
  rSlot: "",
  runningPitch: "",
  runningTurns: "",
  runningSwg: "",
  runningWeight: "",
  runningConnection: "",
  startingPitch: "",
  startingTurns: "",
  startingSwg: "",
  startingWeight: "",
  startingConnection: "",
  startingCapacitor: "",
  runningCapacitor: "",
});

export const normalizeValue = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeNumber = (value: string) => {
  const candidate = normalizeValue(value).replace(/,/g, "");
  if (candidate && /^[-+]?\d*\.?\d+$/.test(candidate)) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return candidate.toLowerCase();
};

export const normalizePhase = (value: string) => {
  const trimmed = normalizeValue(value).toLowerCase();
  if (trimmed === "three" || trimmed.startsWith("three")) return "3";
  if (trimmed === "single" || trimmed.startsWith("single") || trimmed.startsWith("one")) return "1";
  const match = trimmed.match(/^[13]\b/) || trimmed.match(/\b([13])\s*(phase)?\b/);
  if (match) return match[1];
  return trimmed;
};

export const isThreePhase = (phase: string) => {
  if (!phase) return false;
  const p = normalizeValue(phase).toLowerCase();
  if (p === "3" || p === "three") return true;
  if (p.startsWith("3 ") || p.startsWith("3-") || p.startsWith("3p") || p.startsWith("three")) return true;
  if (/\b(3|three)(\s*[-/]?\s*phase)?\b/i.test(p)) return true;
  return normalizePhase(p) === "3";
};

export const displayPhase = (phase: string) => {
  const trimmed = phase.trim();
  const normalized = normalizePhase(trimmed);
  return normalized === "1" || normalized === "3" ? `${normalized} phase` : trimmed || "—";
};

export const coerceRecordInput = (payload: unknown): RecordInput => {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result = RECORD_FIELDS.reduce((acc, field) => {
    const value = source[field];
    acc[field] = typeof value === "string" || typeof value === "number" ? normalizeValue(String(value)) : "";
    return acc;
  }, {} as RecordInput);

  if (typeof source.drawingData === "string") {
    result.drawingData = source.drawingData;
  } else if (source.drawingData && typeof source.drawingData === "object") {
    try {
      result.drawingData = JSON.stringify(source.drawingData);
    } catch {
      result.drawingData = "";
    }
  }
  return result;
};

export const validateRecord = (record: RecordInput): Record<RecordField, string> => {
  const errors = {} as Record<RecordField, string>;
  if (!record.companyName) errors.companyName = "Enter a company or machine name.";
  if (!record.frameSize) errors.frameSize = "Choose or enter a frame size.";
  if (!record.hp) errors.hp = "Enter the motor HP.";
  if (!record.phase) errors.phase = "Choose or enter the phase.";
  if (!record.rpm) errors.rpm = "Enter the motor RPM.";
  return errors;
};

export const isRecordInput = (value: unknown): value is RecordInput => {
  const parsed = coerceRecordInput(value);
  return Object.keys(validateRecord(parsed)).length === 0;
};
