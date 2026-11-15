import { NextRequest, NextResponse } from "next/server";
import { getRecipeById } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing recipe ID" }, { status: 400 });
    }

    const recipe = getRecipeById(id);
    if (!recipe) {
      return NextResponse.json({ success: false, error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, recipe });
  } catch (error: any) {
    console.error("Get recipe error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve recipe." },
      { status: 500 }
    );
  }
}
