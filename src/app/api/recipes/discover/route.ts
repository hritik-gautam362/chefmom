import { NextRequest, NextResponse } from "next/server";
import { getDatabase, formatRecipeRow, isProhibitedText } from "@/lib/db";
import { Recipe } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get("collection") || "popular";
    const cuisine = searchParams.get("cuisine");
    const meal_type = searchParams.get("meal_type");
    const max_time = searchParams.get("max_time") ? parseInt(searchParams.get("max_time")!, 10) : undefined;
    const dietary = searchParams.get("dietary"); // vegetarian, vegan
    const search = searchParams.get("search")?.trim();
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "12", 10));
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // If search term itself contains prohibited content, return empty immediately
    if (search && isProhibitedText(search)) {
      return NextResponse.json({
        success: true,
        recipes: [],
        total: 0,
        hasMore: false,
        limit,
        offset
      });
    }

    const db = getDatabase();
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Search query
    if (search) {
      whereClauses.push("(r.title LIKE ? OR r.ingredient_keywords LIKE ? OR r.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Collection presets
    if (collection === "quick-15") {
      whereClauses.push("r.total_time_minutes > 0 AND r.total_time_minutes <= 20");
    } else if (collection === "indian") {
      whereClauses.push("r.cuisine = 'Indian'");
    } else if (collection === "vegetarian") {
      whereClauses.push("r.is_vegetarian = 1");
    } else if (collection === "healthy") {
      whereClauses.push("r.is_vegetarian = 1 AND r.total_time_minutes <= 45");
    } else if (collection === "breakfast") {
      whereClauses.push("r.meal_type = 'Breakfast'");
    } else if (collection === "comfort") {
      whereClauses.push("(r.category LIKE '%soup%' OR r.category LIKE '%pasta%' OR r.title LIKE '%cheese%' OR r.title LIKE '%pot%')");
    } else if (collection === "dinner") {
      whereClauses.push("r.meal_type = 'Dinner'");
    } else if (collection === "snacks") {
      whereClauses.push("(r.meal_type = 'Snack' OR r.category LIKE '%appetizer%')");
    } else if (collection === "desserts") {
      whereClauses.push("(r.meal_type = 'Dessert' OR r.category LIKE '%dessert%')");
    } else if (collection === "international") {
      whereClauses.push("r.cuisine != 'American / International'");
    } else if (collection === "budget") {
      whereClauses.push("(r.ingredient_keywords LIKE '%rice%' OR r.ingredient_keywords LIKE '%potato%' OR r.ingredient_keywords LIKE '%bean%' OR r.ingredient_keywords LIKE '%lentil%')");
    }

    // Additional filters
    if (cuisine && cuisine !== "all") {
      whereClauses.push("r.cuisine LIKE ?");
      params.push(`%${cuisine}%`);
    }

    if (meal_type && meal_type !== "all") {
      whereClauses.push("r.meal_type = ?");
      params.push(meal_type);
    }

    if (max_time && max_time > 0) {
      whereClauses.push("r.total_time_minutes <= ?");
      params.push(max_time);
    }

    if (dietary === "vegetarian") {
      whereClauses.push("r.is_vegetarian = 1");
    } else if (dietary === "vegan") {
      whereClauses.push("r.is_vegan = 1");
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Count total matches
    const countSql = `SELECT count(*) as total FROM recipes r ${whereSql}`;
    const totalRow = db.prepare(countSql).get(...params) as any;
    const total = totalRow?.total || 0;

    // Fetch recipes
    const selectSql = `
      SELECT r.* FROM recipes r
      ${whereSql}
      ORDER BY r.rating DESC, r.review_count DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(selectSql).all(...params, limit, offset);
    const recipes: Recipe[] = rows
      .filter((r: any) => !isProhibitedText(`${r.title} ${r.description || ""} ${r.category || ""} ${r.ingredients_raw || ""} ${r.directions_text || ""}`))
      .map((r: any) => formatRecipeRow(r));

    return NextResponse.json({
      success: true,
      recipes,
      total,
      hasMore: offset + limit < total,
      limit,
      offset
    });
  } catch (error: any) {
    console.error("Discover API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load discover recipes." },
      { status: 500 }
    );
  }
}
