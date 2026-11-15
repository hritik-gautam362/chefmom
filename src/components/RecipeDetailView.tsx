"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  Users,
  ChefHat,
  Heart,
  Share2,
  Play,
  ShoppingCart,
  Check,
  AlertTriangle,
  Lightbulb,
  CookingPot,
  Flame,
  Info,
  Timer as TimerIcon,
  RotateCcw,
  ArrowLeft
} from "lucide-react";
import { Recipe, ParsedIngredient, ShoppingItem } from "@/lib/types";
import { isRecipeSaved, saveRecipe, removeSavedRecipe, saveShoppingItem } from "@/lib/indexedDb";
import GlassIcon from "@/components/GlassIcon";
import { getEditorialFoodImage } from "@/lib/curatedPhotos";
import CookingModeModal from "./CookingModeModal";

interface RecipeDetailViewProps {
  recipe: Recipe;
}

export default function RecipeDetailView({ recipe }: RecipeDetailViewProps) {
  const [servings, setServings] = useState<number>(recipe.servings || 4);
  const [saved, setSaved] = useState<boolean>(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [cookingModeOpen, setCookingModeOpen] = useState<boolean>(false);
  const [addedToCartToast, setAddedToCartToast] = useState<string | null>(null);
  const [activeTimerStep, setActiveTimerStep] = useState<number | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  const fallbackImage = getEditorialFoodImage(recipe.title, recipe.category, recipe.cuisine);
  const [imgSrc, setImgSrc] = useState<string>(recipe.image_url || fallbackImage);

  // Scaling factor for ingredient quantities
  const baseServings = recipe.servings || 4;
  const scale = servings / baseServings;

  useEffect(() => {
    isRecipeSaved(recipe.id).then(setSaved);
  }, [recipe.id]);

  // Step timer tick
  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timerSecondsLeft > 0) {
      interval = setInterval(() => {
        setTimerSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerSecondsLeft === 0 && timerRunning) {
      setTimerRunning(false);
      alert(`Timer for Step ${activeTimerStep} completed!`);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSecondsLeft, activeTimerStep]);

  const startStepTimer = (stepNum: number, minutes: number) => {
    setActiveTimerStep(stepNum);
    setTimerSecondsLeft(minutes * 60);
    setTimerRunning(true);
  };

  const handleSaveToggle = async () => {
    if (saved) {
      await removeSavedRecipe(recipe.id);
      setSaved(false);
    } else {
      await saveRecipe(recipe);
      setSaved(true);
    }
  };

  const toggleIngredientCheck = (idx: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAddAllMissingToShopping = async () => {
    const missing = recipe.missing_ingredients || [];
    if (missing.length === 0) {
      // Add all uncollected ingredients
      const itemsToAdd = recipe.ingredients.filter((_, idx) => !checkedIngredients[idx]);
      for (const ing of itemsToAdd) {
        const item: ShoppingItem = {
          id: `shop-${Date.now()}-${Math.random()}`,
          name: ing.name,
          quantity: Math.round(ing.quantity * scale * 10) / 10,
          unit: ing.unit,
          category: recipe.category,
          recipe_id: recipe.id,
          recipe_title: recipe.title,
          purchased: false,
          added_at: new Date().toISOString(),
        };
        await saveShoppingItem(item);
      }
      setAddedToCartToast(`Added ${itemsToAdd.length} items to your shopping list.`);
    } else {
      for (const mName of missing) {
        const matchedIng = recipe.ingredients.find((i) => i.name.toLowerCase().includes(mName.toLowerCase()));
        const item: ShoppingItem = {
          id: `shop-${Date.now()}-${Math.random()}`,
          name: mName,
          quantity: matchedIng ? Math.round(matchedIng.quantity * scale * 10) / 10 : 1,
          unit: matchedIng?.unit || "",
          category: recipe.category,
          recipe_id: recipe.id,
          recipe_title: recipe.title,
          purchased: false,
          added_at: new Date().toISOString(),
        };
        await saveShoppingItem(item);
      }
      setAddedToCartToast(`Added ${missing.length} missing ingredients to your shopping list.`);
    }

    setTimeout(() => setAddedToCartToast(null), 4000);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back button & top actions */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Kitchen</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToggle}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all shadow-xs active:scale-95 ${
              saved
                ? "border-accent/40 bg-accent/10 text-accent ring-2 ring-accent/20"
                : "border-secondary/80 bg-white/80 text-primary hover:border-primary/50"
            }`}
          >
            <GlassIcon
              icon={Heart}
              size="xs"
              isActive={saved}
              isFilled={saved}
              className="h-6 w-6"
              iconClassName={saved ? "text-accent fill-accent" : "text-[#242825]"}
            />
            <span>{saved ? "Saved" : "Save Recipe"}</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {addedToCartToast && (
        <div className="mb-6 flex items-center justify-between rounded-xl bg-primary p-4 text-sm font-semibold text-white shadow-editorial">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-accent" />
            <span>{addedToCartToast}</span>
          </div>
          <Link href="/saved" className="text-xs text-accent-light underline hover:text-white">
            View List &rarr;
          </Link>
        </div>
      )}

      {/* Main Recipe Header */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Large Food Photography */}
        <div className="lg:col-span-7">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-secondary/60 bg-cream-200 shadow-editorial-lg">
            <Image
              src={imgSrc}
              alt={recipe.title}
              fill
              priority
              className="object-cover"
              onError={() => setImgSrc(fallbackImage)}
            />
            {recipe.is_ai_generated && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-md">
                <CookingPot className="h-3.5 w-3.5" />
                Crafted Recipe
              </div>
            )}
          </div>
        </div>

        {/* Recipe Overview */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
              <span>{recipe.cuisine}</span>
              <span>•</span>
              <span>{recipe.category}</span>
              {recipe.is_vegetarian && (
                <>
                  <span>•</span>
                  <span className="text-emerald-700">Vegetarian 🌱</span>
                </>
              )}
            </div>

            <h1 className="mt-2 font-serif text-3xl font-extrabold text-primary sm:text-4xl leading-tight">
              {recipe.title}
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              {recipe.description || "An authentic dish crafted with balanced seasoning and comforting texture."}
            </p>

            {recipe.match_explanation && (
              <div className="mt-4 rounded-2xl bg-cream-100 border border-secondary/60 p-3.5 text-xs text-foreground">
                <span className="font-bold text-primary block mb-1">Ingredient Match:</span>
                <span>{recipe.match_explanation}</span>
              </div>
            )}
          </div>

          {/* Quick Cooking Action Button */}
          <div className="mt-6">
            <button
              onClick={() => setCookingModeOpen(true)}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-editorial transition-all hover:bg-accent-hover hover:scale-[1.01] active:scale-[0.99]"
            >
              <Play className="h-5 w-5 fill-white" />
              <span>Start Distraction-Free Cooking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Info Bar */}
      <div className="mt-8 grid grid-cols-2 gap-4 rounded-3xl border border-secondary/60 bg-white p-5 shadow-editorial sm:grid-cols-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase">Prep Time</span>
            <span className="font-serif text-base font-bold text-primary">
              {recipe.prep_time_minutes > 0 ? `${recipe.prep_time_minutes}m` : "15m"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-primary">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase">Cook Time</span>
            <span className="font-serif text-base font-bold text-primary">
              {recipe.cook_time_minutes > 0 ? `${recipe.cook_time_minutes}m` : "20m"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase">Total Time</span>
            <span className="font-serif text-base font-bold text-accent">
              {recipe.total_time_minutes > 0 ? `${recipe.total_time_minutes}m` : "35m"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-primary">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase">Difficulty</span>
            <span className="font-serif text-base font-bold text-primary">{recipe.difficulty}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-muted uppercase">Servings</span>
            <span className="font-serif text-base font-bold text-primary">{servings}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Ingredients (Left) and Step-by-Step Instructions (Right) */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Ingredients Column */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
            <div className="flex items-center justify-between border-b border-secondary/40 pb-4">
              <h2 className="font-serif text-xl font-bold text-primary">Ingredients</h2>
              {/* Servings Scaler */}
              <div className="flex items-center gap-2 rounded-full border border-secondary/80 bg-cream-50 px-2 py-1">
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-primary hover:bg-white"
                >
                  -
                </button>
                <span className="text-xs font-bold text-primary min-w-8 text-center">{servings} p</span>
                <button
                  onClick={() => setServings(servings + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-primary hover:bg-white"
                >
                  +
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted">
              Check off ingredients as you prepare them. Quantities adjust with serving size.
            </p>

            {/* Checklist */}
            <div className="mt-4 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {recipe.ingredients.map((ing, idx) => {
                const scaledQty = ing.quantity ? Math.round(ing.quantity * scale * 10) / 10 : null;
                const isChecked = Boolean(checkedIngredients[idx]);
                const isMissing = recipe.missing_ingredients?.some((m) =>
                  ing.clean_name.toLowerCase().includes(m.toLowerCase())
                );

                return (
                  <div
                    key={idx}
                    onClick={() => toggleIngredientCheck(idx)}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl p-2.5 transition-colors ${
                      isChecked
                        ? "bg-cream-100 text-muted line-through"
                        : isMissing
                        ? "bg-accent-light/50 border border-accent/20"
                        : "hover:bg-cream-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? "border-primary bg-primary text-white"
                          : "border-secondary bg-white"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex-1 text-sm">
                      <span className="font-semibold text-primary">
                        {scaledQty ? `${scaledQty} ` : ""}
                        {ing.unit ? `${ing.unit} ` : ""}
                      </span>
                      <span className={isChecked ? "text-muted" : "text-foreground font-medium"}>
                        {ing.name}
                      </span>
                      {ing.optional && <span className="ml-1 text-xs text-muted">(optional)</span>}
                      {isMissing && !isChecked && (
                        <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                          Missing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Missing to Shopping List */}
            <div className="mt-6 border-t border-secondary/40 pt-4">
              <button
                onClick={handleAddAllMissingToShopping}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-cream-100 px-4 py-3 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Add Missing Ingredients to Shopping List</span>
              </button>
            </div>

            {/* Equipment Required */}
            {recipe.equipment && recipe.equipment.length > 0 && (
              <div className="mt-6 border-t border-secondary/40 pt-4">
                <h4 className="font-serif text-sm font-semibold text-primary">Equipment Needed</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recipe.equipment.map((eq, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-cream-100 px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {eq}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step-by-Step Instructions Column */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-secondary/60 bg-white p-6 sm:p-8 shadow-editorial">
            <div className="flex items-center justify-between border-b border-secondary/40 pb-4">
              <h2 className="font-serif text-2xl font-bold text-primary">Step-by-Step Instructions</h2>
              <span className="text-xs font-semibold text-muted">
                {recipe.instructions.length} Steps
              </span>
            </div>

            {/* Active timer banner if running */}
            {timerRunning && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary p-4 text-white shadow-editorial">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white animate-pulse">
                    <TimerIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-secondary-light">
                      Step {activeTimerStep} Timer
                    </span>
                    <span className="font-serif text-xl font-bold block">{formatTimer(timerSecondsLeft)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setTimerRunning(false)}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Numbered Steps */}
            <div className="mt-6 space-y-6">
              {recipe.instructions.map((step) => {
                const stepNum = step.step;
                const paddedNum = stepNum < 10 ? `0${stepNum}` : `${stepNum}`;
                const hasTime = step.time_minutes && step.time_minutes > 0;

                return (
                  <div
                    key={stepNum}
                    className="relative rounded-2xl border border-secondary/40 bg-cream-50/50 p-5 transition-all hover:bg-cream-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs font-extrabold tracking-wider text-accent uppercase">
                        STEP {paddedNum} — {step.title}
                      </span>
                      {hasTime && (
                        <button
                          onClick={() => startStepTimer(stepNum, step.time_minutes!)}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          <TimerIcon className="h-3.5 w-3.5" />
                          <span>{step.time_minutes} min timer</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground font-medium">
                      {step.instruction}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deep Culinary Editorial Sections */}
          <div className="mt-8 space-y-6">
            {/* Chef's Tips */}
            {recipe.chefs_tips && recipe.chefs_tips.length > 0 && (
              <div className="rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  <h3 className="font-serif text-lg font-bold text-primary">Chef&apos;s Tips</h3>
                </div>
                <ul className="mt-3 space-y-2 text-xs text-foreground/80">
                  {recipe.chefs_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-accent font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Substitutions */}
            {recipe.substitutions && recipe.substitutions.length > 0 && (
              <div className="rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
                <h3 className="font-serif text-lg font-bold text-primary">Ingredient Substitutions</h3>
                <div className="mt-3 space-y-2.5">
                  {recipe.substitutions.map((sub, i) => (
                    <div key={i} className="rounded-xl bg-cream-50 p-3 text-xs">
                      <div className="flex items-center gap-2 font-bold text-primary">
                        <span>{sub.original}</span>
                        <span>&rarr;</span>
                        <span className="text-accent">{sub.substitute}</span>
                      </div>
                      <p className="mt-1 text-muted">{sub.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Storage & Reheating Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-secondary/60 bg-white p-5 text-xs shadow-editorial">
                <h4 className="font-serif font-bold text-primary mb-1">Storage</h4>
                <p className="text-muted leading-relaxed">
                  {recipe.storage_instructions || "Store in an airtight container refrigerated for 3 to 4 days."}
                </p>
              </div>
              <div className="rounded-2xl border border-secondary/60 bg-white p-5 text-xs shadow-editorial">
                <h4 className="font-serif font-bold text-primary mb-1">Reheating</h4>
                <p className="text-muted leading-relaxed">
                  {recipe.reheating_instructions || "Warm gently over medium-low heat with a splash of water."}
                </p>
              </div>
            </div>

            {/* Allergen & Nutrition */}
            <div className="rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
              <h3 className="font-serif text-lg font-bold text-primary mb-3">Nutrition & Allergen Info</h3>
              {recipe.allergen_warnings && recipe.allergen_warnings.length > 0 ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Contains or may contain: <strong>{recipe.allergen_warnings.join(", ")}</strong>
                  </span>
                </div>
              ) : (
                <div className="mb-4 text-xs text-muted">No common allergen triggers identified.</div>
              )}

              {recipe.nutrition && recipe.nutrition.calories ? (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase block mb-2">
                    Estimated Nutrition (per serving)
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Calories</span>
                      <span className="font-bold text-primary text-sm">{Math.round(recipe.nutrition.calories)}</span>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Protein</span>
                      <span className="font-bold text-primary text-sm">{recipe.nutrition.protein_g || 0}g</span>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Carbs</span>
                      <span className="font-bold text-primary text-sm">{recipe.nutrition.carbohydrates_g || 0}g</span>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Fat</span>
                      <span className="font-bold text-primary text-sm">{recipe.nutrition.fat_g || 0}g</span>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Fiber</span>
                      <span className="font-bold text-primary text-sm">{recipe.nutrition.dietary_fiber_g || 0}g</span>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2">
                      <span className="text-[10px] text-muted block">Sodium</span>
                      <span className="font-bold text-primary text-sm">{recipe.nutrition.sodium_mg || 0}mg</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">Nutrition values calculated when available from dataset.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cooking Mode Modal */}
      {cookingModeOpen && (
        <CookingModeModal
          recipe={recipe}
          servings={servings}
          onClose={() => setCookingModeOpen(false)}
        />
      )}
    </article>
  );
}
