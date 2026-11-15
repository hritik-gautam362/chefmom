import { NextRequest, NextResponse } from "next/server";
import { generateMatchingRecipes } from "@/lib/matchingEngine";
import { generateRecipeWithAI } from "@/lib/aiAdapter";
import { Recipe } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ingredients = [],
      preferences = {},
      excludedIds = [],
      batch = 0,
      limit = 9,
      includeAi = false
    } = body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide at least one ingredient." },
        { status: 400 }
      );
    }

    // 1. Run database matching engine
    const matchResult = generateMatchingRecipes({
      ingredients,
      preferences,
      excludedIds,
      limit,
      batch
    });

    let recipes: Recipe[] = matchResult.recipes;

    // 2. Optional AI generation adapter if requested and on first batch
    if (includeAi && batch === 0 && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      try {
        const aiRes = await generateRecipeWithAI({
          ingredients,
          dietary: preferences.dietary,
          cuisine: preferences.cuisine,
          meal_type: preferences.meal_type,
          max_time_minutes: preferences.max_time_minutes,
          servings: preferences.servings,
          allergies: preferences.allergies
        });

        if (aiRes.success && aiRes.recipe) {
          // Prepend AI recipe to front of list
          recipes = [aiRes.recipe, ...recipes.slice(0, limit - 1)];
        }
      } catch (aiErr) {
        console.warn("AI recipe generation skipped:", aiErr);
      }
    }

    return NextResponse.json({
      success: true,
      recipes,
      totalMatches: matchResult.totalMatches,
      hasMore: matchResult.hasMore,
      batch
    });
  } catch (error: any) {
    console.error("Recipe generation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate recipes." },
      { status: 500 }
    );
  }
}
