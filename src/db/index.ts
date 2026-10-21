import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { appSettings, windingRecords } from "./schema";
import {
  normalizeNumber,
  normalizePhase,
  normalizeValue,
  type RecordInput,
  type Settings,
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE winding_records ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
        ALTER TABLE winding_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE TABLE IF NOT EXISTS app_settings (
          id VARCHAR(32) PRIMARY KEY,
          app_name VARCHAR(120) NOT NULL,
          workshop_name VARCHAR(160) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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
};

async function readLocalData(): Promise<StorageData> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(content) as Partial<StorageData>;
    return {
      settings: parsed.settings || DEFAULT_SETTINGS,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, records: [] };
  }
}

async function writeLocalData(data: StorageData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tempFile, DATA_FILE);
}

function serializePgRecord(record: typeof windingRecords.$inferSelect): WindingRecord {
  return {
    ...record,
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
