"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CookingPot,
  ArrowLeft,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Recipe, RecipePreferences, GenerationHistoryItem } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";
import { addGenerationHistory } from "@/lib/indexedDb";

export default function GenerateResultsPage() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Partial<RecipePreferences>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [batch, setBatch] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<string>("best-match");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load requested ingredients from sessionStorage
  useEffect(() => {
    let reqIngredients: string[] = ["potato", "onion", "tomato", "paneer"];
    let reqPrefs: any = {};

    try {
      const stored = sessionStorage.getItem("pm_active_request");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ingredients && parsed.ingredients.length > 0) {
          reqIngredients = parsed.ingredients;
        }
        if (parsed.preferences) {
          reqPrefs = parsed.preferences;
        }
      }
    } catch {}

    setIngredients(reqIngredients);
    setPreferences(reqPrefs);

    fetchRecipes(reqIngredients, reqPrefs, 0, []);
  }, []);

  const fetchRecipes = async (
    ingList: string[],
    prefList: any,
    batchNum: number,
    existingRecipes: Recipe[]
  ) => {
    if (batchNum === 0) setLoading(true);
    else setLoadingMore(true);
    setErrorMsg(null);

    const excludedIds = existingRecipes.map((r) => r.id);

    try {
      const res = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingList,
          preferences: prefList,
          excludedIds,
          batch: batchNum,
          limit: 6,
          includeAi: true,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to generate recipes.");
      }

      const newRecipes: Recipe[] = data.recipes || [];
      const updatedList = batchNum === 0 ? newRecipes : [...existingRecipes, ...newRecipes];

      setRecipes(updatedList);
      setTotalMatches(data.totalMatches || 0);
      setHasMore(data.hasMore);
      setBatch(batchNum);

      // Save each recipe into persistent Generation History
      const sessionId = `session-${Date.now()}`;
      for (const rec of newRecipes) {
        const historyItem: GenerationHistoryItem = {
          id: `hist-${Date.now()}-${rec.id}-${Math.random().toString(36).substr(2, 4)}`,
          session_id: sessionId,
          recipe_id: rec.id,
          recipe_name: rec.title,
          selected_ingredients: ingList,
          generated_at: new Date().toISOString(),
          cuisine: rec.cuisine,
          recipe_source: rec.is_ai_generated ? "ai" : "dataset",
          image_url: rec.image_url,
          recipe_data: rec,
        };
        await addGenerationHistory(historyItem);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate recipes.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleShowMore = () => {
    fetchRecipes(ingredients, preferences, batch + 1, recipes);
  };

  const handleRegenerateFresh = () => {
    // Regenerate: increments batch to rotate out previous results
    fetchRecipes(ingredients, preferences, batch + 1, []);
  };

  // Filter & sort results
  const sortedRecipes = [...recipes].sort((a, b) => {
    if (activeFilter === "best-match") {
      return (b.match_percentage || 0) - (a.match_percentage || 0);
    }
    if (activeFilter === "quickest") {
      return (a.total_time_minutes || 999) - (b.total_time_minutes || 999);
    }
    if (activeFilter === "fewest-missing") {
      return (a.missing_ingredients?.length || 0) - (b.missing_ingredients?.length || 0);
    }
    if (activeFilter === "highest-rated") {
      return (b.rating || 0) - (a.rating || 0);
    }
    return 0;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#D5DED3] pb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline mb-2 font-heading"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Modify Ingredients</span>
          </Link>
          <h1 className="font-heading text-3xl font-bold text-[#243B30] sm:text-4xl">
            Generated Recipe Studio
          </h1>
          <p className="mt-1 text-sm text-[#69766C]">
            Matching dishes crafted from:{" "}
            <span className="font-semibold text-[#243B30] capitalize">
              {ingredients.join(", ")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerateFresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#D5DED3] bg-[#FAFAF6] px-4 py-2 text-xs font-bold text-[#243B30] shadow-xs hover:border-[#243B30] transition-all active:scale-95"
            title="Discover different recipes from the same ingredients"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Shuffle Dishes</span>
          </button>
        </div>
      </div>

      {/* Filter and Count Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold text-[#69766C]">
          Showing <strong>{recipes.length}</strong> distinct recipes
          {totalMatches > 0 && ` (${totalMatches} candidates available)`}
        </span>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "best-match", label: "Best Match" },
            { id: "quickest", label: "Quickest Time" },
            { id: "fewest-missing", label: "Fewest Missing" },
            { id: "highest-rated", label: "Highest Rated" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeFilter === f.id
                  ? "bg-[#243B30] text-white shadow-xs"
                  : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-80 animate-pulse rounded-2xl border border-secondary/60 bg-cream-100"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {errorMsg && !loading && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
          <AlertCircle className="mx-auto h-8 w-8 text-accent" />
          <h3 className="mt-2 font-serif text-lg font-bold">Could not generate recipes</h3>
          <p className="mt-1 text-xs">{errorMsg}</p>
          <button
            onClick={() => fetchRecipes(ingredients, preferences, 0, [])}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recipe Cards Grid */}
      {!loading && !errorMsg && (
        <>
          {recipes.length === 0 ? (
            <div className="mt-12 rounded-3xl border border-dashed border-secondary bg-white/40 p-16 text-center">
              <CookingPot className="mx-auto h-12 w-12 text-secondary-dark" />
              <h3 className="mt-4 font-serif text-xl font-bold text-primary">No recipes matched</h3>
              <p className="mt-2 text-xs text-muted max-w-md mx-auto">
                Try selecting a broader combination of ingredients (e.g. adding onion, oil, rice, or spices) or clearing restrictive dietary filters.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-editorial hover:bg-primary-dark"
              >
                Change Ingredients
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedRecipes.map((recipe) => (
                <RecipeCard key={`${recipe.id}-${batch}`} recipe={recipe} />
              ))}
            </div>
          )}

          {/* Show More Button */}
          {hasMore && recipes.length > 0 && (
            <div className="mt-12 text-center">
              <button
                onClick={handleShowMore}
                disabled={loadingMore}
                className="rounded-2xl border-2 border-primary bg-white px-8 py-3 text-sm font-bold text-primary shadow-editorial transition-all hover:bg-primary hover:text-white active:scale-95"
              >
                {loadingMore ? "Finding More Distinct Dishes..." : "Show More Recipes"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
