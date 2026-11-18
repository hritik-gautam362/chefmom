const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'pantrymuse.db');

const db = new Database(dbPath, { readonly: true });

console.log('=======================================================');
console.log('CHEF MOM — ASSAMESE INTEGRATION VERIFICATION');
console.log('=======================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Total Assamese Count
const assameseTotal = db.prepare("SELECT count(*) as c FROM recipes WHERE cuisine = 'Assamese'").get().c;
assert(assameseTotal === 51, `Total Assamese recipes in database is exactly 51 (found: ${assameseTotal})`);

// 2. Grand Total Count
const grandTotal = db.prepare("SELECT count(*) as c FROM recipes").get().c;
assert(grandTotal === 20573, `Grand total recipes is 20,573 (found: ${grandTotal})`);

// 3. Dietary Breakdown
const vegCount = db.prepare("SELECT count(*) as c FROM recipes WHERE cuisine = 'Assamese' AND is_vegetarian = 1").get().c;
const nonVegCount = db.prepare("SELECT count(*) as c FROM recipes WHERE cuisine = 'Assamese' AND is_vegetarian = 0").get().c;
const veganCount = db.prepare("SELECT count(*) as c FROM recipes WHERE cuisine = 'Assamese' AND is_vegan = 1").get().c;
assert(vegCount > 0, `Vegetarian Assamese recipes present (${vegCount})`);
assert(nonVegCount > 0, `Non-Vegetarian Assamese recipes present (${nonVegCount})`);
assert(veganCount > 0, `Vegan Assamese recipes present (${veganCount})`);
assert(vegCount + nonVegCount === 51, `Dietary counts sum to 51 (${vegCount} + ${nonVegCount} = 51)`);

// 4. Sample Recipe Check
const sample = db.prepare("SELECT * FROM recipes WHERE title LIKE 'Masor Tenga%'").get();
assert(sample !== undefined, 'Masor Tenga exists in database');
assert(sample && sample.cuisine === 'Assamese', 'Masor Tenga has cuisine = Assamese');
assert(sample && sample.prep_time_minutes === 20 && sample.cook_time_minutes === 25, 'Masor Tenga has accurate prep & cook times');
assert(sample && sample.servings === 4, 'Masor Tenga has accurate servings');

const ings = JSON.parse(sample.ingredients_json);
assert(ings.length > 5, `Masor Tenga has structured ingredients (${ings.length} parsed items)`);

const steps = JSON.parse(sample.instructions_json);
assert(steps.length > 3, `Masor Tenga has structured steps (${steps.length} steps)`);

// 5. Ingredient Index links
const links = db.prepare("SELECT count(*) as c FROM recipe_ingredients ri JOIN recipes r ON ri.recipe_id = r.id WHERE r.cuisine = 'Assamese'").get().c;
assert(links > 150, `Assamese recipe ingredient index populated (${links} links)`);

// 6. Test Matching Engine with Assamese preference
const { generateMatchingRecipes } = require('../src/lib/matchingEngine');

const matchAssamese = generateMatchingRecipes({
  ingredients: ['potato', 'mustard oil', 'green chilli'],
  preferences: { cuisine: 'Assamese' },
  limit: 6
});

assert(matchAssamese.recipes.length > 0, `Matching engine returns Assamese recipes for potato + mustard oil (found: ${matchAssamese.recipes.length})`);
const allAssamese = matchAssamese.recipes.every(r => r.cuisine === 'Assamese');
assert(allAssamese, 'All returned recipes have cuisine = Assamese');

// 7. Non-matching ingredients should return 0 Assamese recipes, NOT fallback to other cuisines
const noMatch = generateMatchingRecipes({
  ingredients: ['avocado', 'blueberry', 'maple syrup'],
  preferences: { cuisine: 'Assamese' },
  limit: 6
});
assert(noMatch.recipes.length === 0, `Unrelated ingredients return 0 Assamese recipes without fabricating generic dishes (found: ${noMatch.recipes.length})`);

db.close();

console.log(`\nVerification complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
