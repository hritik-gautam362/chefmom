"use client";

import { useState, useEffect } from "react";
import {
  Search,
  BookOpen,
  Filter,
  Flame,
  Clock,
  ChevronRight,
  SlidersHorizontal
} from "lucide-react";
import { Recipe } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";

const COLLECTIONS = [
  { id: "popular", label: "Popular Today", emoji: "⭐" },
  { id: "quick-15", label: "Quick 15-Minute Meals", emoji: "⚡" },
  { id: "indian", label: "Indian Favourites", emoji: "🍛" },
  { id: "vegetarian", label: "Vegetarian Delights", emoji: "🌱" },
  { id: "healthy", label: "Healthy Choices", emoji: "🥗" },
  { id: "breakfast", label: "Breakfast Ideas", emoji: "🥞" },
  { id: "comfort", label: "Comfort Food", emoji: "🍲" },
  { id: "dinner", label: "Dinner Inspiration", emoji: "🍽️" },
  { id: "snacks", label: "Snacks & Bites", emoji: "🥟" },
  { id: "desserts", label: "Desserts & Sweets", emoji: "🍰" },
  { id: "international", label: "World Cuisine", emoji: "🌍" },
  { id: "budget", label: "Budget-Friendly Meals", emoji: "🍚" },
];

const CUISINES = ["All", "Indian", "Italian", "Mexican", "Asian", "Mediterranean", "French", "American"];
const MEAL_TYPES = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];

export default function DiscoverPage() {
  const [activeCollection, setActiveCollection] = useState("popular");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [selectedMealType, setSelectedMealType] = useState("All");
  const [selectedDietary, setSelectedDietary] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Reset pagination on collection / filter change
    setOffset(0);
    loadRecipes(0, true);
  }, [activeCollection, selectedCuisine, selectedMealType, selectedDietary]);

  // Handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      loadRecipes(0, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRecipes = async (currentOffset: number, isReset: boolean = false) => {
    if (isReset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        collection: activeCollection,
        limit: "12",
        offset: String(currentOffset),
      });

      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (selectedCuisine !== "All") params.append("cuisine", selectedCuisine);
      if (selectedMealType !== "All") params.append("meal_type", selectedMealType);
      if (selectedDietary === "Vegetarian") params.append("dietary", "vegetarian");
      if (selectedDietary === "Vegan") params.append("dietary", "vegan");

      const res = await fetch(`/api/recipes/discover?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setRecipes((prev) => (isReset ? data.recipes : [...prev, ...data.recipes]));
        setTotalCount(data.total);
        setHasMore(data.hasMore);
        setOffset(currentOffset);
      }
    } catch (err) {
      console.error("Discover load error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextOffset = offset + 12;
    loadRecipes(nextOffset, false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-[#D5DED3] pb-6">
        <div className="flex items-center gap-2 text-accent">
          <Search className="h-5 w-5" />
          <span className="font-heading text-xs font-bold uppercase tracking-wider">Culinary Catalog</span>
        </div>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[#243B30] sm:text-4xl">
          Discover Dishes
        </h1>
        <p className="mt-1 text-sm text-[#69766C]">
          Browse 20,500+ authentic culinary creations curated by meal style, speed, and flavor profile.
        </p>
      </div>

      {/* Collection Category Scroll Bar */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {COLLECTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCollection(c.id)}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              activeCollection === c.id
                ? "bg-[#243B30] text-white shadow-editorial scale-105"
                : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
            }`}
          >
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-sans">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#69766C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dish by name or ingredient..."
            className="w-full rounded-2xl border border-[#D5DED3] bg-[#F5F7F1] py-2.5 pl-10 pr-4 text-sm text-[#243B30] placeholder:text-[#69766C] outline-none shadow-xs focus:border-[#243B30]"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-colors ${
            showFilters || selectedCuisine !== "All" || selectedMealType !== "All" || selectedDietary !== "All"
              ? "border-[#D96F50] bg-[#D96F50] text-white"
              : "border-[#D5DED3] bg-[#FAFAF6] text-[#243B30] hover:border-[#243B30]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filters</span>
          {(selectedCuisine !== "All" || selectedMealType !== "All" || selectedDietary !== "All") && (
            <span className="flex h-2 w-2 rounded-full bg-white" />
          )}
        </button>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="mt-4 rounded-3xl border border-[#D5DED3] bg-[#FAFAF6] p-5 shadow-editorial text-xs space-y-4">
          <div>
            <span className="font-heading font-bold text-[#243B30] uppercase block mb-1.5">Cuisine</span>
            <div className="flex flex-wrap gap-1.5">
              {CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCuisine(c)}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    selectedCuisine === c
                      ? "bg-[#243B30] text-white"
                      : "bg-[#F5F7F1] border border-[#D5DED3] text-[#243B30] hover:bg-[#E9EEE5]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-heading font-bold text-[#243B30] uppercase block mb-1.5">Meal Type</span>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMealType(m)}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    selectedMealType === m
                      ? "bg-[#243B30] text-white"
                      : "bg-[#F5F7F1] border border-[#D5DED3] text-[#243B30] hover:bg-[#E9EEE5]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-heading font-bold text-[#243B30] uppercase block mb-1.5">Dietary</span>
            <div className="flex flex-wrap gap-1.5">
              {["All", "Vegetarian", "Vegan"].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDietary(d)}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    selectedDietary === d
                      ? "bg-[#243B30] text-white"
                      : "bg-[#F5F7F1] border border-[#D5DED3] text-[#243B30] hover:bg-[#E9EEE5]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="mt-6 flex items-center justify-between text-xs text-muted font-medium">
        <span>
          Showing <strong>{recipes.length}</strong> of <strong>{totalCount.toLocaleString()}</strong> dishes
        </span>
      </div>

      {/* Recipes Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-80 animate-pulse rounded-2xl bg-cream-100 border border-secondary/40" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-secondary bg-white/40 p-16 text-center">
            <Search className="mx-auto h-12 w-12 text-secondary-dark/60" />
            <h3 className="mt-4 font-serif text-xl font-bold text-primary">No Dishes Found</h3>
            <p className="mt-2 text-xs text-muted max-w-sm mx-auto">
              Try adjusting your search query or reset the cuisine and dietary filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} showMatchDetails={false} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-2xl border-2 border-primary bg-white px-8 py-3 text-sm font-bold text-primary shadow-editorial transition-all hover:bg-primary hover:text-white"
                >
                  {loadingMore ? "Loading more dishes..." : "Load More Discoveries"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
