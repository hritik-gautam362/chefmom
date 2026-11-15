"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  History,
  Search,
  Trash2,
  Calendar,
  CookingPot,
  ExternalLink,
  RotateCcw,
  Clock
} from "lucide-react";
import { GenerationHistoryItem } from "@/lib/types";
import { getGenerationHistory, removeGenerationHistory, clearGenerationHistory } from "@/lib/indexedDb";
import RecipeCard from "@/components/RecipeCard";
import GlassIcon from "@/components/GlassIcon";

export default function ViewDishesPage() {
  const [historyItems, setHistoryItems] = useState<GenerationHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [visibleCount, setVisibleCount] = useState<number>(9);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const items = await getGenerationHistory();
      setHistoryItems(items);
    } catch {}
    setLoading(false);
  };

  const handleDeleteItem = async (id: string) => {
    await removeGenerationHistory(id);
    loadHistory();
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear your entire recipe generation history?")) {
      await clearGenerationHistory();
      loadHistory();
    }
  };

  // Unique cuisines in history
  const cuisines = Array.from(new Set(historyItems.map((h) => h.cuisine || "Unknown"))).filter(Boolean);

  const filteredHistory = historyItems.filter((item) => {
    const matchesSearch =
      item.recipe_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.selected_ingredients.some((i) => i.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCuisine = selectedCuisine === "All" || item.cuisine === selectedCuisine;
    return matchesSearch && matchesCuisine;
  });

  const visibleHistory = filteredHistory.slice(0, visibleCount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#D5DED3] pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-accent">
            <GlassIcon icon={History} size="xs" iconClassName="text-accent" />
            <span className="font-heading text-xs font-bold uppercase tracking-wider">Persistent History</span>
          </div>
          <h1 className="mt-1 font-heading text-3xl font-bold text-[#243B30] sm:text-4xl">
            View Dishes
          </h1>
          <p className="mt-1 text-sm text-[#69766C]">
            All the creative dishes you have generated, preserved across sessions.
          </p>
        </div>

        {historyItems.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-full border border-[#D5DED3] bg-[#FAFAF6] px-4 py-2 text-xs font-semibold text-[#69766C] hover:text-[#D96F50] hover:border-[#D96F50] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>

      {/* Controls & Filter Bar */}
      {historyItems.length > 0 && (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="flex flex-1 max-w-md items-center rounded-2xl border border-[#D5DED3] bg-[#F5F7F1] px-3 py-1.5 shadow-sm">
            <GlassIcon icon={Search} size="xs" className="mr-2 shrink-0" iconClassName="text-[#243B30]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search previous dishes or ingredients..."
              className="flex-1 bg-transparent text-sm text-[#243B30] placeholder:text-[#69766C] outline-none"
            />
          </div>

          {/* Cuisine Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {["All", ...cuisines].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCuisine(c)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedCuisine === c
                    ? "bg-[#243B30] text-white"
                    : "bg-[#FAFAF6] border border-[#D5DED3] text-[#243B30] hover:bg-[#F5F7F1]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Items Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-72 animate-pulse rounded-2xl bg-cream-100" />
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-secondary bg-white/40 p-16 text-center">
            <History className="mx-auto h-12 w-12 text-secondary-dark/60" />
            <h3 className="mt-4 font-serif text-xl font-bold text-primary">No Dish History Yet</h3>
            <p className="mt-2 text-xs text-muted max-w-sm mx-auto">
              Whenever you create recipes from your ingredients, your generated dishes will be saved here automatically.
            </p>
            <div className="mt-6">
              <Link
                href="/generate"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-editorial hover:bg-primary-dark transition-colors"
              >
                <CookingPot className="h-4 w-4 text-accent-subtle" />
                <span>Create Your First Dish</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleHistory.map((item) => (
                <div key={item.id} className="relative group">
                  <RecipeCard recipe={item.recipe_data} />
                  {/* Remove from history button */}
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label="Remove from history"
                    className="absolute top-2 right-14 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                    title="Remove from history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {visibleCount < filteredHistory.length && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 9)}
                  className="rounded-2xl border-2 border-primary bg-white px-8 py-3 text-sm font-bold text-primary shadow-editorial transition-all hover:bg-primary hover:text-white"
                >
                  Load More History ({filteredHistory.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
