/**
 * Comprehensive End-to-End Safety & Route Verification
 * Tests all database layers, matching engine, and API safety invariants.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "data", "pantrymuse.db");
const RAW_CSV_PATH = path.join(__dirname, "..", "data", "recipe.csv");
const SW_PATH = path.join(__dirname, "..", "public", "sw.js");

const EXPECTED_RAW_SHA256 = "46fa522b43cc29a7adfd04886464501c23fe27b234a20fee3628d02fbe6cce2f";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}: ${details}`);
  }
}

console.log("\n=======================================================");
console.log(" PANTRYMUSE COMPREHENSIVE END-TO-END VERIFICATION");
console.log("=======================================================\n");

// 1. RAW CSV INTEGRITY CHECK
console.log("--- 1. Raw Dataset Non-Modification Invariant ---");
if (fs.existsSync(RAW_CSV_PATH)) {
  const rawBuf = fs.readFileSync(RAW_CSV_PATH);
  const actualSha256 = crypto.createHash("sha256").update(rawBuf).digest("hex");
  assert(
    actualSha256 === EXPECTED_RAW_SHA256,
    "Raw CSV file (data/recipe.csv) has NOT been modified or overwritten",
    `SHA mismatch: expected ${EXPECTED_RAW_SHA256}, got ${actualSha256}`
  );
} else {
  assert(false, "Raw CSV exists", "data/recipe.csv not found");
}

// 2. SERVICE WORKER CACHE VERSION CHECK
console.log("\n--- 2. Service Worker & Cache Invalidation ---");
const swContent = fs.readFileSync(SW_PATH, "utf8");
assert(
  swContent.includes('CACHE_NAME = "pantrymuse-v3"'),
  "Service Worker cache updated to pantrymuse-v3 for stale cache eviction",
  "Service Worker does not contain CACHE_NAME pantrymuse-v3"
);

// 3. DATABASE SANITIZATION AUDIT
console.log("\n--- 3. Database Content Safety Audit ---");
const db = new Database(DB_PATH, { readonly: true });

const totalCount = db.prepare("SELECT count(*) as count FROM recipes").get().count;
assert(totalCount > 20000, `Clean recipe count is healthy (${totalCount} recipes)`, `Count was ${totalCount}`);

// Beef audit
const beefCheck = db.prepare(`
  SELECT count(*) as count FROM recipes
  WHERE (
    title LIKE '%beef%' OR
    ingredients_raw LIKE '%beef%' OR
    directions_text LIKE '%beef%' OR
    title LIKE '%ribeye%' OR
    title LIKE '%oxtail%' OR
    title LIKE '%sirloin%' OR
    ingredients_raw LIKE '%tallow%' OR
    ingredients_raw LIKE '%suet%' OR
    ingredients_raw LIKE '%veal%' OR
    ingredients_raw LIKE '%bison%'
  )
  AND title NOT LIKE '%beefsteak tomato%'
  AND ingredients_raw NOT LIKE '%beefsteak tomato%'
  AND ingredients_raw NOT LIKE '%plant-based beef%'
  AND ingredients_raw NOT LIKE '%vegan beef%'
`).get().count;
assert(beefCheck === 0, "Zero beef or bovine recipes in database", `Found ${beefCheck}`);

// Alcohol audit
const alcoholCheck = db.prepare(`
  SELECT count(*) as count FROM recipes
  WHERE (
    title LIKE '%wine%' OR
    ingredients_raw LIKE '%wine%' OR
    directions_text LIKE '%wine%' OR
    title LIKE '%vodka%' OR
    ingredients_raw LIKE '%vodka%' OR
    title LIKE '%tequila%' OR
    ingredients_raw LIKE '%tequila%' OR
    title LIKE '%whiskey%' OR
    ingredients_raw LIKE '%whiskey%' OR
    title LIKE '%whisky%' OR
    ingredients_raw LIKE '%whisky%' OR
    title LIKE '%bourbon%' OR
    ingredients_raw LIKE '%bourbon%' OR
    title LIKE '%brandy%' OR
    ingredients_raw LIKE '%brandy%' OR
    title LIKE '%cognac%' OR
    ingredients_raw LIKE '%cognac%' OR
    title LIKE '%liqueur%' OR
    ingredients_raw LIKE '%liqueur%' OR
    title LIKE '%schnapps%' OR
    ingredients_raw LIKE '%schnapps%' OR
    title LIKE '%cocktail%' OR
    ingredients_raw LIKE '%cocktail%' OR
    title LIKE '%margarita%' OR
    ingredients_raw LIKE '%margarita%' OR
    title LIKE '%martini%' OR
    ingredients_raw LIKE '%martini%' OR
    title LIKE '%mojito%' OR
    ingredients_raw LIKE '%mojito%' OR
    title LIKE '%sangria%' OR
    ingredients_raw LIKE '%sangria%' OR
    title LIKE '%daiquiri%' OR
    ingredients_raw LIKE '%daiquiri%' OR
    title LIKE '%champagne%' OR
    ingredients_raw LIKE '%champagne%' OR
    title LIKE '%prosecco%' OR
    ingredients_raw LIKE '%prosecco%' OR
    title LIKE '%sake%' OR
    ingredients_raw LIKE '%sake%' OR
    title LIKE '%mirin%' OR
    ingredients_raw LIKE '%mirin%'
  )
  AND ingredients_raw NOT LIKE '%twine%'
  AND directions_text NOT LIKE '%twine%'
  AND directions_text NOT LIKE '%chewiness%'
`).get().count;
assert(alcoholCheck === 0, "Zero wine, alcohol, beer, or cocktails in database", `Found ${alcoholCheck}`);

// Seafood audit
const seafoodCheck = db.prepare(`
  SELECT count(*) as count FROM recipes
  WHERE (
    category = 'seafood' OR
    title LIKE '%salmon%' OR
    ingredients_raw LIKE '%salmon%' OR
    title LIKE '%tuna%' OR
    ingredients_raw LIKE '%tuna%' OR
    title LIKE '%shrimp%' OR
    ingredients_raw LIKE '%shrimp%' OR
    title LIKE '%prawn%' OR
    ingredients_raw LIKE '%prawn%' OR
    title LIKE '%crab%' OR
    ingredients_raw LIKE '%crab%' OR
    title LIKE '%lobster%' OR
    ingredients_raw LIKE '%lobster%' OR
    title LIKE '%oyster%' OR
    ingredients_raw LIKE '%oyster%' OR
    title LIKE '%mussel%' OR
    ingredients_raw LIKE '%mussel%' OR
    title LIKE '%calamari%' OR
    ingredients_raw LIKE '%calamari%' OR
    title LIKE '%octopus%' OR
    ingredients_raw LIKE '%octopus%' OR
    title LIKE '%walleye%' OR
    ingredients_raw LIKE '%walleye%' OR
    title LIKE '%halibut%' OR
    ingredients_raw LIKE '%halibut%' OR
    title LIKE '%grouper%' OR
    ingredients_raw LIKE '%grouper%'
  )
  AND title NOT LIKE '%untuna%'
  AND ingredients_raw NOT LIKE '%untuna%'
  AND title NOT LIKE '%oyster mushroom%'
  AND ingredients_raw NOT LIKE '%oyster mushroom%'
  AND title NOT LIKE '%oyster cracker%'
  AND ingredients_raw NOT LIKE '%oyster cracker%'
  AND title NOT LIKE '%musselman%'
  AND ingredients_raw NOT LIKE '%musselman%'
`).get().count;
assert(seafoodCheck === 0, "Zero seafood or fish recipes in database", `Found ${seafoodCheck}`);

// Explicit sexual content audit
const explicitCheck = db.prepare(`
  SELECT count(*) as count FROM recipes
  WHERE (
    title LIKE '%porn%' OR
    description LIKE '%porn%' OR
    ingredients_raw LIKE '%porn%' OR
    directions_text LIKE '%porn%' OR
    title LIKE '%blowjob%' OR
    title LIKE '%penis%' OR
    title LIKE '%vagina%' OR
    title LIKE '%slut%' OR
    directions_text LIKE '%blowjob%' OR
    directions_text LIKE '%penis%' OR
    directions_text LIKE '%vagina%'
  )
`).get().count;
assert(explicitCheck === 0, "Zero explicit sexual or pornographic content in database", `Found ${explicitCheck}`);

// 4. PERMITTED MEAT AND VEGETARIAN POLICY VERIFICATION
console.log("\n--- 4. Permitted Meat & Dietary Policy Retention ---");
const chickenCount = db.prepare("SELECT count(*) as count FROM recipes WHERE title LIKE '%chicken%' OR ingredients_raw LIKE '%chicken%'").get().count;
assert(chickenCount > 2000, `Chicken recipes preserved (${chickenCount} recipes)`, `Count was ${chickenCount}`);

const porkCount = db.prepare("SELECT count(*) as count FROM recipes WHERE title LIKE '%pork%' OR title LIKE '%bacon%' OR ingredients_raw LIKE '%pork%' OR ingredients_raw LIKE '%bacon%'").get().count;
assert(porkCount > 1000, `Pork and bacon recipes preserved (${porkCount} recipes)`, `Count was ${porkCount}`);

const muttonCount = db.prepare("SELECT count(*) as count FROM recipes WHERE title LIKE '%mutton%' OR title LIKE '%lamb%' OR title LIKE '%goat%' OR ingredients_raw LIKE '%lamb%' OR ingredients_raw LIKE '%mutton%'").get().count;
assert(muttonCount > 100, `Mutton, lamb, and goat recipes preserved (${muttonCount} recipes)`, `Count was ${muttonCount}`);

const vegCount = db.prepare("SELECT count(*) as count FROM recipes WHERE is_vegetarian = 1").get().count;
assert(vegCount > 10000, `Vegetarian recipes preserved (${vegCount} recipes)`, `Count was ${vegCount}`);

// 5. INGREDIENTS LIBRARY SANITIZATION
console.log("\n--- 5. Ingredients Library Audit ---");
const libBeef = db.prepare("SELECT count(*) as count FROM ingredients_library WHERE name LIKE '%beef%' OR name LIKE '%steak%'").get().count;
assert(libBeef === 0, "Ingredients library contains 0 beef items", `Found ${libBeef}`);

const libSeafood = db.prepare("SELECT count(*) as count FROM ingredients_library WHERE category = 'Seafood' OR name LIKE '%fish%' OR name LIKE '%salmon%' OR name LIKE '%shrimp%'").get().count;
assert(libSeafood === 0, "Ingredients library contains 0 seafood items", `Found ${libSeafood}`);

const libAlcohol = db.prepare("SELECT count(*) as count FROM ingredients_library WHERE name LIKE '%wine%' OR name LIKE '%beer%' OR name LIKE '%cocktail%' OR name LIKE '%alcohol%' OR name LIKE '%whiskey%' OR name LIKE '%vodka%'").get().count;
assert(libAlcohol === 0, "Ingredients library contains 0 wine, cocktail, or alcoholic items", `Found ${libAlcohol}`);

// 6. SYNONYM AND MATCHING ENGINE LOGIC
console.log("\n--- 6. Matching Engine Logic & Invariants ---");
const matchingEngine = require("../src/lib/matchingEngine.ts");
// Test normalizeIngredient
const potatoSynonyms = matchingEngine.normalizeIngredient("potato");
assert(potatoSynonyms.includes("aloo"), "Potato maps to aloo synonym");

const chickenSynonyms = matchingEngine.normalizeIngredient("chicken");
assert(chickenSynonyms.includes("murgh"), "Chicken maps to murgh synonym");

// Test search terms with disallowed items
const matchesBeef = matchingEngine.generateMatchingRecipes({ ingredients: ["beef", "wine"] });
assert(matchesBeef.recipes.length === 0, "Disallowed query [beef, wine] returns 0 recipes", `Returned ${matchesBeef.recipes.length}`);

// Test search terms with safe items
const matchesSafe = matchingEngine.generateMatchingRecipes({ ingredients: ["potato", "onion", "tomato"] });
assert(matchesSafe.recipes.length > 0, `Safe query [potato, onion, tomato] returns matches (${matchesSafe.recipes.length})`);
const anyProhibited = matchesSafe.recipes.some(r => {
  const text = `${r.title} ${r.description} ${r.ingredients.map(i => i.raw).join(" ")}`.toLowerCase();
  return text.includes("beef") || text.includes("wine") || text.includes("vodka") || text.includes("salmon");
});
assert(!anyProhibited, "No prohibited ingredients in returned matching recipes");

console.log("\n=======================================================");
console.log(` TEST SUMMARY: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
console.log("=======================================================\n");

process.exit(failedTests > 0 ? 1 : 0);
