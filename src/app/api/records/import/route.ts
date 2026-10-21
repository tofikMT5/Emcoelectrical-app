import { bulkImportRecords } from "@/db";
import { coerceRecordInput, validateRecord } from "@/lib/winding";

export const runtime = "nodejs";

type ImportBody = {
  records?: unknown;
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
    return Response.json({ ok: true, imported, mode });
  } catch {
    return Response.json({ message: "That backup could not be read. Use a valid Motor Winding Library JSON file." }, { status: 400 });
  }
}
