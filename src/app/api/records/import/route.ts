import { bulkImportCostingRecords, bulkImportRecords } from "@/db";
import { coerceRecordInput, emptyCostItems, validateRecord, type MotorCostingRecord } from "@/lib/winding";

export const runtime = "nodejs";

type ImportBody = {
  records?: unknown;
  costingRecords?: unknown;
  drawingTemplates?: unknown;
  mode?: "append" | "replace";
  confirmed?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportBody;
    if (!Array.isArray(body.records)) {
      return Response.json({ message: "The backup must include a records array." }, { status: 400 });
    }
    if (body.records.length === 0) {
      return Response.json({ message: "No records were found in this backup." }, { status: 400 });
    }
    if (body.records.length > 2000) {
      return Response.json({ message: "Please import 2,000 records or fewer at a time." }, { status: 400 });
    }

    const parsed = body.records.map(coerceRecordInput);
    const invalid = parsed
      .map((record, index) => ({ index: index + 1, errors: validateRecord(record) }))
      .filter((entry) => Object.keys(entry.errors).length > 0);

    if (invalid.length) {
      return Response.json(
        { message: `${invalid.length} imported record(s) are missing required motor information.`, invalid: invalid.slice(0, 8) },
        { status: 422 },
      );
    }

    const mode = body.mode === "replace" ? "replace" : "append";
    if (mode === "replace" && body.confirmed !== true) {
      return Response.json({ message: "Replacement imports require explicit confirmation." }, { status: 400 });
    }

    const imported = await bulkImportRecords(parsed, mode);

    let importedCosting = 0;
    if (Array.isArray(body.costingRecords) && body.costingRecords.length > 0) {
      const parsedCosting: MotorCostingRecord[] = body.costingRecords.map((item) => {
        const obj = (item && typeof item === "object" ? item : {}) as Partial<MotorCostingRecord>;
        return {
          id: obj.id || "",
          motorRecordId: obj.motorRecordId || null,
          companyName: String(obj.companyName || "Untitled Costing"),
          jobName: String(obj.jobName || ""),
          jobDate: String(obj.jobDate || ""),
          notes: String(obj.notes || ""),
          frameSize: String(obj.frameSize || ""),
          hp: String(obj.hp || ""),
          phase: String(obj.phase || ""),
          rpm: String(obj.rpm || ""),
          bodyLength: String(obj.bodyLength || ""),
          frontBearingCover: String(obj.frontBearingCover || ""),
          backBearingCover: String(obj.backBearingCover || ""),
          tbfcLabel: String((obj.tbfcLabel === "T.B.F.C." || !obj.tbfcLabel) ? "T.E.F.C." : obj.tbfcLabel),
          itemLabels: obj.itemLabels && typeof obj.itemLabels === "object" ? obj.itemLabels : {},
          itemDetails: obj.itemDetails && typeof obj.itemDetails === "object" ? obj.itemDetails : {},
          items: obj.items && typeof obj.items === "object" ? { ...emptyCostItems(), ...obj.items } : emptyCostItems(),
          totalAmount: Number(obj.totalAmount) || 0,
          adjustmentHistory: Array.isArray(obj.adjustmentHistory) ? obj.adjustmentHistory : [],
          drawing: obj.drawing || (obj.drawingData ? JSON.parse(obj.drawingData) : null),
          drawingData: obj.drawingData || (obj.drawing ? JSON.stringify(obj.drawing) : ""),
          createdAt: String(obj.createdAt || new Date().toISOString()),
          updatedAt: String(obj.updatedAt || new Date().toISOString()),
          deletedAt: obj.deletedAt ? String(obj.deletedAt) : null,
        };
      });
      importedCosting = await bulkImportCostingRecords(parsedCosting, mode);
    }

    let importedTemplates = 0;
    if (Array.isArray(body.drawingTemplates) && body.drawingTemplates.length > 0) {
      const { bulkImportDrawingTemplates } = await import("@/db");
      importedTemplates = await bulkImportDrawingTemplates(body.drawingTemplates as any, mode);
    }

    return Response.json({ ok: true, imported, importedCosting, importedTemplates, mode });
  } catch {
    return Response.json({ message: "That backup could not be read. Use a valid Motor Winding Library JSON file." }, { status: 400 });
  }
}
