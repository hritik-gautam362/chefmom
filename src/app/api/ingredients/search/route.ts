import { NextRequest, NextResponse } from "next/server";
import { searchIngredients } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category") || undefined;
    const limit = parseInt(searchParams.get("limit") || "40", 10);

    const results = searchIngredients(query, category, limit);
    return NextResponse.json({ success: true, ingredients: results });
  } catch (error: any) {
    console.error("Ingredients search error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to search ingredients" },
      { status: 500 }
    );
  }
}
