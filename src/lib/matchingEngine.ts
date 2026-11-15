import { getDatabase, formatRecipeRow, isProhibitedText } from "./db";
import { Recipe, RecipePreferences } from "./types";

// Comprehensive synonym mapping
const SYNONYMS: Record<string, string[]> = {
  potato: ["potato", "potatoes", "aloo", "spud"],
  onion: ["onion", "onions", "pyaz", "red onion", "white onion", "shallot"],
  tomato: ["tomato", "tomatoes", "tamatar", "cherry tomato"],
  garlic: ["garlic", "lahsun", "garlic clove"],
  ginger: ["ginger", "adrak", "fresh ginger"],
  paneer: ["paneer", "cottage cheese"],
  chicken: ["chicken", "murgh", "chicken breast", "chicken thighs", "drumstick"],
  egg: ["egg", "eggs", "anda"],
  dal: ["dal", "lentil", "lentils", "toor dal", "moong dal", "chana dal", "masoor dal"],
  rice: ["rice", "chawal", "basmati rice", "white rice"],
  atta: ["atta", "wheat flour", "whole wheat flour", "gehu"],
  flour: ["flour", "all-purpose flour", "maida"],
  poha: ["poha", "flattened rice", "beaten rice"],
  besan: ["besan", "gram flour", "chickpea flour"],
  chickpeas: ["chickpeas", "chana", "garbanzo", "kabuli chana"],
  spinach: ["spinach", "palak"],
  cauliflower: ["cauliflower", "gobi", "phool gobi"],
  bell_pepper: ["bell pepper", "capsicum", "shimla mirch", "peppers", "green pepper"],
  green_chilli: ["green chilli", "green chili", "hari mirch", "jalapeno", "serrano", "chilli"],
  coriander: ["coriander", "cilantro", "dhania", "coriander leaves"],
  curry_leaves: ["curry leaves", "kadi patta"],
  mustard_seeds: ["mustard seeds", "rai", "sarson"],
  turmeric: ["turmeric", "haldi", "turmeric powder"],
  cumin: ["cumin", "jeera", "cumin seeds"],
  garam_masala: ["garam masala"],
  coconut: ["coconut", "nariyal", "coconut milk", "shredded coconut"],
  pasta: ["pasta", "spaghetti", "penne", "macaroni", "noodles", "linguine", "fettuccine"],
  cheese: ["cheese", "cheddar", "mozzarella", "parmesan", "feta"],
  milk: ["milk", "doodh"],
  butter: ["butter", "makhan"],
  yogurt: ["yogurt", "dahi", "curd"],
  mushroom: ["mushroom", "mushrooms", "button mushroom"],
  pork: ["pork", "bacon", "ham", "pancetta", "prosciutto"],
  mutton: ["mutton", "lamb", "goat", "chevon", "gosht"],
  pigeon: ["pigeon", "squab"],
  lemon: ["lemon", "lime", "nimbu"]
};

export function normalizeIngredient(raw: string): string[] {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const terms = new Set<string>();
  terms.add(clean);

  // Plural / singular checks
  if (clean.endsWith("es")) terms.add(clean.slice(0, -2));
  if (clean.endsWith("s")) terms.add(clean.slice(0, -1));

  for (const [key, list] of Object.entries(SYNONYMS)) {
    if (list.some(s => clean === s || clean.includes(s) || s.includes(clean))) {
      list.forEach(item => terms.add(item));
      terms.add(key.replace("_", " "));
    }
  }

  return Array.from(terms);
}

export interface MatchingOptions {
  ingredients: string[];
  preferences?: Partial<RecipePreferences>;
  excludedIds?: (number | string)[];
  limit?: number;
  batch?: number;
}

export function generateMatchingRecipes(options: MatchingOptions): { recipes: Recipe[]; totalMatches: number; hasMore: boolean } {
  const db = getDatabase();
  const { ingredients, preferences = {}, excludedIds = [], limit = 9, batch = 0 } = options;

  if (!ingredients || ingredients.length === 0) {
    return { recipes: [], totalMatches: 0, hasMore: false };
  }

  // 1. Expand all user ingredients using synonyms
  const allSearchTerms: string[] = [];
  const userOriginalMap = new Map<string, string>(); // mapped search term -> original user ingredient

  for (const orig of ingredients) {
    const expansions = normalizeIngredient(orig);
    for (const exp of expansions) {
      allSearchTerms.push(exp);
      userOriginalMap.set(exp, orig.trim().toLowerCase());
    }
  }

  const uniqueTerms = Array.from(new Set(allSearchTerms));
  if (uniqueTerms.length === 0) {
    return { recipes: [], totalMatches: 0, hasMore: false };
  }

  // 2. Build SQL conditions for preferences
  const whereClauses: string[] = [];
  const queryParams: any[] = [];

  if (preferences.dietary === "vegetarian") {
    whereClauses.push("r.is_vegetarian = 1");
  } else if (preferences.dietary === "vegan") {
    whereClauses.push("r.is_vegan = 1");
  } else if (preferences.dietary === "non-vegetarian") {
    whereClauses.push("r.is_vegetarian = 0");
  }

  if (preferences.cuisine && preferences.cuisine !== "all" && preferences.cuisine !== "Any") {
    whereClauses.push("r.cuisine LIKE ?");
    queryParams.push(`%${preferences.cuisine}%`);
  }

  if (preferences.meal_type && preferences.meal_type !== "all" && preferences.meal_type !== "Any") {
    whereClauses.push("r.meal_type = ?");
    queryParams.push(preferences.meal_type);
  }

  if (preferences.max_time_minutes && preferences.max_time_minutes > 0) {
    whereClauses.push("r.total_time_minutes <= ?");
    queryParams.push(preferences.max_time_minutes);
  }

  if (preferences.difficulty && preferences.difficulty !== "all" && preferences.difficulty !== "Any") {
    whereClauses.push("r.difficulty = ?");
    queryParams.push(preferences.difficulty);
  }

  // Allergies & excluded ingredients
  if (preferences.allergies && preferences.allergies.length > 0) {
    for (const allergy of preferences.allergies) {
      whereClauses.push("r.ingredient_keywords NOT LIKE ?");
      queryParams.push(`%${allergy.toLowerCase().trim()}%`);
    }
  }

  const prefWhere = whereClauses.length > 0 ? "AND " + whereClauses.join(" AND ") : "";

  // 3. Query candidate matches
  const placeholders = uniqueTerms.map(() => "?").join(",");
  const sql = `
    SELECT 
      r.*,
      count(DISTINCT ri.ingredient_clean) as match_count,
      group_concat(DISTINCT ri.ingredient_clean) as matched_tokens
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    WHERE ri.ingredient_clean IN (${placeholders})
    ${prefWhere}
    GROUP BY r.id
    ORDER BY match_count DESC, r.rating DESC, r.review_count DESC
    LIMIT 150;
  `;

  const allParams = [...uniqueTerms, ...queryParams];
  const rawRows = db.prepare(sql).all(...allParams);
  const candidateRows = rawRows.filter((r: any) => 
    !isProhibitedText(`${r.title} ${r.description || ""} ${r.category || ""} ${r.ingredients_raw || ""} ${r.directions_text || ""}`)
  );

  if (candidateRows.length === 0) {
    return { recipes: [], totalMatches: 0, hasMore: false };
  }

  // 4. Exclude previously shown IDs (Critical diversity mechanism)
  const excludedSet = new Set(excludedIds.map(id => String(id)));
  let pool = candidateRows.filter((r: any) => !excludedSet.has(String(r.id)));

  // If pool became exhausted by exclusion, gracefully recycle older candidates (excluding current batch)
  if (pool.length < limit) {
    pool = candidateRows;
  }

  // 5. Diversity Scoring & Rotation offset
  // When the user repeats the exact same ingredients or clicks "Show More", we rotate
  // using batch offset + category/cuisine interleaving
  const rotated = [...pool];
  
  // Sort with a diversity balance: alternate cuisines & meal types so we don't have 5 curries or 5 pastas in a row
  const seenCuisinesInBatch = new Set<string>();
  const seenCategoriesInBatch = new Set<string>();
  const balancedCandidates: any[] = [];
  const deferredCandidates: any[] = [];

  // Group by match count tiers
  for (const row of rotated as any[]) {
    const cuisine = row.cuisine || "Unknown";
    const category = row.category || "Unknown";
    if (!seenCuisinesInBatch.has(cuisine) || !seenCategoriesInBatch.has(category)) {
      balancedCandidates.push(row);
      seenCuisinesInBatch.add(cuisine);
      seenCategoriesInBatch.add(category);
    } else {
      deferredCandidates.push(row);
    }
  }

  const combinedDiverse = [...balancedCandidates, ...deferredCandidates];

  // Apply batch pagination offset
  const startIndex = (batch * limit) % Math.max(1, combinedDiverse.length);
  const slicedRows: any[] = [];
  for (let i = 0; i < limit && i < combinedDiverse.length; i++) {
    const idx = (startIndex + i) % combinedDiverse.length;
    // Prevent duplicate titles in same batch
    const candidate = combinedDiverse[idx];
    if (!slicedRows.some(r => r.title.toLowerCase() === candidate.title.toLowerCase())) {
      slicedRows.push(candidate);
    }
  }

  // 6. Enrich with match details (match %, missing ingredients, why recommended)
  const userIngredientsLower = ingredients.map(i => i.trim().toLowerCase());

  const results: Recipe[] = slicedRows.map((row: any) => {
    const formatted = formatRecipeRow(row);
    
    // Determine which user ingredients matched
    const matchedUserIngs = new Set<string>();
    const recipeIngCleanNames = formatted.ingredients.map(ing => ing.clean_name.toLowerCase());

    for (const uIng of userIngredientsLower) {
      const uExp = normalizeIngredient(uIng);
      if (recipeIngCleanNames.some(rIng => uExp.some(exp => rIng.includes(exp) || exp.includes(rIng)))) {
        matchedUserIngs.add(uIng);
      }
    }

    // Determine missing ingredients
    const missing: string[] = [];
    for (const rIng of formatted.ingredients) {
      const isMatched = Array.from(matchedUserIngs).some(uIng => {
        const uExp = normalizeIngredient(uIng);
        return uExp.some(exp => rIng.clean_name.includes(exp) || exp.includes(rIng.clean_name));
      });
      if (!isMatched && !rIng.optional && rIng.name) {
        missing.push(rIng.name);
      }
    }

    const matchedList = Array.from(matchedUserIngs);
    const matchCount = matchedList.length > 0 ? matchedList.length : row.match_count;
    const matchPct = Math.min(100, Math.max(20, Math.round((matchCount / Math.max(1, formatted.ingredients.length)) * 100)));

    formatted.match_percentage = matchPct;
    formatted.matched_ingredients = matchedList;
    formatted.missing_ingredients = missing;
    formatted.match_explanation = `Uses ${matchCount} of your ${ingredients.length} ingredients${matchedList.length > 0 ? ` (${matchedList.slice(0, 3).join(", ")})` : ""}.`;

    return formatted;
  });

  return {
    recipes: results,
    totalMatches: candidateRows.length,
    hasMore: pool.length > limit
  };
}
