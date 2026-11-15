import { NextRequest, NextResponse } from "next/server";
import { generateRecipeWithAI } from "@/lib/aiAdapter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ingredients = [],
      dietary,
      cuisine,
      meal_type,
      max_time_minutes,
      servings,
      allergies,
      style = "original",
      baseRecipeTitle
    } = body;

    const result = await generateRecipeWithAI({
      ingredients,
      dietary,
      cuisine,
      meal_type,
      max_time_minutes,
      servings,
      allergies,
      style,
      baseRecipeTitle
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "AI generation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, recipe: result.recipe });
  } catch (error: any) {
    console.error("AI generation endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during AI generation." },
      { status: 500 }
    );
  }
}
