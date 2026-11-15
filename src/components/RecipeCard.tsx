"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Users, Heart, Check, AlertCircle, ChefHat } from "lucide-react";
import { Recipe } from "@/lib/types";
import { isRecipeSaved, saveRecipe, removeSavedRecipe } from "@/lib/indexedDb";
import { getEditorialFoodImage } from "@/lib/curatedPhotos";

interface RecipeCardProps {
  recipe: Recipe;
  onSaveToggle?: (saved: boolean) => void;
  showMatchDetails?: boolean;
}

export default function RecipeCard({
  recipe,
  onSaveToggle,
  showMatchDetails = true,
}: RecipeCardProps) {
  const [saved, setSaved] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string>(
    recipe.image_url || getEditorialFoodImage(recipe.title, recipe.category, recipe.cuisine)
  );

  useEffect(() => {
    isRecipeSaved(recipe.id).then(setSaved);
  }, [recipe.id]);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (saved) {
      await removeSavedRecipe(recipe.id);
      setSaved(false);
      onSaveToggle?.(false);
    } else {
      await saveRecipe(recipe);
      setSaved(true);
      onSaveToggle?.(true);
    }
  };

  const fallbackImage = getEditorialFoodImage(recipe.title, recipe.category, recipe.cuisine);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[14px] border border-[#D5DED3] bg-[#FAFAF6] shadow-[0_2px_10px_rgba(36,59,48,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#243B30]/35 hover:shadow-[0_8px_22px_rgba(36,59,48,0.07)]">
      {/* 1. Food Photography Focus (Refined proportions & clipping) */}
      <Link
        href={`/recipe/${recipe.id}`}
        className="relative aspect-[16/11] w-full overflow-hidden bg-[#E9EEE5]"
      >
        <Image
          src={imgSrc}
          alt={recipe.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={() => setImgSrc(fallbackImage)}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

        {/* Top Controls: Subtle discreet match badge and refined heart button */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {/* Subtle Match % Badge (if applicable) */}
          <div className="pointer-events-auto">
            {recipe.match_percentage !== undefined && showMatchDetails ? (
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-sans font-semibold tracking-tight shadow-xs ${
                  recipe.match_percentage >= 80
                    ? "bg-[#243B30]/90 text-white backdrop-blur-xs"
                    : recipe.match_percentage >= 50
                    ? "bg-[#D96F50]/90 text-white backdrop-blur-xs"
                    : "bg-[#243B30]/80 text-white backdrop-blur-xs"
                }`}
              >
                {recipe.match_percentage}% Match
              </span>
            ) : null}
          </div>

          {/* Accessible 44px Touch Zone with Refined Circular Save Button */}
          <div className="pointer-events-auto flex items-center justify-center min-h-[44px] min-w-[44px] -m-1">
            <button
              onClick={handleSave}
              type="button"
              aria-label={saved ? "Remove from saved recipes" : "Save recipe"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-md shadow-xs border border-white/70 transition-transform active:scale-90 hover:scale-105 focus:outline-none"
            >
              <Heart
                className={`h-4.5 w-4.5 stroke-[1.8] transition-colors ${
                  saved
                    ? "fill-[#D96F50] text-[#D96F50]"
                    : "text-[#243B30] hover:text-[#D96F50]"
                }`}
              />
            </button>
          </div>
        </div>
      </Link>

      {/* 2. Editorial Typography & Content Hierarchy */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 font-sans">
        <div>
          {/* Metadata Row: Cuisine, Cooking Time, Vegetarian */}
          <div className="flex items-center gap-1.5 text-xs text-[#69766C] font-sans font-medium">
            <span className="font-semibold text-[#243B30]">{recipe.cuisine}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-[#69766C]" />
              {recipe.total_time_minutes > 0 ? `${recipe.total_time_minutes}m` : "25m"}
            </span>
            {recipe.is_vegetarian && (
              <>
                <span>•</span>
                <span className="text-[#243B30] font-medium">Vegetarian</span>
              </>
            )}
          </div>

          {/* Recipe Title: Classic Editorial Cormorant Garamond */}
          <Link href={`/recipe/${recipe.id}`} className="block mt-1.5">
            <h3 className="font-serif text-[21px] sm:text-[23px] font-semibold text-[#243B30] line-clamp-2 leading-[1.22] tracking-[-0.01em] transition-colors group-hover:text-[#D96F50]">
              {recipe.title}
            </h3>
          </Link>

          {/* Readable Description in DM Sans */}
          <p className="mt-2 text-xs sm:text-[13px] text-[#69766C] font-sans leading-relaxed line-clamp-2">
            {recipe.description || "A delicious recipe carefully crafted with balanced flavours."}
          </p>

          {/* Match Explanation & Missing Ingredients (if present) */}
          {showMatchDetails && recipe.match_explanation && (
            <div className="mt-3 rounded-lg bg-[#F5F7F1] border border-[#D5DED3] p-2.5 text-xs text-[#243B30] font-sans">
              <div className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#243B30]" />
                <span className="font-medium">{recipe.match_explanation}</span>
              </div>
              {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#69766C]">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#D96F50]" />
                  <span>
                    Needs: <strong className="text-[#243B30]">{recipe.missing_ingredients.slice(0, 3).join(", ")}</strong>
                    {recipe.missing_ingredients.length > 3 ? ` +${recipe.missing_ingredients.length - 3} more` : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Translucent Glass Card Footer */}
        <div className="mt-4 flex items-center justify-between rounded-xl sm:rounded-2xl border border-white/90 bg-white/70 px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-[0_2px_8px_rgba(36,59,48,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.95)] backdrop-blur-md transition-all duration-300 group-hover:border-white group-hover:bg-white/85 group-hover:shadow-[0_4px_12px_rgba(36,59,48,0.06),inset_0_1px_1.5px_rgba(255,255,255,1)]">
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#243B30]/80">
            <Users className="h-3.5 w-3.5 text-[#243B30]/70" />
            <span>{recipe.servings || 4} Servings</span>
          </div>
          <Link
            href={`/recipe/${recipe.id}`}
            className="group/cook flex shrink-0 items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-semibold text-[#D96F50] hover:text-[#C55E40] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#243B30] rounded-full"
            aria-label={`Cook ${recipe.title}`}
          >
            <span className="flex items-center gap-1 tracking-wide group-hover/cook:underline">
              <span>Cook Dish</span>
              <span aria-hidden="true">&rarr;</span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-7.5 w-7.5 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-[#243B30] text-white shadow-xs transition-all duration-200 group-hover/cook:scale-105 group-hover/cook:bg-[#1D3228] active:scale-95"
            >
              <ChefHat className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white stroke-[2.2]" />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
