import { fetchSettings, updateSettings } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await fetchSettings();
  return Response.json({ settings });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { appName?: string; workshopName?: string };
    const appName = typeof body.appName === "string" ? body.appName.trim().slice(0, 120) : "";
    const workshopName = typeof body.workshopName === "string" ? body.workshopName.trim().slice(0, 160) : "";
    if (!appName || !workshopName) {
      return Response.json({ message: "Enter both an app name and a workshop name." }, { status: 422 });
    }

    const settings = await updateSettings({ appName, workshopName });
    return Response.json({ settings });
  } catch {
    return Response.json({ message: "Could not save settings." }, { status: 400 });
  }
}
