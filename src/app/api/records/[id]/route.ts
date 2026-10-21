import { coerceRecordInput, validateRecord } from "@/lib/winding";
import { hardDeleteRecordById, restoreRecordById, softDeleteRecordById, findRecordById, updateRecordById } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const record = await findRecordById(id, true);
  if (!record) return Response.json({ message: "Record not found." }, { status: 404 });
  return Response.json({ record });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const body = await request.json();
    if (body.restore === true) {
      const restored = await restoreRecordById(id);
      if (!restored) return Response.json({ message: "Record not found." }, { status: 404 });
      return Response.json({ ok: true, restored: true });
    }

    const input = coerceRecordInput(body);
    const errors = validateRecord(input);
    if (Object.keys(errors).length) {
      return Response.json({ message: "Please correct the highlighted fields.", errors }, { status: 422 });
    }

    const record = await updateRecordById(id, input);
    if (!record) return Response.json({ message: "Record not found." }, { status: 404 });
    return Response.json({ record });
  } catch {
    return Response.json({ message: "Could not update this record. Please try again." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get("permanent") === "true";

  const success = permanent ? await hardDeleteRecordById(id) : await softDeleteRecordById(id);
  if (!success) return Response.json({ message: "Record not found." }, { status: 404 });
  return Response.json({ ok: true, permanent });
}
