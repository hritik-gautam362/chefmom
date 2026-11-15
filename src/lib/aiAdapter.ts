import { Recipe, ParsedIngredient, InstructionStep } from "./types";
import { getEditorialFoodImage } from "./curatedPhotos";

export interface AIGenerationRequest {
  ingredients: string[];
  dietary?: string;
  cuisine?: string;
  meal_type?: string;
  max_time_minutes?: number;
  servings?: number;
  allergies?: string[];
  style?: "original" | "adaptation";
  baseRecipeTitle?: string;
}

export interface AIGenerationResult {
  success: boolean;
  recipe?: Recipe;
  error?: string;
  isAiGenerated: boolean;
}

export async function generateRecipeWithAI(request: AIGenerationRequest): Promise<AIGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "AI Generation is currently unavailable (GEMINI_API_KEY is not configured in server environment). Use the dataset matching engine for thousands of curated dishes.",
      isAiGenerated: false
    };
  }

  const prompt = `You are a Michelin-calibre chef and recipe developer for PantryMuse (Warm Editorial Kitchen).
Create a realistic, delicious recipe that primarily highlights the following available ingredients:
Available Ingredients: ${request.ingredients.join(", ")}
Dietary preference: ${request.dietary || "None"}
Cuisine preference: ${request.cuisine || "Any"}
Meal category: ${request.meal_type || "Dinner"}
Target cooking time: ${request.max_time_minutes ? `${request.max_time_minutes} minutes maximum` : "Around 30-40 minutes"}
Target servings: ${request.servings || 4}
Allergies/Exclusions: ${request.allergies && request.allergies.length > 0 ? request.allergies.join(", ") : "None"}
${request.style === "adaptation" && request.baseRecipeTitle ? `Style: Creative adaptation of "${request.baseRecipeTitle}"` : "Style: Completely original culinary creation"}

MANDATORY SAFETY AND DIETARY RULES:
- NEVER use beef or any beef-derived ingredient (beef cuts, beef broth, beef stock, bovine gelatin, tallow, suet).
- NEVER use wine of any kind (red wine, white wine, cooking wine, rice wine, marsala, sherry, champagne).
- NEVER use alcohol, alcoholic beverages, beer, spirits, liqueurs, sake, mirin, or cocktails.
- NEVER include explicit sexual or suggestive content.
- ALLOWED animal proteins are strictly: Vegetarian dishes, Chicken, Mutton, Goat, Lamb, Pigeon/Squab, or Pork.
- Prohibit all other meats (veal, bison, venison, duck, turkey) and all seafood.

Respond with ONLY a valid, single JSON object adhering to this schema:
{
  "title": "String (engaging, culinary name)",
  "description": "String (editorial 2-3 sentence overview)",
  "category": "String (Main Dish, Appetizer, Soup, Salad, etc.)",
  "cuisine": "String",
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "total_time_minutes": number,
  "servings": number,
  "difficulty": "Easy" | "Medium" | "Advanced",
  "ingredients": [
    {
      "raw": "1 cup sliced onions",
      "name": "onion",
      "clean_name": "onion",
      "quantity": 1,
      "unit": "cup",
      "optional": false
    }
  ],
  "instructions": [
    {
      "step": 1,
      "title": "Prep Aromatics",
      "instruction": "Detailed clear instruction with sensory cue and heat level.",
      "time_minutes": 5
    }
  ],
  "nutrition": {
    "calories": 450,
    "protein_g": 22,
    "carbohydrates_g": 35,
    "fat_g": 18,
    "dietary_fiber_g": 6,
    "sodium_mg": 580
  },
  "equipment": ["Skillet", "Chef knife"],
  "chefs_tips": ["A professional culinary secret for this dish"],
  "substitutions": [
    { "original": "Ingredient", "substitute": "Alternative", "note": "Why and how" }
  ],
  "common_mistakes": ["A pitfall to avoid"],
  "storage_instructions": "Refrigerator storage details",
  "reheating_instructions": "Reheating advice",
  "allergen_warnings": ["Allergens present"]
}
Do not include markdown code block formatting if possible, return raw json.`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `AI API returned status ${response.status}: ${errText.slice(0, 100)}`,
        isAiGenerated: false
      };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return {
        success: false,
        error: "AI provider returned empty response.",
        isAiGenerated: false
      };
    }

    // Parse and validate
    let parsed: any;
    try {
      // Strip potential backticks if present
      const cleanJson = candidateText.replace(/^```json/m, "").replace(/^```/m, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      return {
        success: false,
        error: "Failed to parse structured JSON from AI provider.",
        isAiGenerated: false
      };
    }

    // Basic structure validation
    if (!parsed.title || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions)) {
      return {
        success: false,
        error: "AI response failed required recipe schema validation.",
        isAiGenerated: false
      };
    }

    // Strict safety & dietary policy validation (beef, alcohol, wine, cocktails, explicit, seafood)
    const allAiText = `${parsed.title} ${parsed.description || ""} ${parsed.ingredients.map((i: any) => i.raw || i.name).join(" ")} ${parsed.instructions.map((s: any) => s.instruction || "").join(" ")}`.toLowerCase();
    const hasBeef = /\b(beef|bovine|oxtail|ribeye|t-bone|filet\s+mignon|sirloin|brisket|tallow|suet|veal|bison)\b/i.test(
      allAiText.replace(/\bbeefsteak\s+tomato(?:es)?\b/gi, "")
    );
    const cleanAlcoholAiText = allAiText.replace(/\b(?:red\s+wine|white\s+wine|rice\s+wine|apple\s+cider|cider|wine)\s+vinegar\b/gi, "")
      .replace(/\b(?:pot|oyster|clam)\s+liquor\b/gi, "")
      .replace(/\b(?:root|ginger|birch)\s+beer\b/gi, "");
    const hasAlcohol = /\b(wine|beer|ale|stout|lager|whiskey|whisky|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|sake|mirin|liqueur|schnapps|cocktail|margarita|martini|mojito|champagne|prosecco|cider|hard\s+cider|alcohol|booze|liquor)\b/i.test(
      cleanAlcoholAiText
    );
    const hasExplicit = /\b(porn|blowjob|penis|vagina|sex|sexy|slut|nipple)\b/i.test(allAiText);
    const hasSeafood = /\b(fish|salmon|tuna|cod|halibut|trout|shrimp|prawn|crab|lobster|oyster|mussel|clam|scallop|squid|calamari|octopus|seafood)\b/i.test(allAiText);

    if (hasBeef || hasAlcohol || hasExplicit || hasSeafood) {
      return {
        success: false,
        error: "Generated recipe violates safety standards (beef, alcohol, disallowed protein, or explicit content detected).",
        isAiGenerated: false
      };
    }

    const isVeg = !parsed.ingredients.some((i: any) => 
      /chicken|beef|pork|mutton|fish|shrimp|prawn|meat|bacon|turkey/i.test(i.raw || i.name)
    );
    const isVegan = isVeg && !parsed.ingredients.some((i: any) => 
      /dairy|milk|cheese|butter|cream|egg|yogurt|ghee|honey/i.test(i.raw || i.name)
    );

    const recipeId = `ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const image_url = getEditorialFoodImage(parsed.title, parsed.category || "Main Dish", parsed.cuisine || "Chef Special");

    // Match calculation
    const userIngredientsLower = request.ingredients.map(i => i.trim().toLowerCase());
    const matchedList: string[] = [];
    for (const uIng of userIngredientsLower) {
      if (parsed.ingredients.some((r: any) => (r.name || r.raw || "").toLowerCase().includes(uIng))) {
        matchedList.push(uIng);
      }
    }

    const recipe: Recipe = {
      id: recipeId,
      slug: `ai-${parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: parsed.title,
      description: parsed.description || "An exclusive custom recipe created just for your selected kitchen ingredients.",
      category: parsed.category || "Main Dish",
      cuisine: parsed.cuisine || (request.cuisine || "Fusion"),
      prep_time_minutes: parsed.prep_time_minutes || 15,
      cook_time_minutes: parsed.cook_time_minutes || 25,
      total_time_minutes: parsed.total_time_minutes || (parsed.prep_time_minutes || 15) + (parsed.cook_time_minutes || 25),
      servings: parsed.servings || request.servings || 4,
      yields: `${parsed.servings || request.servings || 4} servings`,
      rating: 4.9,
      rating_count: 1,
      is_vegetarian: isVeg,
      is_vegan: isVegan,
      is_gluten_free: !parsed.ingredients.some((i: any) => /wheat|flour|bread|pasta/i.test(i.raw || i.name)),
      meal_type: parsed.category || request.meal_type || "Dinner",
      difficulty: parsed.difficulty || "Medium",
      ingredients: parsed.ingredients.map((ing: any) => ({
        raw: ing.raw || `${ing.quantity || 1} ${ing.unit || ""} ${ing.name}`,
        name: ing.name,
        clean_name: (ing.clean_name || ing.name).toLowerCase(),
        quantity: typeof ing.quantity === "number" ? ing.quantity : 1,
        unit: ing.unit || "",
        optional: Boolean(ing.optional)
      })),
      instructions: parsed.instructions.map((ins: any, idx: number) => ({
        step: ins.step || idx + 1,
        title: ins.title || `Step ${idx + 1}`,
        instruction: ins.instruction || String(ins),
        time_minutes: ins.time_minutes || 0
      })),
      nutrition: parsed.nutrition,
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : ["Chef knife", "Cutting board", "Pan"],
      chefs_tips: Array.isArray(parsed.chefs_tips) ? parsed.chefs_tips : ["Season with care and taste periodically as flavors develop."],
      image_url,
      author: "PantryMuse AI Culinary Engine",
      is_ai_generated: true,
      is_ai_adaptation: request.style === "adaptation",
      match_percentage: Math.min(100, Math.round((matchedList.length / Math.max(1, userIngredientsLower.length)) * 100)),
      matched_ingredients: matchedList,
      missing_ingredients: parsed.ingredients
        .filter((i: any) => !matchedList.some(m => (i.name || "").toLowerCase().includes(m)))
        .map((i: any) => i.name),
      match_explanation: `AI-crafted dish designed specifically around your ${matchedList.join(", ")}.`,
      substitutions: parsed.substitutions || [],
      common_mistakes: parsed.common_mistakes || ["Avoid high flame which can scorch aromatics prematurely."],
      storage_instructions: parsed.storage_instructions || "Store in airtight container in fridge for up to 3 days.",
      reheating_instructions: parsed.reheating_instructions || "Reheat gently in skillet or oven until thoroughly heated.",
      allergen_warnings: parsed.allergen_warnings || []
    };

    return {
      success: true,
      recipe,
      isAiGenerated: true
    };
  } catch (err: any) {
    return {
      success: false,
      error: `AI provider error: ${err.message || String(err)}`,
      isAiGenerated: false
    };
  }
}
