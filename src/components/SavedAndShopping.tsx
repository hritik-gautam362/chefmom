"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  ShoppingCart,
  Search,
  Trash2,
  Check,
  Plus,
  ExternalLink,
  ChefHat
} from "lucide-react";
import GlassIcon from "@/components/GlassIcon";
import { Recipe, ShoppingItem } from "@/lib/types";
import {
  getSavedRecipes,
  removeSavedRecipe,
  getShoppingList,
  saveShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearPurchasedShoppingItems,
} from "@/lib/indexedDb";
import RecipeCard from "./RecipeCard";

export default function SavedAndShopping() {
  const [activeTab, setActiveTab] = useState<"recipes" | "shopping">("recipes");

  // Saved recipes state
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Shopping list state
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [newShopName, setNewShopName] = useState("");
  const [newShopCategory, setNewShopCategory] = useState("Kitchen staples");

  useEffect(() => {
    loadSaved();
    loadShopping();
  }, []);

  const loadSaved = async () => {
    const list = await getSavedRecipes();
    setSavedRecipes(list);
  };

  const loadShopping = async () => {
    const list = await getShoppingList();
    setShoppingItems(list);
  };

  const handleRemoveSaved = async (id: number | string) => {
    await removeSavedRecipe(id);
    loadSaved();
  };

  const handleAddShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    const item: ShoppingItem = {
      id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newShopName.trim().toLowerCase(),
      category: newShopCategory,
      purchased: false,
      added_at: new Date().toISOString(),
    };

    await saveShoppingItem(item);
    setNewShopName("");
    loadShopping();
  };

  const handleToggleShopItem = async (id: string) => {
    await toggleShoppingItem(id);
    loadShopping();
  };

  const handleDeleteShopItem = async (id: string) => {
    await removeShoppingItem(id);
    loadShopping();
  };

  const handleClearPurchased = async () => {
    await clearPurchasedShoppingItems();
    loadShopping();
  };

  const filteredSaved = savedRecipes.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group shopping items by category
  const groupedShopping: Record<string, ShoppingItem[]> = {};
  for (const item of shoppingItems) {
    const cat = item.category || "General";
    if (!groupedShopping[cat]) groupedShopping[cat] = [];
    groupedShopping[cat].push(item);
  }

  const purchasedCount = shoppingItems.filter((i) => i.purchased).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#D5DED3] pb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#243B30] sm:text-4xl">
            Saved & Shopping
          </h1>
          <p className="mt-1 text-sm text-[#69766C]">
            Manage your personal recipe book and grocery list in one place.
          </p>
        </div>

        {/* Tab switch pills */}
        <div className="flex rounded-2xl bg-[#FAFAF6] p-1 border border-[#D5DED3]">
          <button
            onClick={() => setActiveTab("recipes")}
            className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-bold transition-all ${
              activeTab === "recipes"
                ? "bg-[#243B30] text-white shadow-editorial"
                : "text-[#243B30]/70 hover:text-[#243B30]"
            }`}
          >
            <GlassIcon
              icon={Heart}
              size="xs"
              isActive={activeTab === "recipes"}
              isFilled={activeTab === "recipes"}
              className="h-6 w-6"
              iconClassName={activeTab === "recipes" ? "text-accent fill-accent" : "text-[#243B30]"}
            />
            <span>Saved Recipes ({savedRecipes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("shopping")}
            className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-bold transition-all ${
              activeTab === "shopping"
                ? "bg-[#243B30] text-white shadow-editorial"
                : "text-[#243B30]/70 hover:text-[#243B30]"
            }`}
          >
            <GlassIcon
              icon={ShoppingCart}
              size="xs"
              isActive={activeTab === "shopping"}
              className="h-6 w-6"
              iconClassName={activeTab === "shopping" ? "text-white" : "text-[#243B30]"}
            />
            <span>Shopping List ({shoppingItems.length})</span>
          </button>
        </div>
      </div>

      {/* --- TAB 1: SAVED RECIPES --- */}
      {activeTab === "recipes" && (
        <div className="mt-8">
          {/* Search bar for saved recipes */}
          {savedRecipes.length > 0 && (
            <div className="mb-6 flex max-w-md items-center rounded-2xl border border-[#D5DED3] bg-[#F5F7F1] px-3 py-1.5 shadow-sm">
              <GlassIcon icon={Search} size="xs" className="mr-2 shrink-0" iconClassName="text-[#243B30]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved dishes by name or cuisine..."
                className="flex-1 bg-transparent text-sm text-[#243B30] placeholder:text-[#69766C] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[#69766C] hover:text-[#243B30]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filteredSaved.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-secondary bg-white/40 p-16 text-center">
              <Heart className="mx-auto h-12 w-12 text-secondary-dark/60" />
              <h3 className="mt-4 font-serif text-xl font-bold text-primary">No saved recipes yet</h3>
              <p className="mt-2 text-xs text-muted max-w-sm mx-auto">
                Whenever you discover or generate recipes you like, click the heart icon to save them for easy cooking anytime.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/generate"
                  className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-editorial hover:bg-primary-dark transition-colors"
                >
                  Generate Recipes
                </Link>
                <Link
                  href="/discover"
                  className="rounded-full border border-primary/20 bg-white px-5 py-2.5 text-xs font-bold text-primary shadow-sm hover:border-primary transition-colors"
                >
                  Browse Discover
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSaved.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onSaveToggle={() => loadSaved()}
                  showMatchDetails={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: SHOPPING LIST --- */}
      {activeTab === "shopping" && (
        <div className="mt-8">
          {/* Quick Add Form */}
          <div className="rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
            <h3 className="font-serif text-lg font-bold text-primary">Add Custom Grocery Item</h3>
            <form onSubmit={handleAddShoppingItem} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                required
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="Item name (e.g. Garam Masala, Olive Oil, Paneer)"
                className="flex-1 rounded-xl border border-secondary/80 bg-cream-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              />
              <select
                value={newShopCategory}
                onChange={(e) => setNewShopCategory(e.target.value)}
                className="rounded-xl border border-secondary/80 bg-cream-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="Vegetables">Vegetables</option>
                <option value="Dairy">Dairy</option>
                <option value="Grains and cereals">Grains and cereals</option>
                <option value="Spices and herbs">Spices and herbs</option>
                <option value="Meat and poultry">Meat and poultry</option>
                <option value="Kitchen staples">Kitchen staples</option>
              </select>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-editorial hover:bg-primary-dark transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </form>
          </div>

          {/* List Operations & Summary */}
          {shoppingItems.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                {purchasedCount} of {shoppingItems.length} purchased
              </span>
              {purchasedCount > 0 && (
                <button
                  onClick={handleClearPurchased}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  Clear Completed ({purchasedCount})
                </button>
              )}
            </div>
          )}

          {/* Grouped Shopping Items */}
          <div className="mt-4 space-y-6">
            {shoppingItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-secondary bg-white/40 p-16 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-secondary-dark/60" />
                <h3 className="mt-4 font-serif text-xl font-bold text-primary">Your Shopping List is Empty</h3>
                <p className="mt-2 text-xs text-muted max-w-sm mx-auto">
                  When viewing recipe details, you can add all missing ingredients to this list with a single click.
                </p>
              </div>
            ) : (
              Object.entries(groupedShopping).map(([category, items]) => (
                <div key={category} className="rounded-3xl border border-secondary/60 bg-white p-6 shadow-editorial">
                  <h4 className="font-serif text-base font-bold text-primary border-b border-secondary/40 pb-2">
                    {category}
                  </h4>
                  <div className="mt-3 divide-y divide-secondary/30">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 transition-colors"
                      >
                        <div
                          onClick={() => handleToggleShopItem(item.id)}
                          className="flex flex-1 cursor-pointer items-center gap-3"
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                              item.purchased
                                ? "border-primary bg-primary text-white"
                                : "border-secondary bg-cream-50"
                            }`}
                          >
                            {item.purchased && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span
                              className={`text-sm font-medium capitalize ${
                                item.purchased ? "text-muted line-through" : "text-foreground"
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.quantity ? (
                              <span className="ml-2 text-xs font-bold text-accent">
                                ({item.quantity} {item.unit})
                              </span>
                            ) : null}
                            {item.recipe_title && (
                              <span className="ml-2 text-[11px] text-muted">
                                for {item.recipe_title}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteShopItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="rounded-full p-1.5 text-muted hover:bg-accent-light hover:text-accent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
