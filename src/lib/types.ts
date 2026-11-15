export interface ParsedIngredient {
  raw: string;
  name: string;
  clean_name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
}

export interface InstructionStep {
  step: number;
  title: string;
  instruction: string;
  time_minutes?: number;
}

export interface RecipeNutrition {
  calories?: number | null;
  carbohydrates_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  dietary_fiber_g?: number | null;
  sodium_mg?: number | null;
}

export interface SubstitutionItem {
  original: string;
  substitute: string;
  note: string;
}

export interface Recipe {
  id: number | string;
  slug: string;
  title: string;
  description: string;
  category: string;
  cuisine: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  servings: number;
  yields?: string;
  rating: number;
  rating_count: number;
  review_count?: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  meal_type: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  ingredients: ParsedIngredient[];
  instructions: InstructionStep[];
  nutrition?: RecipeNutrition;
  equipment: string[];
  chefs_tips: string[];
  image_url: string;
  source_url?: string;
  author?: string;
  // Matching metadata
  is_ai_generated?: boolean;
  is_ai_adaptation?: boolean;
  match_percentage?: number;
  matched_ingredients?: string[];
  missing_ingredients?: string[];
  match_explanation?: string;
  // Deep cooking details
  substitutions?: SubstitutionItem[];
  common_mistakes?: string[];
  storage_instructions?: string;
  reheating_instructions?: string;
  serving_suggestions?: string;
  allergen_warnings?: string[];
}

export interface IngredientLibraryItem {
  name: string;
  category: string;
  synonyms?: string;
  recipe_count?: number;
  is_indian?: boolean;
  is_common?: boolean;
  default_unit?: string;
}

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date?: string;
  is_frequently_available: boolean;
  added_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  recipe_id?: number | string;
  recipe_title?: string;
  purchased: boolean;
  added_at: string;
}

export interface GenerationHistoryItem {
  id: string;
  session_id: string;
  recipe_id: number | string;
  recipe_name: string;
  selected_ingredients: string[];
  generated_at: string;
  cuisine: string;
  recipe_source: 'dataset' | 'ai' | 'ai_adaptation';
  image_url: string;
  recipe_data: Recipe;
}

export interface RecipePreferences {
  dietary: 'all' | 'vegetarian' | 'vegan' | 'non-vegetarian';
  cuisine: string;
  meal_type: string;
  max_time_minutes: number;
  difficulty: string;
  servings: number;
  allergies: string[];
  max_additional_ingredients: number;
}
