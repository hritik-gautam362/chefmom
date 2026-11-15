"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  X,
  Clock,
  SlidersHorizontal,
  CookingPot,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
} from "lucide-react";
import { IngredientLibraryItem, RecipePreferences } from "@/lib/types";

const CATEGORIES = [
  "Vegetables",
  "Dairy",
  "Grains and cereals",
  "Spices and herbs",
  "Legumes",
  "Meat and poultry",
  "Fruits",
  "Nuts and seeds",
  "Kitchen staples",
];

const CUISINES = ["Any", "Indian", "Italian", "Mexican", "Asian", "Mediterranean", "American", "French"];
const MEAL_TYPES = ["Any", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const ALLERGIES_LIST = ["Peanuts", "Dairy", "Gluten", "Shellfish", "Soy", "Eggs", "Tree nuts"];

export default function IngredientSelector() {
  const router = useRouter();

  // Selected ingredients state
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Vegetables");
  const [categoryItems, setCategoryItems] = useState<IngredientLibraryItem[]>([]);
  const [searchResults, setSearchResults] = useState<IngredientLibraryItem[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Advanced preferences
  const [preferences, setPreferences] = useState<RecipePreferences>({
    dietary: "all",
    cuisine: "Any",
    meal_type: "Any",
    max_time_minutes: 0,
    difficulty: "Any",
    servings: 4,
    allergies: [],
    max_additional_ingredients: 5,
  });

  // Load recently used items on mount
  useEffect(() => {
    try {
      const rec = localStorage.getItem("pm_recent_ingredients");
      if (rec) {
        setRecentlyUsed(JSON.parse(rec));
      }
    } catch {}
  }, []);

  // Fetch ingredients for active category
  useEffect(() => {
    let isCurrent = true;
    setLoadingCategory(true);
    fetch(`/api/ingredients/search?category=${encodeURIComponent(activeCategory)}&limit=30`)
      .then((res) => res.json())
      .then((data) => {
        if (isCurrent && data.success) {
          setCategoryItems(data.ingredients);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setLoadingCategory(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeCategory]);

  // Live autocomplete search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/ingredients/search?q=${encodeURIComponent(query.trim())}&limit=15`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSearchResults(data.ingredients);
          }
        })
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const addIngredient = (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || selected.includes(trimmed)) return;

    const updated = [...selected, trimmed];
    setSelected(updated);
    setQuery("");
    setSearchResults([]);

    // Save to recently used
    const newRecent = [trimmed, ...recentlyUsed.filter((r) => r !== trimmed)].slice(0, 10);
    setRecentlyUsed(newRecent);
    try {
      localStorage.setItem("pm_recent_ingredients", JSON.stringify(newRecent));
    } catch {}
  };

  const removeIngredient = (name: string) => {
    setSelected(selected.filter((i) => i !== name));
  };

  const handleCustomAdd = () => {
    if (query.trim()) {
      addIngredient(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomAdd();
    }
  };

  const clearAll = () => {
    setSelected([]);
  };

  const handleCreateRecipes = () => {
    if (selected.length === 0) return;
    setIsGenerating(true);

    const queryData = {
      ingredients: selected,
      preferences,
    };

    // Store in sessionStorage for fast pickup by Generate page
    sessionStorage.setItem("pm_active_request", JSON.stringify(queryData));
    router.push("/generate");
  };

  const toggleAllergy = (allergy: string) => {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter((a) => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  };

  return (
    <div className="w-full font-sans">
      {/* 1. Prominent Search Input Box */}
      <div className="relative">
        <div className="relative flex items-center min-h-[52px] rounded-2xl border-2 border-[#D5DED3] bg-[#F5F7F1] px-3.5 py-2 shadow-xs transition-all focus-within:border-[#243B30] focus-within:bg-[#FAFAF6]">
          <Search className="h-5 w-5 text-[#243B30]/70 mr-2.5 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an ingredient (e.g. paneer, potato, chicken, dal)..."
            className="flex-1 bg-transparent text-sm sm:text-base text-[#243B30] placeholder:text-[#69766C] outline-none font-sans"
          />
          {query.trim() && (
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => setQuery("")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#69766C] hover:bg-[#E9EEE5] hover:text-[#243B30] transition-colors"
                aria-label="Clear search input"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCustomAdd}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#D96F50] hover:bg-[#C55E40] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-transform hover:scale-105 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#D5DED3] bg-[#FAFAF6] p-2 shadow-editorial-lg">
            {searchResults.map((item) => (
              <button
                key={item.name}
                onClick={() => addIngredient(item.name)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#F5F7F1]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#243B30] capitalize">{item.name}</span>
                  {item.is_indian && (
                    <span className="rounded bg-[#D96F50]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#D96F50]">
                      Indian
                    </span>
                  )}
                  {item.synonyms && (
                    <span className="text-xs text-[#69766C]">({item.synonyms.split(",")[0]})</span>
                  )}
                </div>
                <span className="text-xs font-medium text-[#69766C]">{item.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Selected Ingredients Tray - Visually Distinct & Calm */}
      <div className="mt-4 min-h-[64px] rounded-2xl border border-[#D5DED3] bg-[#F5F7F1]/80 p-4 sm:p-5 transition-colors">
        {selected.length === 0 ? (
          <div className="flex items-center justify-between text-xs sm:text-sm text-[#69766C] py-1 font-medium">
            <span>No ingredients selected yet. Type above or tap items from the library below.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs font-bold tracking-wider text-[#243B30] uppercase flex items-center gap-1.5">
                <CookingPot className="h-4 w-4" />
                Selected Ingredients ({selected.length})
              </span>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 min-h-[36px] px-2.5 py-1 text-xs font-semibold text-[#69766C] hover:text-[#D96F50] rounded-lg transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map((ing) => (
                <span
                  key={ing}
                  className="group inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-[#FAFAF6] border border-[#D5DED3] px-3.5 py-1.5 text-sm font-semibold text-[#243B30] shadow-xs transition-all hover:border-[#D96F50]"
                >
                  <span className="capitalize">{ing}</span>
                  <button
                    onClick={() => removeIngredient(ing)}
                    aria-label={`Remove ${ing}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[#69766C] transition-colors hover:bg-[#D96F50] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Quick shortcuts: Recently Used */}
      {recentlyUsed.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#69766C] flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" /> Recent:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {recentlyUsed.slice(0, 5).map((ing) => (
              <button
                key={ing}
                onClick={() => addIngredient(ing)}
                disabled={selected.includes(ing)}
                className={`min-h-[32px] rounded-lg px-2.5 py-1 text-xs font-medium transition-colors capitalize ${
                  selected.includes(ing)
                    ? "bg-[#D5DED3]/50 text-[#69766C] cursor-default"
                    : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:border-[#243B30] hover:text-[#243B30]"
                }`}
              >
                + {ing}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Horizontally Scrollable Category Tabs */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-[#243B30]">Browse Library</h3>
          <span className="text-xs text-[#69766C] font-medium">Tap any item to add</span>
        </div>

        {/* Categories scrollable pill bar */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 min-h-[40px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                activeCategory === cat
                  ? "bg-[#243B30] text-white shadow-xs"
                  : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30]/80 hover:bg-[#F5F7F1]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Category Items Grid - Comfortable, readable chips */}
        <div className="mt-3 min-h-[140px] rounded-2xl border border-[#D5DED3] bg-[#FAFAF6]/70 p-4">
          {loadingCategory ? (
            <div className="flex h-24 items-center justify-center text-xs text-[#69766C]">
              Loading ingredients...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categoryItems.map((item) => {
                const isSelected = selected.includes(item.name.toLowerCase());
                return (
                  <button
                    key={item.name}
                    onClick={() =>
                      isSelected ? removeIngredient(item.name.toLowerCase()) : addIngredient(item.name)
                    }
                    className={`flex items-center gap-1.5 min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                      isSelected
                        ? "bg-[#243B30] text-white shadow-xs font-bold ring-1 ring-[#243B30]"
                        : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:border-[#243B30]/50 hover:bg-[#F5F7F1]"
                    }`}
                  >
                    <span className="capitalize">{item.name}</span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-[#F8DDD4]" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-[#69766C]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Advanced Preferences (Compact Expandable) */}
      <div className="mt-6 rounded-2xl border border-[#D5DED3] bg-[#FAFAF6]/70 p-4 transition-all">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex min-h-[44px] w-full items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#D96F50]" />
            <span className="font-heading text-sm font-bold text-[#243B30]">
              Cooking Preferences & Dietary Needs
            </span>
            {(preferences.dietary !== "all" || preferences.cuisine !== "Any" || preferences.allergies.length > 0) && (
              <span className="rounded-full bg-[#D96F50]/15 px-2 py-0.5 text-[10px] font-bold text-[#D96F50]">
                Customized
              </span>
            )}
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-[#69766C]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#69766C]" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-4 border-t border-[#D5DED3] text-xs">
            {/* Dietary */}
            <div>
              <label className="font-bold text-[#243B30] block mb-2 font-heading">Dietary Type</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "Any" },
                  { id: "vegetarian", label: "Vegetarian 🌱" },
                  { id: "vegan", label: "Vegan 🌿" },
                  { id: "non-vegetarian", label: "Meat & Poultry 🍗" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setPreferences({ ...preferences, dietary: d.id as any })}
                    className={`min-h-[36px] rounded-lg px-3 py-1 font-semibold transition-colors ${
                      preferences.dietary === d.id
                        ? "bg-[#243B30] text-white"
                        : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuisine */}
            <div>
              <label className="font-bold text-[#243B30] block mb-2 font-heading">Cuisine Style</label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPreferences({ ...preferences, cuisine: c })}
                    className={`min-h-[36px] rounded-lg px-3 py-1 font-semibold transition-colors ${
                      preferences.cuisine === c
                        ? "bg-[#243B30] text-white"
                        : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Type & Cooking Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-[#243B30] block mb-2 font-heading">Meal Type</label>
                <div className="flex flex-wrap gap-2">
                  {MEAL_TYPES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setPreferences({ ...preferences, meal_type: m })}
                      className={`min-h-[36px] rounded-lg px-3 py-1 font-semibold transition-colors ${
                        preferences.meal_type === m
                          ? "bg-[#243B30] text-white"
                          : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[#243B30] block mb-2 font-heading">
                  Max Cooking Time: {preferences.max_time_minutes > 0 ? `${preferences.max_time_minutes} mins` : "Any Time"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Any", val: 0 },
                    { label: "15m", val: 15 },
                    { label: "30m", val: 30 },
                    { label: "45m", val: 45 },
                    { label: "60m", val: 60 },
                  ].map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setPreferences({ ...preferences, max_time_minutes: t.val })}
                      className={`min-h-[36px] rounded-lg px-3 py-1 font-semibold transition-colors ${
                        preferences.max_time_minutes === t.val
                          ? "bg-[#243B30] text-white"
                          : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Allergies & Exclusions */}
            <div>
              <label className="font-bold text-[#243B30] block mb-2 font-heading">Allergies & Exclusions</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGIES_LIST.map((allergy) => {
                  const active = preferences.allergies.includes(allergy);
                  return (
                    <button
                      key={allergy}
                      onClick={() => toggleAllergy(allergy)}
                      className={`min-h-[36px] rounded-lg px-3 py-1 font-semibold transition-colors ${
                        active
                          ? "bg-[#D96F50] text-white"
                          : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                      }`}
                    >
                      {active ? `✕ Exclude ${allergy}` : allergy}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Main Prominent Action Button: Create Recipes */}
      <div className="mt-8">
        <button
          onClick={handleCreateRecipes}
          disabled={selected.length === 0 || isGenerating}
          className={`w-full group flex items-center justify-center gap-3 min-h-[54px] rounded-2xl py-3.5 px-6 text-base sm:text-lg font-heading font-bold shadow-editorial-lg transition-all ${
            selected.length === 0
              ? "bg-[#D5DED3] text-[#69766C] cursor-not-allowed"
              : "bg-[#243B30] text-white hover:bg-[#1A2E25] hover:scale-[1.005] active:scale-[0.995]"
          }`}
        >
          <CookingPot className={`h-5 w-5 shrink-0 ${selected.length > 0 ? "text-[#F8DDD4]" : "text-[#69766C]"}`} />
          <span>
            {isGenerating
              ? "Cooking Up Recipes..."
              : selected.length === 0
              ? "Select ingredients to begin"
              : `Create My Recipes (${selected.length} ingredient${selected.length > 1 ? "s" : ""})`}
          </span>
        </button>
      </div>
    </div>
  );
}
