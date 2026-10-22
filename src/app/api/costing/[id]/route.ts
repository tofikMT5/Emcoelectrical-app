import {
  deleteCostingRecord,
  findCostingById,
  restoreCostingRecord,
  revertPriceAdjustment,
  updateCostingRecord,
} from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const record = await findCostingById(id, true);
  if (!record) return Response.json({ message: "Costing record not found." }, { status: 404 });
  return Response.json({ record });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const body = await request.json();

    if (body.restore === true) {
      const restored = await restoreCostingRecord(id);
      if (!restored) return Response.json({ message: "Costing record not found." }, { status: 404 });
      return Response.json({ ok: true, restored: true });
    }

    if (body.revert === true) {
      const reverted = await revertPriceAdjustment(id);
      if (!reverted) {
        return Response.json(
          { message: "No previous price adjustment to revert for this record." },
          { status: 400 },
        );
      }
      return Response.json({ ok: true, record: reverted });
    }

    const updated = await updateCostingRecord(id, body);
    if (!updated) return Response.json({ message: "Costing record not found." }, { status: 404 });
    return Response.json({ record: updated });
  } catch (err) {
    console.error("Error updating costing record:", err);
    return Response.json({ message: "Could not update costing record." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get("permanent") === "true";

  const success = await deleteCostingRecord(id, permanent);
  if (!success) return Response.json({ message: "Costing record not found." }, { status: 404 });
  return Response.json({ ok: true, permanent });
}
