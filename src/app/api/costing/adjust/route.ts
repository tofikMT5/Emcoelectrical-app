import { applyPriceAdjustment, findCostingRecords } from "@/db";
import { calculateCostTotal, emptyCostItems, COST_ITEM_KEYS, type CostItems } from "@/lib/winding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scope = (body.scope as "single" | "selected" | "all") || "all";
    let recordIds: string[] = Array.isArray(body.recordIds) ? body.recordIds : [];
    if (recordIds.length === 0 && (body.costingRecordId || body.recordId)) {
      recordIds = [String(body.costingRecordId || body.recordId)];
    }
    const percentage = Number(body.percentage);
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const isPreview = body.preview === true || body.previewOnly === true;

    if (!Number.isFinite(percentage)) {
      return Response.json({ message: "Enter a valid percentage number (e.g. 5 for 5%)." }, { status: 422 });
    }

    if ((scope === "single" || scope === "selected") && recordIds.length === 0) {
      return Response.json({ message: "Please select at least one costing record." }, { status: 422 });
    }

    const allRecords = await findCostingRecords({ recycle: false });
    let targetRecords = allRecords;

    if (scope === "single" && recordIds.length > 0) {
      targetRecords = allRecords.filter((r) => r.id === recordIds[0]);
    } else if (scope === "selected" && recordIds.length > 0) {
      const idSet = new Set(recordIds);
      targetRecords = allRecords.filter((r) => idSet.has(r.id));
    }

    if (targetRecords.length === 0) {
      return Response.json({ message: "No active costing records match the selected scope." }, { status: 404 });
    }

    const factor = 1 + percentage / 100;

    if (isPreview) {
      let totalOld = 0;
      let totalNew = 0;

      const previewList = targetRecords.map((rec) => {
        const oldItems = rec.items;
        const newItems: CostItems = { ...emptyCostItems() };
        for (const key of COST_ITEM_KEYS) {
          const oldVal = Number(oldItems[key]) || 0;
          newItems[key] = Math.round(oldVal * factor * 100) / 100;
        }
        const oldTotal = rec.totalAmount;
        const newTotal = calculateCostTotal(newItems);
        totalOld += oldTotal;
        totalNew += newTotal;

        const hasSamePercentage = rec.lastAdjustmentPercentage === percentage;

        return {
          id: rec.id,
          companyName: rec.companyName,
          frameSize: rec.frameSize,
          hp: rec.hp,
          oldItems,
          newItems,
          oldTotal,
          newTotal,
          diff: Math.round((newTotal - oldTotal) * 100) / 100,
          hasSamePercentage,
          lastAdjustmentPercentage: rec.lastAdjustmentPercentage,
          lastAdjustmentDate: rec.lastAdjustmentDate,
        };
      });

      return Response.json({
        ok: true,
        percentage,
        totalRecords: previewList.length,
        totalOldAmount: Math.round(totalOld * 100) / 100,
        totalNewAmount: Math.round(totalNew * 100) / 100,
        preview: previewList,
      });
    }

    const result = await applyPriceAdjustment({
      scope,
      recordIds,
      percentage,
      note,
    });

    return Response.json({
      ok: true,
      updatedCount: result.updatedCount,
      percentage,
      records: result.updatedRecords,
    });
  } catch (err) {
    console.error("Price adjustment error:", err);
    return Response.json({ message: "Could not apply price adjustment. Please try again." }, { status: 400 });
  }
}
