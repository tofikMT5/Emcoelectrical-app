import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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
  };
}

export type RecordFilterParams = {
  frameSize?: string;
  hp?: string;
  phase?: string;
  rpm?: string;
  q?: string;
  companyName?: string;
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
  let matches = data.records;

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

export async function findRecordById(id: string): Promise<WindingRecord | null> {
  if (db) {
    try {
      const [record] = await db
        .select()
        .from(windingRecords)
        .where(eq(windingRecords.id, id));
      if (record) return serializePgRecord(record);
    } catch (err) {
      console.warn("PostgreSQL findById failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  return data.records.find((r) => r.id === id) ?? null;
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

export async function deleteRecordById(id: string): Promise<boolean> {
  if (db) {
    try {
      const [record] = await db
        .delete(windingRecords)
        .where(eq(windingRecords.id, id))
        .returning({ id: windingRecords.id });
      if (record) return true;
    } catch (err) {
      console.warn("PostgreSQL delete failed, falling back to local storage:", err);
    }
  }

  const data = await readLocalData();
  const beforeLength = data.records.length;
  data.records = data.records.filter((r) => r.id !== id);
  if (data.records.length === beforeLength) return false;
  await writeLocalData(data);
  return true;
}

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
      await db.transaction(async (tx) => {
        if (mode === "replace") await tx.delete(windingRecords);
        await tx.insert(windingRecords).values(
          newRecords.map((record) => ({
            ...record,
            hpKey: normalizeNumber(record.hp),
            rpmKey: normalizeNumber(record.rpm),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
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
