import { fetchFullBackupData, findCostingRecords, findRecords } from "@/db";
import { COST_ITEM_KEYS, COST_ITEM_LABELS, type MotorCostingRecord, type WindingRecord } from "@/lib/winding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvValue(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function windingRecordsToCsv(records: WindingRecord[]): string {
  const fields: (keyof WindingRecord)[] = [
    "id",
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
    "createdAt",
    "updatedAt",
  ];
  return [
    fields.join(","),
    ...records.map((record) => fields.map((field) => csvValue(record[field] as string)).join(",")),
  ].join("\r\n");
}

function costingRecordsToCsv(records: MotorCostingRecord[]): string {
  const headers = [
    "id",
    "companyName",
    "jobName",
    "jobDate",
    "notes",
    "frameSize",
    "hp",
    "phase",
    "rpm",
    "bodyLength",
    "frontBearingCover",
    "backBearingCover",
    "tbfcLabel",
    ...COST_ITEM_KEYS.map((k) => COST_ITEM_LABELS[k]),
    "totalAmount",
    "createdAt",
    "updatedAt",
  ];

  const rows = records.map((rec) => {
    return [
      csvValue(rec.id),
      csvValue(rec.companyName),
      csvValue(rec.jobName),
      csvValue(rec.jobDate),
      csvValue(rec.notes),
      csvValue(rec.frameSize),
      csvValue(rec.hp),
      csvValue(rec.phase),
      csvValue(rec.rpm),
      csvValue(rec.bodyLength),
      csvValue(rec.frontBearingCover),
      csvValue(rec.backBearingCover),
      csvValue(rec.tbfcLabel || "T.B.F.C."),
      ...COST_ITEM_KEYS.map((k) => csvValue(rec.items?.[k] ?? 0)),
      csvValue(rec.totalAmount),
      csvValue(rec.createdAt),
      csvValue(rec.updatedAt),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "json").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const records = await findRecords({ recycle: false });
    const csvContent = windingRecordsToCsv(records);
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="emco-motor-winding-backup-${date}.csv"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  }

  if (format === "costing-csv") {
    const records = await findCostingRecords({ recycle: false });
    const csvContent = costingRecordsToCsv(records);
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="emco-motor-costing-backup-${date}.csv"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  }

  // default: JSON backup
  const data = await fetchFullBackupData();
  const jsonContent = JSON.stringify(data, null, 2);
  return new Response(jsonContent, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="emco-motor-winding-backup-${date}.json"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
