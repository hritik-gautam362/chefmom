import { Recipe, PantryItem, ShoppingItem, GenerationHistoryItem } from "./types";

const DB_NAME = "PantryMuseDB";
const DB_VERSION = 3;

interface DBSchema {
  saved_recipes: Recipe;
  generation_history: GenerationHistoryItem;
  pantry_items: PantryItem;
  shopping_list: ShoppingItem;
}

/**
 * Strict safety checker for client storage (IndexedDB & LocalStorage).
 * Guarantees that beef, wine (including wine vinegars), alcohol, beer, cocktails, seafood, and explicit content
 * can never be stored or retrieved from browser cache.
 */
export function isProhibitedContent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  const cleanAlc = lower
    .replace(/\b(?:kitchen\s+twine|butcher\s+twine|twine|ginger\s+ale)\b/gi, "");

  const cleanBeef = lower
    .replace(/\bbeefsteak\s+tomato(?:es)?\b/gi, "")
    .replace(/\b(?:vegan|vegetarian|meatless|plant-based)\s+beef\b/gi, "");

  const cleanSea = lower
    .replace(/\bscalloped\s+potatoes?\b/gi, "")
    .replace(/\bscalloped\s+corn\b/gi, "")
    .replace(/\bscalloped\s+cabbage\b/gi, "")
    .replace(/\buntuna\b/gi, "")
    .replace(/\bmusselman(?:'s)?\b/gi, "");

  // Beef check
  if (/\b(beef|bovine|oxtail|ribeye|t-bone|filet\s+mignon|sirloin|brisket|tallow|suet|veal|bison)\b/i.test(cleanBeef)) {
    return true;
  }
  // Alcohol / wine / beer / spirits / cocktails
  if (/\b(wine|wines|cooking\s+wine|beer|beers|root\s+beer|butterbeer|ale|ales|stout|stouts|lager|lagers|whiskey|whisky|bourbon|scotch|vodka|rum|tequila|gin|brandy|cognac|sake|mirin|liqueur|liqueurs|schnapps|cocktail|cocktails|mocktail|mocktails|margarita|martini|mojito|sangria|daiquiri|pina\s+colada|piña\s+colada|cosmopolitan|bloody\s+mary|champagne|prosecco|sherry|vermouth|marsala|hard\s+cider|alcohol|alcoholic|booze|liquor|liquors)\b/i.test(cleanAlc)) {
    return true;
  }
  // Seafood and prohibited meats
  if (/\b(fish|salmon|tuna|cod|halibut|trout|sardine|anchovy|anchovies|seafood|shrimp|prawn|crab|crabmeat|crabcake|crabcakes|krab|krabby|lobster|oyster|mussel|clam|scallop|squid|calamari|octopus|eel|flounder|walleye|grouper|perch|conch|turkey|duck|goose)\b/i.test(cleanSea)) {
    return true;
  }
  // Explicit content
  if (/\b(porn|blowjob|penis|vagina|sex|sexy|slut|nipple)\b/i.test(lower)) {
    return true;
  }

  return false;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      if (!db.objectStoreNames.contains("saved_recipes")) {
        const store = db.createObjectStore("saved_recipes", { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("cuisine", "cuisine", { unique: false });
      }

      if (!db.objectStoreNames.contains("generation_history")) {
        const store = db.createObjectStore("generation_history", { keyPath: "id" });
        store.createIndex("generated_at", "generated_at", { unique: false });
        store.createIndex("session_id", "session_id", { unique: false });
      }

      if (!db.objectStoreNames.contains("pantry_items")) {
        const store = db.createObjectStore("pantry_items", { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("category", "category", { unique: false });
      }

      if (!db.objectStoreNames.contains("shopping_list")) {
        const store = db.createObjectStore("shopping_list", { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("purchased", "purchased", { unique: false });
      }

      // Purge any legacy prohibited records during upgrade
      try {
        const tx = event.currentTarget.transaction;
        for (const storeName of ["saved_recipes", "generation_history", "pantry_items", "shopping_list"]) {
          if (db.objectStoreNames.contains(storeName)) {
            const store = tx.objectStore(storeName);
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => {
              const records = getAllReq.result || [];
              for (const rec of records) {
                const text = JSON.stringify(rec);
                if (isProhibitedContent(text)) {
                  store.delete(rec.id);
                }
              }
            };
          }
        }
      } catch {}
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

// LocalStorage fallbacks if IndexedDB is blocked
const LS_SAVED = "pm_saved_recipes";
const LS_HISTORY = "pm_gen_history";
const LS_PANTRY = "pm_pantry_items";
const LS_SHOPPING = "pm_shopping_list";

function getLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: T[] = JSON.parse(raw);
    // Sanitize on read
    const clean = parsed.filter(item => !isProhibitedContent(JSON.stringify(item)));
    if (clean.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

function setLS<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    const clean = data.filter(item => !isProhibitedContent(JSON.stringify(item)));
    localStorage.setItem(key, JSON.stringify(clean));
  } catch {}
}

// --- SAVED RECIPES ---
export async function getSavedRecipes(): Promise<Recipe[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("saved_recipes", "readwrite");
      const store = tx.objectStore("saved_recipes");
      const req = store.getAll();
      req.onsuccess = () => {
        const all: Recipe[] = req.result || [];
        const safe: Recipe[] = [];
        for (const r of all) {
          const text = `${r.title} ${r.description || ""} ${(r.ingredients || []).map(i => i.raw || i.name).join(" ")}`;
          if (isProhibitedContent(text)) {
            store.delete(r.id);
          } else {
            safe.push(r);
          }
        }
        resolve(safe);
      };
      req.onerror = () => resolve(getLS<Recipe>(LS_SAVED));
    });
  } catch {
    return getLS<Recipe>(LS_SAVED);
  }
}

export async function isRecipeSaved(id: number | string): Promise<boolean> {
  const recipes = await getSavedRecipes();
  return recipes.some(r => String(r.id) === String(id));
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const text = `${recipe.title} ${recipe.description || ""} ${(recipe.ingredients || []).map(i => i.raw || i.name).join(" ")}`;
  if (isProhibitedContent(text)) return;

  const current = getLS<Recipe>(LS_SAVED).filter(r => String(r.id) !== String(recipe.id));
  current.unshift(recipe);
  setLS(LS_SAVED, current);

  try {
    const db = await openDB();
    const tx = db.transaction("saved_recipes", "readwrite");
    tx.objectStore("saved_recipes").put(recipe);
  } catch {}
}

export async function removeSavedRecipe(id: number | string): Promise<void> {
  const current = getLS<Recipe>(LS_SAVED).filter(r => String(r.id) !== String(id));
  setLS(LS_SAVED, current);

  try {
    const db = await openDB();
    const tx = db.transaction("saved_recipes", "readwrite");
    tx.objectStore("saved_recipes").delete(id);
  } catch {}
}

// --- GENERATION HISTORY ---
export async function getGenerationHistory(): Promise<GenerationHistoryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("generation_history", "readwrite");
      const store = tx.objectStore("generation_history");
      const req = store.getAll();
      req.onsuccess = () => {
        const res: GenerationHistoryItem[] = req.result || [];
        const safe: GenerationHistoryItem[] = [];
        for (const item of res) {
          const text = `${item.recipe_name} ${(item.selected_ingredients || []).join(" ")} ${item.cuisine || ""}`;
          if (isProhibitedContent(text)) {
            store.delete(item.id);
          } else {
            safe.push(item);
          }
        }
        safe.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
        resolve(safe);
      };
      req.onerror = () => {
        const ls = getLS<GenerationHistoryItem>(LS_HISTORY);
        ls.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
        resolve(ls);
      };
    });
  } catch {
    const ls = getLS<GenerationHistoryItem>(LS_HISTORY);
    ls.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
    return ls;
  }
}

export async function addGenerationHistory(item: GenerationHistoryItem): Promise<void> {
  const text = `${item.recipe_name} ${(item.selected_ingredients || []).join(" ")}`;
  if (isProhibitedContent(text)) return;

  const current = getLS<GenerationHistoryItem>(LS_HISTORY).filter(h => h.id !== item.id);
  current.unshift(item);
  setLS(LS_HISTORY, current.slice(0, 100)); // retain up to 100 in history

  try {
    const db = await openDB();
    const tx = db.transaction("generation_history", "readwrite");
    tx.objectStore("generation_history").put(item);
  } catch {}
}

export async function removeGenerationHistory(id: string): Promise<void> {
  const current = getLS<GenerationHistoryItem>(LS_HISTORY).filter(h => h.id !== id);
  setLS(LS_HISTORY, current);

  try {
    const db = await openDB();
    const tx = db.transaction("generation_history", "readwrite");
    tx.objectStore("generation_history").delete(id);
  } catch {}
}

export async function clearGenerationHistory(): Promise<void> {
  setLS(LS_HISTORY, []);
  try {
    const db = await openDB();
    const tx = db.transaction("generation_history", "readwrite");
    tx.objectStore("generation_history").clear();
  } catch {}
}

// --- MY PANTRY ---
export async function getPantryItems(): Promise<PantryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pantry_items", "readwrite");
      const store = tx.objectStore("pantry_items");
      const req = store.getAll();
      req.onsuccess = () => {
        const res: PantryItem[] = req.result || [];
        const safe: PantryItem[] = [];
        for (const item of res) {
          if (isProhibitedContent(item.name) || item.category === "Seafood") {
            store.delete(item.id);
          } else {
            safe.push(item);
          }
        }
        resolve(safe);
      };
      req.onerror = () => resolve(getLS<PantryItem>(LS_PANTRY));
    });
  } catch {
    return getLS<PantryItem>(LS_PANTRY);
  }
}

export async function savePantryItem(item: PantryItem): Promise<void> {
  if (isProhibitedContent(item.name) || item.category === "Seafood") return;

  const current = getLS<PantryItem>(LS_PANTRY).filter(p => p.id !== item.id);
  current.push(item);
  setLS(LS_PANTRY, current);

  try {
    const db = await openDB();
    const tx = db.transaction("pantry_items", "readwrite");
    tx.objectStore("pantry_items").put(item);
  } catch {}
}

export async function removePantryItem(id: string): Promise<void> {
  const current = getLS<PantryItem>(LS_PANTRY).filter(p => p.id !== id);
  setLS(LS_PANTRY, current);

  try {
    const db = await openDB();
    const tx = db.transaction("pantry_items", "readwrite");
    tx.objectStore("pantry_items").delete(id);
  } catch {}
}

// --- SHOPPING LIST ---
export async function getShoppingList(): Promise<ShoppingItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("shopping_list", "readwrite");
      const store = tx.objectStore("shopping_list");
      const req = store.getAll();
      req.onsuccess = () => {
        const res: ShoppingItem[] = req.result || [];
        const safe: ShoppingItem[] = [];
        for (const item of res) {
          if (isProhibitedContent(item.name) || item.category === "Seafood") {
            store.delete(item.id);
          } else {
            safe.push(item);
          }
        }
        resolve(safe);
      };
      req.onerror = () => resolve(getLS<ShoppingItem>(LS_SHOPPING));
    });
  } catch {
    return getLS<ShoppingItem>(LS_SHOPPING);
  }
}

export async function saveShoppingItem(item: ShoppingItem): Promise<void> {
  if (isProhibitedContent(item.name) || item.category === "Seafood") return;

  const current = getLS<ShoppingItem>(LS_SHOPPING).filter(s => s.id !== item.id);
  current.push(item);
  setLS(LS_SHOPPING, current);

  try {
    const db = await openDB();
    const tx = db.transaction("shopping_list", "readwrite");
    tx.objectStore("shopping_list").put(item);
  } catch {}
}

export async function toggleShoppingItem(id: string): Promise<void> {
  const items = await getShoppingList();
  const target = items.find(i => i.id === id);
  if (target) {
    target.purchased = !target.purchased;
    await saveShoppingItem(target);
  }
}

export async function removeShoppingItem(id: string): Promise<void> {
  const current = getLS<ShoppingItem>(LS_SHOPPING).filter(s => s.id !== id);
  setLS(LS_SHOPPING, current);

  try {
    const db = await openDB();
    const tx = db.transaction("shopping_list", "readwrite");
    tx.objectStore("shopping_list").delete(id);
  } catch {}
}

export async function clearPurchasedShoppingItems(): Promise<void> {
  const current = getLS<ShoppingItem>(LS_SHOPPING).filter(s => !s.purchased);
  setLS(LS_SHOPPING, current);

  try {
    const db = await openDB();
    const tx = db.transaction("shopping_list", "readwrite");
    const store = tx.objectStore("shopping_list");
    const req = store.getAll();
    req.onsuccess = () => {
      const items: ShoppingItem[] = req.result || [];
      for (const item of items) {
        if (item.purchased) {
          store.delete(item.id);
        }
      }
    };
  } catch {}
}
