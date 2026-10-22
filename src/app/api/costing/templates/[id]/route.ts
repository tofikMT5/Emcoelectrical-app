import {
  deleteDrawingTemplate,
  getDrawingTemplateById,
  getDrawingTemplates,
  saveDrawingTemplate,
} from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const template = await getDrawingTemplateById(id);
  if (!template) {
    return Response.json({ message: "Template not found." }, { status: 404 });
  }
  return Response.json({ template });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const existing = await getDrawingTemplateById(id);
    if (!existing) {
      return Response.json({ message: "Template not found." }, { status: 404 });
    }

    const body = await request.json();
    let name = existing.name;
    if (typeof body.name === "string") {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return Response.json({ message: "Template name cannot be empty." }, { status: 400 });
      }
      const allTemplates = await getDrawingTemplates();
      const duplicate = allTemplates.some(
        (t) => t.id !== id && t.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        return Response.json(
          { message: "A template with this name already exists. Please choose a different name." },
          { status: 400 },
        );
      }
      name = trimmedName;
    }

    const description = typeof body.description === "string" ? body.description.trim() : existing.description;
    const elements = Array.isArray(body.elements) ? body.elements : existing.elements;
    const viewBoxWidth = typeof body.viewBoxWidth === "number" ? body.viewBoxWidth : existing.viewBoxWidth;
    const viewBoxHeight = typeof body.viewBoxHeight === "number" ? body.viewBoxHeight : existing.viewBoxHeight;

    const updated = await saveDrawingTemplate({
      id,
      name,
      description,
      elements,
      viewBoxWidth,
      viewBoxHeight,
    });

    return Response.json({ template: updated });
  } catch (err) {
    console.error("Error updating drawing template:", err);
    return Response.json({ message: "Could not update template." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  try {
    const success = await deleteDrawingTemplate(id);
    if (!success) {
      return Response.json({ message: "Template not found." }, { status: 404 });
    }
    return Response.json({ ok: true, id });
  } catch (err) {
    console.error("Error deleting drawing template:", err);
    return Response.json({ message: "Could not delete template." }, { status: 400 });
  }
}
