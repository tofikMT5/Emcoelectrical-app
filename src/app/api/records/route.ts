import { coerceRecordInput, validateRecord } from "@/lib/winding";
import { findRecords, insertRecord } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const frameSize = searchParams.get("frameSize") ?? "";
  const hp = searchParams.get("hp") ?? "";
  const phase = searchParams.get("phase") ?? "";
  const rpm = searchParams.get("rpm") ?? "";
  const q = searchParams.get("q") ?? "";
  const companyName = searchParams.get("companyName") ?? searchParams.get("company") ?? "";

  const records = await findRecords({ frameSize, hp, phase, rpm, q, companyName });
  return Response.json({ records });
}

export async function POST(request: Request) {
  try {
    const input = coerceRecordInput(await request.json());
    const errors = validateRecord(input);
    if (Object.keys(errors).length) {
      return Response.json({ message: "Please correct the highlighted fields.", errors }, { status: 422 });
    }

    const record = await insertRecord(input);
    return Response.json({ record }, { status: 201 });
  } catch {
    return Response.json({ message: "Could not save this record. Please try again." }, { status: 400 });
  }
}
