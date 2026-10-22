import { duplicateDrawingTemplate, getDrawingTemplates, saveDrawingTemplate } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await getDrawingTemplates();
    return Response.json({ templates });
  } catch (err) {
    console.error("Error fetching drawing templates:", err);
    return Response.json({ message: "Could not load templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.duplicateFromId) {
      const duplicated = await duplicateDrawingTemplate(body.duplicateFromId, body.name);
      if (!duplicated) {
        return Response.json({ message: "Template to duplicate not found." }, { status: 404 });
      }
      return Response.json({ template: duplicated }, { status: 201 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json(
        { message: "Template name is required.", errors: { name: "Enter a template name." } },
        { status: 422 },
      );
    }

    const template = await saveDrawingTemplate({
      id: body.id,
      name,
      description: typeof body.description === "string" ? body.description.trim() : "",
      elements: Array.isArray(body.elements) ? body.elements : [],
      viewBoxWidth: typeof body.viewBoxWidth === "number" ? body.viewBoxWidth : 800,
      viewBoxHeight: typeof body.viewBoxHeight === "number" ? body.viewBoxHeight : 360,
    });

    return Response.json({ template }, { status: 201 });
  } catch (err) {
    console.error("Error saving drawing template:", err);
    return Response.json({ message: "Could not save template." }, { status: 400 });
  }
}
