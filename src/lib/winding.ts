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

export type RecordField = (typeof RECORD_FIELDS)[number];
export type RecordInput = Record<RecordField, string>;

export type WindingRecord = RecordInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
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
  const match = trimmed.match(/^[13]\b/) || trimmed.match(/\b([13])\s*(phase)?\b/);
  if (match) return match[1];
  return trimmed;
};

export const displayPhase = (phase: string) => {
  const trimmed = phase.trim();
  return trimmed === "1" || trimmed === "3" ? `${trimmed} phase` : trimmed || "—";
};

export const coerceRecordInput = (payload: unknown): RecordInput => {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return RECORD_FIELDS.reduce((result, field) => {
    const value = source[field];
    result[field] = typeof value === "string" || typeof value === "number" ? normalizeValue(String(value)) : "";
    return result;
  }, {} as RecordInput);
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
