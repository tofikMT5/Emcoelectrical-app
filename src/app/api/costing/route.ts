import { findCostingRecords, insertCostingRecord } from "@/db";
import { emptyCostItems, type CostItems } from "@/lib/winding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const frameSize = searchParams.get("frameSize") ?? "";
  const motorRecordId = searchParams.get("motorRecordId") ?? "";
  const recycle = searchParams.get("recycle") === "true";

  const records = await findCostingRecords({ q, frameSize, motorRecordId, recycle });
  return Response.json({ records });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    if (!companyName) {
      return Response.json(
        { message: "Motor or company name is required.", errors: { companyName: "Enter motor or company name." } },
        { status: 422 },
      );
    }

    const items: CostItems = {
      ...emptyCostItems(),
      ...(body.items && typeof body.items === "object" ? body.items : {}),
    };

    const record = await insertCostingRecord({
      companyName,
      motorRecordId: typeof body.motorRecordId === "string" && body.motorRecordId ? body.motorRecordId : null,
      jobName: typeof body.jobName === "string" ? body.jobName.trim() : "",
      jobDate: typeof body.jobDate === "string" ? body.jobDate.trim() : "",
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
      frameSize: typeof body.frameSize === "string" ? body.frameSize.trim() : "",
      hp: typeof body.hp === "string" ? body.hp.trim() : "",
      phase: typeof body.phase === "string" ? body.phase.trim() : "",
      rpm: typeof body.rpm === "string" ? body.rpm.trim() : "",
      bodyLength: typeof body.bodyLength === "string" ? body.bodyLength.trim() : "",
      frontBearingCover: typeof body.frontBearingCover === "string" ? body.frontBearingCover.trim() : "",
      backBearingCover: typeof body.backBearingCover === "string" ? body.backBearingCover.trim() : "",
      tbfcLabel: typeof body.tbfcLabel === "string" && body.tbfcLabel.trim() ? body.tbfcLabel.trim() : "T.B.F.C.",
      drawing: body.drawing || null,
      drawingData: typeof body.drawingData === "string" ? body.drawingData : body.drawing ? JSON.stringify(body.drawing) : "",
      items,
    });

    return Response.json({ record }, { status: 201 });
  } catch (err) {
    console.error("Error creating costing record:", err);
    return Response.json({ message: "Could not save costing record. Please try again." }, { status: 400 });
  }
}
