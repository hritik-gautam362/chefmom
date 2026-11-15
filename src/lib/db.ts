import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { Recipe, ParsedIngredient, InstructionStep, IngredientLibraryItem } from "./types";
import { getEditorialFoodImage } from "./curatedPhotos";

let dbInstance: Database.Database | null = null;

function isFileValidSqlite(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 1000000) return false; // LFS pointers are ~130 bytes
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    return header.toString("utf8", 0, 15) === "SQLite format 3";
  } catch {
    return false;
  }
}

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Potential candidate paths for pantrymuse.db
  const candidatePaths = [
    path.join("/tmp", "pantrymuse.db"),
    path.join(process.cwd(), "data", "pantrymuse.db"),
    path.join(__dirname, "..", "..", "data", "pantrymuse.db"),
    path.join(__dirname, "..", "data", "pantrymuse.db"),
  ];

  let resolvedDbPath: string | null = null;

  for (const candidate of candidatePaths) {
    if (isFileValidSqlite(candidate)) {
      resolvedDbPath = candidate;
      break;
    }
  }

  // If no valid SQLite file found on disk (e.g. fresh Vercel serverless Lambda container),
  // extract from data/pantrymuse.db.gz into /tmp/pantrymuse.db
  if (!resolvedDbPath) {
    const tmpPath = path.join("/tmp", "pantrymuse.db");

    // Double-check if another concurrent request already wrote /tmp/pantrymuse.db
    if (!isFileValidSqlite(tmpPath)) {
      const gzCandidates = [
        path.join(process.cwd(), "data", "pantrymuse.db.gz"),
        path.join(__dirname, "..", "..", "data", "pantrymuse.db.gz"),
        path.join(__dirname, "..", "data", "pantrymuse.db.gz"),
      ];

      let foundGz: string | null = null;
      for (const gzCandidate of gzCandidates) {
        if (fs.existsSync(gzCandidate)) {
          foundGz = gzCandidate;
          break;
        }
      }

      if (foundGz) {
        try {
          const compressed = fs.readFileSync(foundGz);
          const decompressed = zlib.gunzipSync(compressed);
          const atomicTmp = path.join(
            "/tmp",
            `pantrymuse_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`
          );
          fs.writeFileSync(atomicTmp, decompressed);
          fs.renameSync(atomicTmp, tmpPath);
        } catch (extractErr) {
          console.error("Failed to extract pantrymuse.db.gz to /tmp:", extractErr);
        }
      }
    }

    if (isFileValidSqlite(tmpPath)) {
      resolvedDbPath = tmpPath;
    }
  }

  if (!resolvedDbPath) {
    throw new Error(
      `Recipe database could not be loaded. Please ensure data/pantrymuse.db or data/pantrymuse.db.gz is present.`
    );
  }

  dbInstance = new Database(resolvedDbPath, { readonly: true, fileMustExist: true });
  try {
    dbInstance.pragma("query_only = ON");
  } catch {}
  try {
    dbInstance.pragma("cache_size = -32000"); // 32MB cache
  } catch {}

  return dbInstance;
}

export function formatRecipeRow(row: any): Recipe {
  let ingredients: ParsedIngredient[] = [];
  try {
    ingredients = JSON.parse(row.ingredients_json || "[]");
  } catch {
    ingredients = (row.ingredients_raw || "")
      .split(";")
      .map((s: string) => ({
        raw: s.trim(),
        name: s.trim(),
        clean_name: s.trim().toLowerCase(),
        quantity: 1,
        unit: "",
      }));
  }

  let instructions: InstructionStep[] = [];
  try {
    instructions = JSON.parse(row.instructions_json || "[]");
  } catch {
    instructions = (row.directions_text || "")
      .split("\n")
      .filter((s: string) => s.trim().length > 0)
      .map((text: string, idx: number) => ({
        step: idx + 1,
        title: `Step ${idx + 1}`,
        instruction: text.trim(),
      }));
  }

  let nutrition = undefined;
  try {
    nutrition = JSON.parse(row.nutrition_json || "{}");
  } catch {
    nutrition = undefined;
  }

  let equipment: string[] = ["Chef knife", "Cutting board"];
  try {
    equipment = JSON.parse(row.equipment_json || "[]");
  } catch {}

  let tips: string[] = [];
  try {
    tips = JSON.parse(row.chefs_tips_json || "[]");
  } catch {}

  const fallbackImg = getEditorialFoodImage(row.title, row.category, row.cuisine, row.image_url);

  // Generate substitutions, common mistakes, storage & reheating suggestions for rich recipe detail experience
  const substitutions = [
    { original: "Butter", substitute: "Olive oil or Ghee", note: "Use 1:1 ratio for sautéing or finishing." },
    { original: "Heavy Cream", substitute: "Coconut cream or Greek yogurt with milk", note: "Whisk smooth before adding." },
    { original: "All-purpose Flour", substitute: "Oat flour, Atta, or Gluten-Free 1:1 blend", note: "Adjust moisture slightly." }
  ];

  const commonMistakes = [
    "Overcrowding the skillet: causes food to steam rather than sear golden-brown.",
    "Skipping the resting time: juices escape if cut immediately off the heat.",
    "Not tasting before serving: a final pinch of salt or lemon squeeze elevates the entire dish."
  ];

  const allergenWarnings: string[] = [];
  if (row.ingredients_raw?.toLowerCase().includes("peanut")) allergenWarnings.push("Peanuts");
  if (row.ingredients_raw?.toLowerCase().includes("dairy") || row.ingredients_raw?.toLowerCase().includes("milk") || row.ingredients_raw?.toLowerCase().includes("cheese")) allergenWarnings.push("Dairy");
  if (row.ingredients_raw?.toLowerCase().includes("egg")) allergenWarnings.push("Eggs");
  if (!row.is_gluten_free) allergenWarnings.push("Gluten (Wheat)");

  return {
    id: row.id,
    slug: row.slug || `recipe-${row.id}`,
    title: row.title,
    description: row.description || "A delectable dish prepared with fresh ingredients and balanced aromatics.",
    category: row.category || "Main Dish",
    cuisine: row.cuisine || "International",
    prep_time_minutes: row.prep_time_minutes || 15,
    cook_time_minutes: row.cook_time_minutes || 20,
    total_time_minutes: row.total_time_minutes || (row.prep_time_minutes || 15) + (row.cook_time_minutes || 20),
    servings: row.servings || 4,
    yields: row.yields || `${row.servings || 4} servings`,
    rating: row.rating || 4.5,
    rating_count: row.rating_count || 120,
    review_count: row.review_count || 45,
    is_vegetarian: Boolean(row.is_vegetarian),
    is_vegan: Boolean(row.is_vegan),
    is_gluten_free: Boolean(row.is_gluten_free),
    meal_type: row.meal_type || "Dinner",
    difficulty: (row.difficulty as 'Easy' | 'Medium' | 'Advanced') || 'Medium',
    ingredients,
    instructions,
    nutrition,
    equipment,
    chefs_tips: tips.length > 0 ? tips : [
      "Prep all aromatic spices and chop vegetables before starting your heat source.",
      "Season lightly in layers throughout cooking rather than all at the end."
    ],
    image_url: row.image_url && row.image_url.startsWith("http") ? row.image_url : fallbackImg,
    source_url: row.source_url,
    author: row.author || "PantryMuse Kitchen",
    substitutions,
    common_mistakes: commonMistakes,
    storage_instructions: "Store in an airtight glass container in the refrigerator for up to 3 to 4 days.",
    reheating_instructions: "Reheat gently in a covered pan over low heat with a tablespoon of water, or microwave in 45-second intervals.",
    serving_suggestions: "Serve warm, accompanied by crusty bread, steamed fragrant rice, or a crisp seasonal green salad.",
    allergen_warnings: allergenWarnings
  };
}

export function isProhibitedText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const cleanAlc = lower
    .replace(/\b(?:kitchen\s+twine|butcher\s+twine|twine|ginger\s+ale)\b/gi, "");

  const cleanBeef = lower
    .replace(/\bbeefsteak\s+tomato(?:es)?\b/gi, "")
    .replace(/\b(?:vegan|vegetarian|meatless|plant-based)\s+beef\b/gi, "");

  const cleanSea = lower
    .replace(/\bscalloped\s+potatoes?\b/gi, "")
    .replace(/\bscalloped\s+corn\b/gi, "")
    .replace(/\bscalloped\s+cabbage\b/gi, "")
    .replace(/\buntuna\b/gi, "")
    .replace(/\bmusselman(?:'s)?\b/gi, "");

  if (/\b(beef|bovine|oxtail|ribeye|t-bone|filet\s+mignon|sirloin|brisket|tallow|suet|veal|bison)\b/i.test(cleanBeef)) {
    return true;
  }
  if (/\b(wine|wines|cooking\s+wine|beer|beers|root\s+beer|butterbeer|ale|ales|stout|stouts|lager|lagers|whiskey|whisky|bourbon|scotch|vodka|rum|tequila|gin|brandy|cognac|sake|mirin|liqueur|liqueurs|schnapps|cocktail|cocktails|mocktail|mocktails|margarita|martini|mojito|sangria|daiquiri|pina\s+colada|piña\s+colada|cosmopolitan|bloody\s+mary|champagne|prosecco|sherry|vermouth|marsala|hard\s+cider|alcohol|alcoholic|booze|liquor|liquors)\b/i.test(cleanAlc)) {
    return true;
  }
  if (/\b(fish|salmon|tuna|cod|halibut|trout|sardine|anchovy|anchovies|seafood|shrimp|prawn|crab|crabmeat|crabcake|crabcakes|krab|krabby|lobster|oyster|mussel|clam|scallop|squid|calamari|octopus|eel|flounder|walleye|grouper|perch|conch|turkey|duck|goose)\b/i.test(cleanSea)) {
    return true;
  }
  if (/\b(porn|blowjob|penis|vagina|sex|sexy|slut|nipple)\b/i.test(lower)) {
    return true;
  }
  return false;
}

export function getRecipeById(id: number | string): Recipe | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM recipes WHERE id = ? OR slug = ?").get(id, String(id)) as any;
  if (!row) return null;

  // Strict defense-in-depth safety check
  const allText = `${row.title} ${row.description || ""} ${row.category || ""} ${row.ingredients_raw || ""} ${row.directions_text || ""}`;
  if (isProhibitedText(allText)) {
    return null;
  }

  return formatRecipeRow(row);
}

export function searchIngredients(query: string, category?: string, limit: number = 40): IngredientLibraryItem[] {
  if (category === "Seafood") {
    return [];
  }

  const dbCategory = category === "Kitchen staples" ? "Pantry staples" : category;
  const db = getDatabase();
  const cleanQ = query.trim().toLowerCase();
  
  if (!cleanQ && !dbCategory) {
    const rows = db.prepare("SELECT * FROM ingredients_library ORDER BY recipe_count DESC LIMIT ?").all(limit);
    return rows
      .filter((r: any) => !isProhibitedText(r.name))
      .map((r: any) => ({
        name: r.name,
        category: r.category === "Pantry staples" ? "Kitchen staples" : r.category,
        synonyms: r.synonyms,
        recipe_count: r.recipe_count,
        is_indian: Boolean(r.is_indian),
        is_common: Boolean(r.is_common),
        default_unit: r.default_unit
      }));
  }

  if (dbCategory && !cleanQ) {
    const rows = db.prepare("SELECT * FROM ingredients_library WHERE category = ? ORDER BY recipe_count DESC LIMIT ?").all(dbCategory, limit);
    return rows
      .filter((r: any) => !isProhibitedText(r.name))
      .map((r: any) => ({
        name: r.name,
        category: r.category === "Pantry staples" ? "Kitchen staples" : r.category,
        synonyms: r.synonyms,
        recipe_count: r.recipe_count,
        is_indian: Boolean(r.is_indian),
        is_common: Boolean(r.is_common),
        default_unit: r.default_unit
      }));
  }

  const sql = `
    SELECT * FROM ingredients_library 
    WHERE (name LIKE ? OR synonyms LIKE ?)
    ${dbCategory ? "AND category = ?" : ""}
    ORDER BY 
      CASE WHEN name = ? THEN 1
           WHEN name LIKE ? THEN 2
           ELSE 3 END,
      recipe_count DESC
    LIMIT ?
  `;

  const params: any[] = [`%${cleanQ}%`, `%${cleanQ}%`];
  if (dbCategory) params.push(dbCategory);
  params.push(cleanQ, `${cleanQ}%`, limit);

  const rows = db.prepare(sql).all(...params);
  return rows
    .filter((r: any) => !isProhibitedText(r.name))
    .map((r: any) => ({
      name: r.name,
      category: r.category === "Pantry staples" ? "Kitchen staples" : r.category,
      synonyms: r.synonyms,
      recipe_count: r.recipe_count,
      is_indian: Boolean(r.is_indian),
      is_common: Boolean(r.is_common),
      default_unit: r.default_unit
    }));
}
