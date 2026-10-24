import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, inArray } from "drizzle-orm";
import { appSettings, windingRecords, motorCostingRecords, drawingTemplates } from "./schema";
import {
  COST_ITEM_KEYS,
  calculateCostTotal,
  emptyCostItems,
  normalizeNumber,
  normalizePhase,
  normalizeValue,
  DEFAULT_SHAFT_TEMPLATE,
  DEFAULT_SHAFT_TEMPLATES,
  SHAFT_PROFILE_2_TEMPLATE,
  SHAFT_PROFILE_3_TEMPLATE,
  type CostItems,
  type CostItemDetails,
  type CostItemLabels,
  type DrawingElement,
  type MotorCostingRecord,
  type PriceAdjustmentHistoryEntry,
  type RecordInput,
  type Settings,
  type ShaftDrawing,
  type ShaftDrawingTemplate,
  type WindingRecord,
} from "@/lib/winding";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = databaseUrl
  ? (globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    }))
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = pool ? drizzle(pool) : null;

let initPromise: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (!pool) return;
  if (!initPromise) {
    initPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS winding_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          frame_size VARCHAR(80) NOT NULL,
          hp VARCHAR(80) NOT NULL,
          hp_key VARCHAR(80) NOT NULL,
          phase VARCHAR(80) NOT NULL,
          rpm VARCHAR(80) NOT NULL,
          rpm_key VARCHAR(80) NOT NULL,
          od VARCHAR(120) NOT NULL DEFAULT '',
          id_dimension VARCHAR(120) NOT NULL DEFAULT '',
          e_length VARCHAR(120) NOT NULL DEFAULT '',
          slot VARCHAR(120) NOT NULL DEFAULT '',
          r_slot VARCHAR(120) NOT NULL DEFAULT '',
          running_pitch VARCHAR(120) NOT NULL DEFAULT '',
          running_turns VARCHAR(120) NOT NULL DEFAULT '',
          running_swg VARCHAR(120) NOT NULL DEFAULT '',
          running_weight VARCHAR(120) NOT NULL DEFAULT '',
          running_connection VARCHAR(120) NOT NULL DEFAULT '',
          starting_pitch VARCHAR(120) NOT NULL DEFAULT '',
          starting_turns VARCHAR(120) NOT NULL DEFAULT '',
          starting_swg VARCHAR(120) NOT NULL DEFAULT '',
          starting_weight VARCHAR(120) NOT NULL DEFAULT '',
          starting_connection VARCHAR(120) NOT NULL DEFAULT '',
          starting_capacitor VARCHAR(160) NOT NULL DEFAULT '',
          running_capacitor VARCHAR(160) NOT NULL DEFAULT '',
          drawing_data TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE winding_records ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
        ALTER TABLE winding_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE winding_records ADD COLUMN IF NOT EXISTS drawing_data TEXT NOT NULL DEFAULT '';
        CREATE TABLE IF NOT EXISTS app_settings (
          id VARCHAR(32) PRIMARY KEY,
          app_name VARCHAR(120) NOT NULL,
          workshop_name VARCHAR(160) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS motor_costing_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          motor_record_id UUID DEFAULT NULL,
          company_name TEXT NOT NULL,
          job_name TEXT NOT NULL DEFAULT '',
          job_date VARCHAR(60) NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          frame_size VARCHAR(80) NOT NULL DEFAULT '',
          hp VARCHAR(80) NOT NULL DEFAULT '',
          phase VARCHAR(80) NOT NULL DEFAULT '',
          rpm VARCHAR(80) NOT NULL DEFAULT '',
          body_length VARCHAR(80) NOT NULL DEFAULT '',
          front_bearing_cover VARCHAR(80) NOT NULL DEFAULT '',
          back_bearing_cover VARCHAR(80) NOT NULL DEFAULT '',
          tbfc_label VARCHAR(100) NOT NULL DEFAULT 'T.E.F.C.',
          cost_items TEXT NOT NULL DEFAULT '{}',
          total_amount VARCHAR(40) NOT NULL DEFAULT '0',
          adjustment_history TEXT NOT NULL DEFAULT '[]',
          drawing_data TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ DEFAULT NULL
        );
        ALTER TABLE motor_costing_records ADD COLUMN IF NOT EXISTS drawing_data TEXT DEFAULT '';
        ALTER TABLE motor_costing_records ADD COLUMN IF NOT EXISTS item_labels TEXT DEFAULT '{}';
        ALTER TABLE motor_costing_records ADD COLUMN IF NOT EXISTS item_details TEXT DEFAULT '{}';
        ALTER TABLE motor_costing_records ALTER COLUMN tbfc_label SET DEFAULT 'T.E.F.C.';
        UPDATE motor_costing_records SET tbfc_label = 'T.E.F.C.' WHERE tbfc_label = 'T.B.F.C.';
        CREATE TABLE IF NOT EXISTS drawing_templates (
          id VARCHAR(120) PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          data TEXT NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE drawing_templates ALTER COLUMN id TYPE VARCHAR(120);
      `)
      .then(() => {})
      .catch((err) => {
        console.warn("Could not ensure database tables:", err);
      });
  }
  return initPromise;
}

const DEFAULT_SETTINGS: Settings = {
  appName: "Motor Winding Library",
  workshopName: "Workshop Library",
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "library.json");

type StorageData = {
  settings: Settings;
  records: WindingRecord[];
  costingRecords?: MotorCostingRecord[];
  drawingTemplates?: ShaftDrawingTemplate[];
};

async function readLocalData(): Promise<StorageData> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(content) as Partial<StorageData>;
    const loadedTemplates =
      Array.isArray(parsed.drawingTemplates) && parsed.drawingTemplates.length > 0
        ? parsed.drawingTemplates
        : [...DEFAULT_SHAFT_TEMPLATES];

    for (const def of DEFAULT_SHAFT_TEMPLATES) {
      const idx = loadedTemplates.findIndex(
        (t) => t.id === def.id || t.name.toLowerCase().trim() === def.name.toLowerCase().trim(),
      );
      if (idx !== -1) {
        loadedTemplates[idx] = {
          ...loadedTemplates[idx],
          elements: def.elements,
          viewBoxWidth: def.viewBoxWidth,
          viewBoxHeight: def.viewBoxHeight,
        };
      } else {
        loadedTemplates.push(def);
      }
    }

    return {
      settings: parsed.settings || DEFAULT_SETTINGS,
      records: Array.isArray(parsed.records) ? parsed.records : [],
      costingRecords: Array.isArray(parsed.costingRecords) ? parsed.costingRecords : [],
      drawingTemplates: loadedTemplates,
    };
  } catch {
    return {
      settings: DEFAULT_SETTINGS,
      records: [],
      costingRecords: [],
      drawingTemplates: [...DEFAULT_SHAFT_TEMPLATES],
    };
  }
}

async function writeLocalData(data: StorageData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload: StorageData = {
    settings: data.settings || DEFAULT_SETTINGS,
    records: data.records || [],
    costingRecords: data.costingRecords || [],
    drawingTemplates: data.drawingTemplates || [],
  };
  const tempFile = `${DATA_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tempFile, DATA_FILE);
}

function serializePgRecord(record: typeof windingRecords.$inferSelect): WindingRecord {
  return {
    ...record,
    drawingData: record.drawingData || "",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

export type RecordFilterParams = {
  frameSize?: string;
  hp?: string;
  phase?: string;
  rpm?: string;
  q?: string;
  companyName?: string;
  recycle?: boolean;
};

export async function findRecords(filters: RecordFilterParams = {}): Promise<WindingRecord[]> {
  const frameSize = normalizeValue(filters.frameSize ?? "");
  const hp = normalizeNumber(filters.hp ?? "");
  const phase = normalizePhase(filters.phase ?? "");
  const rpm = normalizeNumber(filters.rpm ?? "");
  const q = normalizeValue(filters.q ?? "");
  const companyName = normalizeValue(filters.companyName ?? "");

  if (db) {
    try {
      await ensureTables();
      const conditions = [];
      if (frameSize) conditions.push(ilike(windingRecords.frameSize, frameSize));
      if (hp) conditions.push(eq(windingRecords.hpKey, hp));
      if (phase) {
        conditions.push(
          or(
            eq(windingRecords.phase, phase),
            ilike(windingRecords.phase, `%${phase}%`),
          )!,
        );
      }
      if (rpm) conditions.push(eq(windingRecords.rpmKey, rpm));
      if (companyName) {
        const phrase = `%${companyName.replace(/[%_\\]/g, "\\$&")}%`;
        conditions.push(ilike(windingRecords.companyName, phrase));
      }
      if (q) {
        const phrase = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
        conditions.push(
          or(
            ilike(windingRecords.companyName, phrase),
            ilike(windingRecords.description, phrase),
            ilike(windingRecords.frameSize, phrase),
            ilike(windingRecords.hp, phrase),
            ilike(windingRecords.phase, phrase),
            ilike(windingRecords.rpm, phrase),
          )!,
        );
      }

      if (filters.recycle) {
        conditions.push(isNotNull(windingRecords.deletedAt));
      } else {
        conditions.push(isNull(windingRecords.deletedAt));
      }

      const rows = await db
        .select()
        .from(windingRecords)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(windingRecords.updatedAt));

      return rows.map(serializePgRecord);
    } catch (err) {
      console.warn("PostgreSQL query failed, falling back to local file storage:", err);
    }
  }

  const data = await readLocalData();
  let matches = filters.recycle
    ? data.records.filter((r) => Boolean(r.deletedAt))
    : data.records.filter((r) => !r.deletedAt);

  if (frameSize) {
    matches = matches.filter(
      (r) => normalizeValue(r.frameSize).toLowerCase() === frameSize.toLowerCase(),
    );
  }
  if (hp) {
    matches = matches.filter((r) => normalizeNumber(r.hp) === hp);
  }
  if (phase) {
    matches = matches.filter((r) => normalizePhase(r.phase) === phase);
  }
  if (rpm) {
    matches = matches.filter((r) => normalizeNumber(r.rpm) === rpm);
  }
  if (companyName) {
    const term = companyName.toLowerCase();
    matches = matches.filter((r) => r.companyName.toLowerCase().includes(term));
  }
  if (q) {
    const term = q.toLowerCase();
    matches = matches.filter((r) =>
      [r.companyName, r.description || "", r.frameSize, r.hp, r.phase, r.rpm].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }

  return [...matches].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function findRecordById(id: string, includeDeleted = false): Promise<WindingRecord | null> {
  if (db) {
    try {
      await ensureTables();
      const condition = includeDeleted
        ? eq(windingRecords.id, id)
        : and(eq(windingRecords.id, id), isNull(windingRecords.deletedAt))!;
      const [record] = await db
        .select()
        .from(windingRecords)
        .where(condition);
      if (record) return serializePgRecord(record);
    } catch (err) {
      console.warn("PostgreSQL findById failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  return (
    data.records.find((r) => r.id === id && (includeDeleted || !r.deletedAt)) ?? null
  );
}

export async function insertRecord(input: RecordInput): Promise<WindingRecord> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const newRecord: WindingRecord = {
    ...input,
    drawingData: input.drawingData || "",
    id,
    createdAt: now,
    updatedAt: now,
  };

  if (db) {
    try {
      await ensureTables();
      const [record] = await db
        .insert(windingRecords)
        .values({
          ...input,
          drawingData: input.drawingData || "",
          id,
          hpKey: normalizeNumber(input.hp),
          rpmKey: normalizeNumber(input.rpm),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        .returning();
      if (record) return serializePgRecord(record);
    } catch (err) {
      console.warn("PostgreSQL insert failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  data.records.push(newRecord);
  await writeLocalData(data);
  return newRecord;
}

export async function updateRecordById(
  id: string,
  input: RecordInput,
): Promise<WindingRecord | null> {
  const now = new Date().toISOString();

  if (db) {
    try {
      await ensureTables();
      const [record] = await db
        .update(windingRecords)
        .set({
          ...input,
          drawingData: input.drawingData || "",
          hpKey: normalizeNumber(input.hp),
          rpmKey: normalizeNumber(input.rpm),
          updatedAt: new Date(now),
        })
        .where(eq(windingRecords.id, id))
        .returning();
      if (record) return serializePgRecord(record);
    } catch (err) {
      console.warn("PostgreSQL update failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const index = data.records.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const updated: WindingRecord = {
    ...input,
    drawingData: input.drawingData || data.records[index].drawingData || "",
    id,
    createdAt: data.records[index].createdAt,
    updatedAt: now,
  };
  data.records[index] = updated;
  await writeLocalData(data);
  return updated;
}

export async function softDeleteRecordById(id: string): Promise<boolean> {
  const now = new Date();
  if (db) {
    try {
      await ensureTables();
      const [record] = await db
        .update(windingRecords)
        .set({ deletedAt: now })
        .where(eq(windingRecords.id, id))
        .returning({ id: windingRecords.id });
      if (record) return true;
    } catch (err) {
      console.warn("PostgreSQL softDelete failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const index = data.records.findIndex((r) => r.id === id);
  if (index === -1) return false;
  data.records[index].deletedAt = now.toISOString();
  await writeLocalData(data);
  return true;
}

export async function restoreRecordById(id: string): Promise<boolean> {
  if (db) {
    try {
      await ensureTables();
      const [record] = await db
        .update(windingRecords)
        .set({ deletedAt: null })
        .where(eq(windingRecords.id, id))
        .returning({ id: windingRecords.id });
      if (record) return true;
    } catch (err) {
      console.warn("PostgreSQL restore failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const index = data.records.findIndex((r) => r.id === id);
  if (index === -1) return false;
  data.records[index].deletedAt = null;
  await writeLocalData(data);
  return true;
}

export async function hardDeleteRecordById(id: string): Promise<boolean> {
  if (db) {
    try {
      await ensureTables();
      const [record] = await db
        .delete(windingRecords)
        .where(eq(windingRecords.id, id))
        .returning({ id: windingRecords.id });
      if (record) return true;
    } catch (err) {
      console.warn("PostgreSQL hardDelete failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const beforeLength = data.records.length;
  data.records = data.records.filter((r) => r.id !== id);
  if (data.records.length === beforeLength) return false;
  await writeLocalData(data);
  return true;
}

export async function emptyRecycleBin(): Promise<number> {
  if (db) {
    try {
      await ensureTables();
      const records = await db
        .delete(windingRecords)
        .where(isNotNull(windingRecords.deletedAt))
        .returning({ id: windingRecords.id });
      return records.length;
    } catch (err) {
      console.warn("PostgreSQL emptyRecycleBin failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const beforeLength = data.records.length;
  data.records = data.records.filter((r) => !r.deletedAt);
  const count = beforeLength - data.records.length;
  await writeLocalData(data);
  return count;
}

export const deleteRecordById = softDeleteRecordById;

export async function bulkImportRecords(
  records: RecordInput[],
  mode: "append" | "replace",
): Promise<number> {
  const now = new Date().toISOString();
  const newRecords: WindingRecord[] = records.map((r) => ({
    ...r,
    drawingData: r.drawingData || "",
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));

  if (db) {
    try {
      await ensureTables();
      await db.transaction(async (tx) => {
        if (mode === "replace") await tx.delete(windingRecords);
        await tx.insert(windingRecords).values(
          newRecords.map((record) => ({
            ...record,
            drawingData: record.drawingData || "",
            hpKey: normalizeNumber(record.hp),
            rpmKey: normalizeNumber(record.rpm),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
            deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          })),
        );
      });
      return newRecords.length;
    } catch (err) {
      console.warn("PostgreSQL import failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  if (mode === "replace") {
    data.records = newRecords;
  } else {
    data.records.push(...newRecords);
  }
  await writeLocalData(data);
  return newRecords.length;
}

// ======================== MOTOR COSTING METHODS ========================

function serializePgCostingRecord(row: typeof motorCostingRecords.$inferSelect): MotorCostingRecord {
  let items: CostItems = emptyCostItems();
  try {
    const parsed = typeof row.costItems === "string" ? JSON.parse(row.costItems) : row.costItems;
    if (parsed && typeof parsed === "object") {
      items = { ...emptyCostItems(), ...parsed };
    }
  } catch {
    // fallback
  }

  let adjustmentHistory: PriceAdjustmentHistoryEntry[] = [];
  try {
    const parsed =
      typeof row.adjustmentHistory === "string"
        ? JSON.parse(row.adjustmentHistory)
        : row.adjustmentHistory;
    if (Array.isArray(parsed)) {
      adjustmentHistory = parsed;
    }
  } catch {
    // fallback
  }

  const latestAdj = adjustmentHistory[0];

  let drawing: ShaftDrawing | null = null;
  const rawDrawing = (row as unknown as { drawingData?: string }).drawingData;
  if (rawDrawing) {
    try {
      const parsed = typeof rawDrawing === "string" ? JSON.parse(rawDrawing) : rawDrawing;
      if (parsed && typeof parsed === "object") {
        drawing = parsed as ShaftDrawing;
        const tId = drawing.templateId;
        if (tId) {
          const defTpl = DEFAULT_SHAFT_TEMPLATES.find((t) => t.id === tId);
          if (defTpl && drawing) {
            drawing.elements = JSON.parse(JSON.stringify(defTpl.elements));
            drawing.viewBoxWidth = defTpl.viewBoxWidth;
            drawing.viewBoxHeight = defTpl.viewBoxHeight;
          }
        }
      }
    } catch {
      // fallback
    }
  }

  let itemLabels: CostItemLabels = {};
  try {
    const rawLabels = (row as unknown as { itemLabels?: string }).itemLabels;
    const parsed = typeof rawLabels === "string" ? JSON.parse(rawLabels) : rawLabels;
    if (parsed && typeof parsed === "object") {
      itemLabels = parsed;
    }
  } catch {
    // fallback
  }

  let itemDetails: CostItemDetails = {};
  try {
    const rawDetails = (row as unknown as { itemDetails?: string }).itemDetails;
    const parsed = typeof rawDetails === "string" ? JSON.parse(rawDetails) : rawDetails;
    if (parsed && typeof parsed === "object") {
      itemDetails = parsed;
    }
  } catch {
    // fallback
  }

  return {
    id: row.id,
    motorRecordId: row.motorRecordId || null,
    companyName: row.companyName,
    jobName: row.jobName || "",
    jobDate: row.jobDate || "",
    notes: row.notes || "",
    frameSize: row.frameSize || "",
    hp: row.hp || "",
    phase: row.phase || "",
    rpm: row.rpm || "",
    bodyLength: row.bodyLength || "",
    frontBearingCover: row.frontBearingCover || "",
    backBearingCover: row.backBearingCover || "",
    tbfcLabel: (row.tbfcLabel === "T.B.F.C." || !row.tbfcLabel) ? "T.E.F.C." : row.tbfcLabel,
    itemLabels,
    itemDetails,
    items,
    totalAmount: Number(row.totalAmount) || calculateCostTotal(items),
    adjustmentHistory,
    lastAdjustmentPercentage: latestAdj?.percentage,
    lastAdjustmentDate: latestAdj?.appliedAt,
    drawing,
    drawingData: rawDrawing || "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export type CostingFilterParams = {
  q?: string;
  frameSize?: string;
  motorRecordId?: string;
  recycle?: boolean;
};

export async function findCostingRecords(
  filters: CostingFilterParams = {},
): Promise<MotorCostingRecord[]> {
  const q = normalizeValue(filters.q ?? "").toLowerCase();
  const frameSize = normalizeValue(filters.frameSize ?? "").toLowerCase();
  const motorRecordId = filters.motorRecordId?.trim();

  if (db) {
    try {
      await ensureTables();
      const conditions = [];
      if (frameSize) conditions.push(ilike(motorCostingRecords.frameSize, frameSize));
      if (motorRecordId) conditions.push(eq(motorCostingRecords.motorRecordId, motorRecordId));
      if (q) {
        const phrase = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
        conditions.push(
          or(
            ilike(motorCostingRecords.companyName, phrase),
            ilike(motorCostingRecords.jobName, phrase),
            ilike(motorCostingRecords.frameSize, phrase),
            ilike(motorCostingRecords.notes, phrase),
          )!,
        );
      }
      if (filters.recycle) {
        conditions.push(isNotNull(motorCostingRecords.deletedAt));
      } else {
        conditions.push(isNull(motorCostingRecords.deletedAt));
      }

      const rows = await db
        .select()
        .from(motorCostingRecords)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(motorCostingRecords.updatedAt));

      return rows.map(serializePgCostingRecord);
    } catch (err) {
      console.warn("PostgreSQL findCostingRecords failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.costingRecords || [];
  let matches = filters.recycle
    ? list.filter((r) => Boolean(r.deletedAt))
    : list.filter((r) => !r.deletedAt);

  if (frameSize) {
    matches = matches.filter((r) => (r.frameSize || "").toLowerCase() === frameSize);
  }
  if (motorRecordId) {
    matches = matches.filter((r) => r.motorRecordId === motorRecordId);
  }
  if (q) {
    matches = matches.filter((r) =>
      [r.companyName, r.jobName, r.frameSize, r.notes].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }

  return [...matches].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function findCostingById(
  id: string,
  includeDeleted = false,
): Promise<MotorCostingRecord | null> {
  if (db) {
    try {
      await ensureTables();
      const condition = includeDeleted
        ? eq(motorCostingRecords.id, id)
        : and(eq(motorCostingRecords.id, id), isNull(motorCostingRecords.deletedAt))!;
      const [record] = await db.select().from(motorCostingRecords).where(condition);
      if (record) return serializePgCostingRecord(record);
    } catch (err) {
      console.warn("PostgreSQL findCostingById failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.costingRecords || [];
  return (
    list.find((r) => r.id === id && (includeDeleted || !r.deletedAt)) ?? null
  );
}

export async function insertCostingRecord(
  input: Omit<MotorCostingRecord, "id" | "createdAt" | "updatedAt" | "totalAmount"> & {
    totalAmount?: number;
  },
): Promise<MotorCostingRecord> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const calculatedTotal = calculateCostTotal(input.items);
  const totalAmount = input.totalAmount !== undefined ? input.totalAmount : calculatedTotal;

  const newRecord: MotorCostingRecord = {
    ...input,
    tbfcLabel: (input.tbfcLabel === "T.B.F.C." || !input.tbfcLabel) ? "T.E.F.C." : input.tbfcLabel,
    id,
    totalAmount,
    adjustmentHistory: input.adjustmentHistory || [],
    createdAt: now,
    updatedAt: now,
  };

  if (db) {
    try {
      const drawingDataStr = input.drawing ? JSON.stringify(input.drawing) : (input.drawingData || "");
      await ensureTables();
      const [saved] = await db
        .insert(motorCostingRecords)
        .values({
          id,
          motorRecordId: input.motorRecordId || null,
          companyName: input.companyName,
          jobName: input.jobName || "",
          jobDate: input.jobDate || "",
          notes: input.notes || "",
          frameSize: input.frameSize || "",
          hp: input.hp || "",
          phase: input.phase || "",
          rpm: input.rpm || "",
          bodyLength: input.bodyLength || "",
          frontBearingCover: input.frontBearingCover || "",
          backBearingCover: input.backBearingCover || "",
          tbfcLabel: (input.tbfcLabel === "T.B.F.C." || !input.tbfcLabel) ? "T.E.F.C." : input.tbfcLabel,
          itemLabels: JSON.stringify(input.itemLabels || {}),
          itemDetails: JSON.stringify(input.itemDetails || {}),
          costItems: JSON.stringify(input.items || emptyCostItems()),
          totalAmount: String(totalAmount),
          adjustmentHistory: JSON.stringify(input.adjustmentHistory || []),
          drawingData: drawingDataStr,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        .returning();
      if (saved) return serializePgCostingRecord(saved);
    } catch (err) {
      console.warn("PostgreSQL insertCosting failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  if (!data.costingRecords) data.costingRecords = [];
  data.costingRecords.push(newRecord);
  await writeLocalData(data);
  return newRecord;
}

export async function updateCostingRecord(
  id: string,
  input: Partial<MotorCostingRecord>,
): Promise<MotorCostingRecord | null> {
  const now = new Date().toISOString();
  const existing = await findCostingById(id, true);
  if (!existing) return null;

  const mergedItems = input.items ? { ...existing.items, ...input.items } : existing.items;
  const totalAmount = input.items
    ? calculateCostTotal(mergedItems)
    : input.totalAmount !== undefined
    ? input.totalAmount
    : calculateCostTotal(mergedItems);

  if (db) {
    try {
      await ensureTables();
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(now),
      };
      if (input.companyName !== undefined) updateData.companyName = input.companyName;
      if (input.jobName !== undefined) updateData.jobName = input.jobName;
      if (input.jobDate !== undefined) updateData.jobDate = input.jobDate;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.frameSize !== undefined) updateData.frameSize = input.frameSize;
      if (input.hp !== undefined) updateData.hp = input.hp;
      if (input.phase !== undefined) updateData.phase = input.phase;
      if (input.rpm !== undefined) updateData.rpm = input.rpm;
      if (input.bodyLength !== undefined) updateData.bodyLength = input.bodyLength;
      if (input.frontBearingCover !== undefined) updateData.frontBearingCover = input.frontBearingCover;
      if (input.backBearingCover !== undefined) updateData.backBearingCover = input.backBearingCover;
      if (input.tbfcLabel !== undefined) {
        updateData.tbfcLabel = input.tbfcLabel === "T.B.F.C." ? "T.E.F.C." : input.tbfcLabel;
      }
      if (input.itemLabels !== undefined) updateData.itemLabels = JSON.stringify(input.itemLabels);
      if (input.itemDetails !== undefined) updateData.itemDetails = JSON.stringify(input.itemDetails);
      if (input.items !== undefined) updateData.costItems = JSON.stringify(mergedItems);
      updateData.totalAmount = String(totalAmount);
      if (input.adjustmentHistory !== undefined) {
        updateData.adjustmentHistory = JSON.stringify(input.adjustmentHistory);
      }
      if (input.motorRecordId !== undefined) {
        updateData.motorRecordId = input.motorRecordId || null;
      }
      if (input.drawingData !== undefined) {
        updateData.drawingData = input.drawingData;
      } else if (input.drawing !== undefined) {
        updateData.drawingData = input.drawing ? JSON.stringify(input.drawing) : "";
      }

      const [saved] = await db
        .update(motorCostingRecords)
        .set(updateData)
        .where(eq(motorCostingRecords.id, id))
        .returning();
      if (saved) return serializePgCostingRecord(saved);
    } catch (err) {
      console.warn("PostgreSQL updateCosting failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.costingRecords || [];
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const resolvedDrawing =
    input.drawing !== undefined
      ? input.drawing
      : input.drawingData
      ? (JSON.parse(input.drawingData) as ShaftDrawing)
      : list[index].drawing;

  const resolvedDrawingData =
    input.drawingData !== undefined
      ? input.drawingData
      : input.drawing
      ? JSON.stringify(input.drawing)
      : list[index].drawingData;

  const updated: MotorCostingRecord = {
    ...list[index],
    ...input,
    drawing: resolvedDrawing,
    drawingData: resolvedDrawingData,
    items: mergedItems,
    totalAmount,
    updatedAt: now,
  };
  list[index] = updated;
  data.costingRecords = list;
  await writeLocalData(data);
  return updated;
}

export async function deleteCostingRecord(
  id: string,
  permanent = false,
): Promise<boolean> {
  const now = new Date();
  if (db) {
    try {
      await ensureTables();
      if (permanent) {
        const [deleted] = await db
          .delete(motorCostingRecords)
          .where(eq(motorCostingRecords.id, id))
          .returning({ id: motorCostingRecords.id });
        if (deleted) return true;
      } else {
        const [updated] = await db
          .update(motorCostingRecords)
          .set({ deletedAt: now })
          .where(eq(motorCostingRecords.id, id))
          .returning({ id: motorCostingRecords.id });
        if (updated) return true;
      }
    } catch (err) {
      console.warn("PostgreSQL deleteCosting failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.costingRecords || [];
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return false;

  if (permanent) {
    data.costingRecords = list.filter((r) => r.id !== id);
  } else {
    list[index].deletedAt = now.toISOString();
    data.costingRecords = list;
  }
  await writeLocalData(data);
  return true;
}

export async function restoreCostingRecord(id: string): Promise<boolean> {
  if (db) {
    try {
      await ensureTables();
      const [restored] = await db
        .update(motorCostingRecords)
        .set({ deletedAt: null })
        .where(eq(motorCostingRecords.id, id))
        .returning({ id: motorCostingRecords.id });
      if (restored) return true;
    } catch (err) {
      console.warn("PostgreSQL restoreCosting failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.costingRecords || [];
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return false;
  list[index].deletedAt = null;
  data.costingRecords = list;
  await writeLocalData(data);
  return true;
}

export type PriceAdjustmentInput = {
  scope: "single" | "selected" | "all";
  recordIds?: string[];
  percentage: number;
  note?: string;
};

export async function applyPriceAdjustment(
  input: PriceAdjustmentInput,
): Promise<{ updatedCount: number; updatedRecords: MotorCostingRecord[] }> {
  const allRecords = await findCostingRecords({ recycle: false });
  let targetRecords: MotorCostingRecord[] = [];

  if (input.scope === "single" && input.recordIds?.length) {
    targetRecords = allRecords.filter((r) => r.id === input.recordIds![0]);
  } else if (input.scope === "selected" && input.recordIds?.length) {
    const idSet = new Set(input.recordIds);
    targetRecords = allRecords.filter((r) => idSet.has(r.id));
  } else if (input.scope === "all") {
    targetRecords = allRecords;
  }

  if (!targetRecords.length) {
    return { updatedCount: 0, updatedRecords: [] };
  }

  const pct = input.percentage;
  const factor = 1 + pct / 100;
  const now = new Date().toISOString();
  const updatedRecords: MotorCostingRecord[] = [];

  for (const record of targetRecords) {
    const previousItems = { ...record.items };
    const newItems: CostItems = { ...emptyCostItems() };
    for (const key of COST_ITEM_KEYS) {
      const oldPrice = Number(record.items[key]) || 0;
      newItems[key] = Math.round(oldPrice * factor * 100) / 100;
    }
    const newTotal = calculateCostTotal(newItems);
    const historyEntry: PriceAdjustmentHistoryEntry = {
      id: crypto.randomUUID(),
      appliedAt: now,
      percentage: pct,
      note: input.note || "",
      previousTotal: record.totalAmount,
      updatedTotal: newTotal,
      previousItems,
    };

    const newHistory = [historyEntry, ...(record.adjustmentHistory || [])];

    const updated = await updateCostingRecord(record.id, {
      items: newItems,
      totalAmount: newTotal,
      adjustmentHistory: newHistory,
      lastAdjustmentPercentage: pct,
      lastAdjustmentDate: now,
    });
    if (updated) {
      updatedRecords.push(updated);
    }
  }

  return { updatedCount: updatedRecords.length, updatedRecords };
}

export async function revertPriceAdjustment(id: string): Promise<MotorCostingRecord | null> {
  const record = await findCostingById(id);
  if (!record || !record.adjustmentHistory?.length) return null;

  const [latest, ...restHistory] = record.adjustmentHistory;
  const restoredItems: CostItems = {
    ...emptyCostItems(),
    ...(latest.previousItems as Partial<CostItems>),
  };
  const restoredTotal = calculateCostTotal(restoredItems);
  const prevAdj = restHistory[0];

  return updateCostingRecord(id, {
    items: restoredItems,
    totalAmount: restoredTotal,
    adjustmentHistory: restHistory,
    lastAdjustmentPercentage: prevAdj?.percentage,
    lastAdjustmentDate: prevAdj?.appliedAt,
  });
}

export async function bulkImportCostingRecords(
  records: MotorCostingRecord[],
  mode: "append" | "replace",
): Promise<number> {
  const now = new Date().toISOString();
  const newRecords: MotorCostingRecord[] = records.map((r) => ({
    ...r,
    id: r.id || crypto.randomUUID(),
    totalAmount: calculateCostTotal(r.items),
    createdAt: r.createdAt || now,
    updatedAt: now,
  }));

  if (db) {
    try {
      await ensureTables();
      await db.transaction(async (tx) => {
        if (mode === "replace") await tx.delete(motorCostingRecords);
        if (newRecords.length > 0) {
          await tx.insert(motorCostingRecords).values(
            newRecords.map((r) => ({
              id: r.id,
              motorRecordId: r.motorRecordId || null,
              companyName: r.companyName,
              jobName: r.jobName || "",
              jobDate: r.jobDate || "",
              notes: r.notes || "",
              frameSize: r.frameSize || "",
              hp: r.hp || "",
              phase: r.phase || "",
              rpm: r.rpm || "",
              bodyLength: r.bodyLength || "",
              frontBearingCover: r.frontBearingCover || "",
              backBearingCover: r.backBearingCover || "",
              tbfcLabel: (r.tbfcLabel === "T.B.F.C." || !r.tbfcLabel) ? "T.E.F.C." : r.tbfcLabel,
              itemLabels: JSON.stringify(r.itemLabels || {}),
              itemDetails: JSON.stringify(r.itemDetails || {}),
              costItems: JSON.stringify(r.items || emptyCostItems()),
              totalAmount: String(r.totalAmount),
              adjustmentHistory: JSON.stringify(r.adjustmentHistory || []),
              drawingData: r.drawingData || (r.drawing ? JSON.stringify(r.drawing) : ""),
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
              deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
            })),
          );
        }
      });
      return newRecords.length;
    } catch (err) {
      console.warn("PostgreSQL bulkImportCosting failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  if (mode === "replace") {
    data.costingRecords = newRecords;
  } else {
    data.costingRecords = [...(data.costingRecords || []), ...newRecords];
  }
  await writeLocalData(data);
  return newRecords.length;
}

export async function fetchFullBackupData(): Promise<{
  app: string;
  exportedAt: string;
  settings: Settings;
  records: WindingRecord[];
  costingRecords: MotorCostingRecord[];
  drawingTemplates: ShaftDrawingTemplate[];
}> {
  const [settings, records, costingRecords, drawingTemplatesList] = await Promise.all([
    fetchSettings(),
    findRecords(),
    findCostingRecords(),
    getDrawingTemplates(),
  ]);
  return {
    app: "EMCO Electrical Motor Winding & Costing Database",
    exportedAt: new Date().toISOString(),
    settings,
    records,
    costingRecords,
    drawingTemplates: drawingTemplatesList,
  };
}

export async function fetchSettings(): Promise<Settings> {
  if (db) {
    try {
      await ensureTables();
      const [existing] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, "primary"));
      if (existing) {
        return { appName: existing.appName, workshopName: existing.workshopName };
      }
      const [created] = await db
        .insert(appSettings)
        .values({ id: "primary", ...DEFAULT_SETTINGS })
        .onConflictDoNothing()
        .returning();
      if (created) {
        return { appName: created.appName, workshopName: created.workshopName };
      }
    } catch (err) {
      console.warn("PostgreSQL settings fetch failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  return data.settings;
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  if (db) {
    try {
      await ensureTables();
      const [saved] = await db
        .insert(appSettings)
        .values({
          id: "primary",
          appName: settings.appName,
          workshopName: settings.workshopName,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: {
            appName: settings.appName,
            workshopName: settings.workshopName,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (saved) {
        return { appName: saved.appName, workshopName: saved.workshopName };
      }
    } catch (err) {
      console.warn("PostgreSQL settings update failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  data.settings = settings;
  await writeLocalData(data);
  return data.settings;
}

export async function checkHealth(): Promise<boolean> {
  if (db) {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      // Postgres not responsive; continue to check local storage
    }
  }
  try {
    await readLocalData();
    return true;
  } catch {
    return false;
  }
}

export async function getDrawingTemplates(): Promise<ShaftDrawingTemplate[]> {
  if (db) {
    try {
      await ensureTables();
      const rows = await db
        .select()
        .from(drawingTemplates)
        .orderBy(asc(drawingTemplates.name));

      let hasNewSeed = false;
      for (const def of DEFAULT_SHAFT_TEMPLATES) {
        const existing = rows.find(
          (r) => r.id === def.id || r.name.toLowerCase().trim() === def.name.toLowerCase().trim(),
        );
        if (existing) {
          try {
            await db
              .update(drawingTemplates)
              .set({
                data: JSON.stringify({
                  elements: def.elements,
                  viewBoxWidth: def.viewBoxWidth,
                  viewBoxHeight: def.viewBoxHeight,
                }),
                updatedAt: new Date(),
              })
              .where(eq(drawingTemplates.id, existing.id));
            hasNewSeed = true;
          } catch {}
        } else {
          try {
            await db
              .insert(drawingTemplates)
              .values({
                id: def.id,
                name: def.name,
                description: def.description || "",
                data: JSON.stringify({
                  elements: def.elements,
                  viewBoxWidth: def.viewBoxWidth,
                  viewBoxHeight: def.viewBoxHeight,
                }),
              })
              .onConflictDoNothing();
            hasNewSeed = true;
          } catch {
            // ignore seed conflict
          }
        }
      }

      const finalRows = hasNewSeed
        ? await db
            .select()
            .from(drawingTemplates)
            .orderBy(asc(drawingTemplates.name))
        : rows;

      return finalRows.map((r) => {
        let parsed: { elements?: DrawingElement[]; viewBoxWidth?: number; viewBoxHeight?: number } = {};
        try {
          if (r.data) parsed = JSON.parse(r.data);
        } catch {}
        const defTpl = DEFAULT_SHAFT_TEMPLATES.find((t) => t.id === r.id);
        const resolvedElements = defTpl ? defTpl.elements : (Array.isArray(parsed.elements) ? parsed.elements : DEFAULT_SHAFT_TEMPLATE.elements);
        const resolvedWidth = defTpl ? defTpl.viewBoxWidth : (parsed.viewBoxWidth || DEFAULT_SHAFT_TEMPLATE.viewBoxWidth);
        const resolvedHeight = defTpl ? defTpl.viewBoxHeight : (parsed.viewBoxHeight || DEFAULT_SHAFT_TEMPLATE.viewBoxHeight);
        return {
          id: r.id,
          name: r.name,
          description: r.description || "",
          elements: resolvedElements,
          viewBoxWidth: resolvedWidth,
          viewBoxHeight: resolvedHeight,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      });
    } catch (err) {
      console.warn("PostgreSQL getDrawingTemplates failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.drawingTemplates || [...DEFAULT_SHAFT_TEMPLATES];
  let modified = false;
  for (const def of DEFAULT_SHAFT_TEMPLATES) {
    const idx = list.findIndex(
      (t) => t.id === def.id || t.name.toLowerCase().trim() === def.name.toLowerCase().trim(),
    );
    if (idx >= 0) {
      list[idx].elements = def.elements;
      list[idx].viewBoxWidth = def.viewBoxWidth;
      list[idx].viewBoxHeight = def.viewBoxHeight;
      modified = true;
    } else {
      list.push(def);
      modified = true;
    }
  }
  if (modified) {
    data.drawingTemplates = list;
    await writeLocalData(data);
  }
  return list;
}

export async function getDrawingTemplateById(id: string): Promise<ShaftDrawingTemplate | null> {
  if (db) {
    try {
      await ensureTables();
      const [row] = await db
        .select()
        .from(drawingTemplates)
        .where(eq(drawingTemplates.id, id));
      if (row) {
        let parsed: { elements?: DrawingElement[]; viewBoxWidth?: number; viewBoxHeight?: number } = {};
        try {
          if (row.data) parsed = JSON.parse(row.data);
        } catch {}
        const defTpl = DEFAULT_SHAFT_TEMPLATES.find((t) => t.id === row.id);
        const resolvedElements = defTpl ? defTpl.elements : (Array.isArray(parsed.elements) ? parsed.elements : DEFAULT_SHAFT_TEMPLATE.elements);
        const resolvedWidth = defTpl ? defTpl.viewBoxWidth : (parsed.viewBoxWidth || DEFAULT_SHAFT_TEMPLATE.viewBoxWidth);
        const resolvedHeight = defTpl ? defTpl.viewBoxHeight : (parsed.viewBoxHeight || DEFAULT_SHAFT_TEMPLATE.viewBoxHeight);
        return {
          id: row.id,
          name: row.name,
          description: row.description || "",
          elements: resolvedElements,
          viewBoxWidth: resolvedWidth,
          viewBoxHeight: resolvedHeight,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }
      return null;
    } catch (err) {
      console.warn("PostgreSQL getDrawingTemplateById failed, falling back to local storage:", err);
    }
  }

  const list = await getDrawingTemplates();
  return list.find((t) => t.id === id) || null;
}

export async function saveDrawingTemplate(input: {
  id?: string;
  name: string;
  description?: string;
  elements: DrawingElement[];
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}): Promise<ShaftDrawingTemplate> {
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const templateToSave: ShaftDrawingTemplate = {
    id,
    name: input.name.trim() || "Untitled Template",
    description: input.description?.trim() || "",
    elements: input.elements,
    viewBoxWidth: input.viewBoxWidth || 800,
    viewBoxHeight: input.viewBoxHeight || 360,
    createdAt: now,
    updatedAt: now,
  };

  const payloadData = JSON.stringify({
    elements: templateToSave.elements,
    viewBoxWidth: templateToSave.viewBoxWidth,
    viewBoxHeight: templateToSave.viewBoxHeight,
  });

  if (db) {
    try {
      await ensureTables();
      const [existing] = await db
        .select()
        .from(drawingTemplates)
        .where(eq(drawingTemplates.id, id));

      if (existing) {
        const [updated] = await db
          .update(drawingTemplates)
          .set({
            name: templateToSave.name,
            description: templateToSave.description,
            data: payloadData,
            updatedAt: new Date(now),
          })
          .where(eq(drawingTemplates.id, id))
          .returning();
        if (updated) {
          return {
            id: updated.id,
            name: updated.name,
            description: updated.description,
            elements: templateToSave.elements,
            viewBoxWidth: templateToSave.viewBoxWidth,
            viewBoxHeight: templateToSave.viewBoxHeight,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          };
        }
      } else {
        const [created] = await db
          .insert(drawingTemplates)
          .values({
            id,
            name: templateToSave.name,
            description: templateToSave.description,
            data: payloadData,
            createdAt: new Date(now),
            updatedAt: new Date(now),
          })
          .returning();
        if (created) {
          return {
            id: created.id,
            name: created.name,
            description: created.description,
            elements: templateToSave.elements,
            viewBoxWidth: templateToSave.viewBoxWidth,
            viewBoxHeight: templateToSave.viewBoxHeight,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn("PostgreSQL saveDrawingTemplate failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.drawingTemplates || [DEFAULT_SHAFT_TEMPLATE];
  const idx = list.findIndex((t) => t.id === id);
  if (idx !== -1) {
    templateToSave.createdAt = list[idx].createdAt;
    list[idx] = templateToSave;
  } else {
    list.push(templateToSave);
  }
  data.drawingTemplates = list;
  await writeLocalData(data);
  return templateToSave;
}

export async function deleteDrawingTemplate(id: string): Promise<boolean> {
  if (db) {
    try {
      await ensureTables();
      await db.delete(drawingTemplates).where(eq(drawingTemplates.id, id));
    } catch (err) {
      console.warn("PostgreSQL deleteDrawingTemplate failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const list = data.drawingTemplates || [];
  const initialLength = list.length;
  data.drawingTemplates = list.filter((t) => t.id !== id);
  if (data.drawingTemplates.length !== initialLength) {
    await writeLocalData(data);
  }
  return true;
}

export async function duplicateDrawingTemplate(
  id: string,
  newName?: string,
): Promise<ShaftDrawingTemplate | null> {
  const existing = await getDrawingTemplateById(id);
  if (!existing) return null;

  const duplicated = await saveDrawingTemplate({
    name: newName || `${existing.name} (Copy)`,
    description: existing.description || "",
    elements: JSON.parse(JSON.stringify(existing.elements)),
    viewBoxWidth: existing.viewBoxWidth,
    viewBoxHeight: existing.viewBoxHeight,
  });
  return duplicated;
}

export async function bulkImportDrawingTemplates(
  templates: ShaftDrawingTemplate[],
  mode: "append" | "replace",
): Promise<number> {
  const now = new Date().toISOString();
  const list: ShaftDrawingTemplate[] = templates.map((t) => ({
    ...t,
    id: t.id || crypto.randomUUID(),
    createdAt: t.createdAt || now,
    updatedAt: now,
  }));

  if (db) {
    try {
      await ensureTables();
      await db.transaction(async (tx) => {
        if (mode === "replace") await tx.delete(drawingTemplates);
        if (list.length > 0) {
          for (const item of list) {
            await tx
              .insert(drawingTemplates)
              .values({
                id: item.id,
                name: item.name,
                description: item.description || "",
                data: JSON.stringify({
                  elements: item.elements,
                  viewBoxWidth: item.viewBoxWidth,
                  viewBoxHeight: item.viewBoxHeight,
                }),
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt),
              })
              .onConflictDoUpdate({
                target: drawingTemplates.id,
                set: {
                  name: item.name,
                  description: item.description || "",
                  data: JSON.stringify({
                    elements: item.elements,
                    viewBoxWidth: item.viewBoxWidth,
                    viewBoxHeight: item.viewBoxHeight,
                  }),
                  updatedAt: new Date(now),
                },
              });
          }
        }
      });
      return list.length;
    } catch (err) {
      console.warn("PostgreSQL bulkImportDrawingTemplates failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  if (mode === "replace") {
    data.drawingTemplates = list.length > 0 ? list : [DEFAULT_SHAFT_TEMPLATE];
  } else {
    const existing = data.drawingTemplates || [];
    const merged = [...existing];
    for (const item of list) {
      const idx = merged.findIndex((m) => m.id === item.id);
      if (idx !== -1) merged[idx] = item;
      else merged.push(item);
    }
    data.drawingTemplates = merged;
  }
  await writeLocalData(data);
  return list.length;
}

