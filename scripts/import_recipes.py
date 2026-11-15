#!/usr/bin/env python3
"""PantryMuse Recipe Database Ingestion Pipeline
Reads data/recipe.csv, validates fields, normalizes titles, parses ingredients & instructions safely,
classifies dietary/cuisine/meal types, builds search indexes, and stores in SQLite data/pantrymuse.db.
"""
from __future__ import annotations

import ast
import csv
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

# Ensure scripts directory and workspace root are in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
for p in (str(ROOT_DIR), str(SCRIPT_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Import strict safety classifier from dataset sanitization pipeline
try:
    from scripts.sanitize_recipe_dataset import classify_recipe, is_valid_image_url
except ImportError:
    from sanitize_recipe_dataset import classify_recipe, is_valid_image_url

PROCESSED_CSV = Path("data/processed/recipes_cleaned.csv")
CSV_PATH = PROCESSED_CSV if PROCESSED_CSV.exists() else Path("data/recipe.csv")
DB_PATH = Path("data/pantrymuse.db")

# Units normalization regex
UNIT_PATTERN = re.compile(
    r'\b(cups?|c\.|tablespoons?|tbsp?\.?|teaspoons?|tsp\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|kilograms?|kg\.?|milliliters?|ml\.?|liters?|l\.?|pinch|pinches|dash|dashes|cloves?|slices?|cans?|packages?|pkgs?|bunches?|sprigs?|stalks?|heads?|pieces?|pcs?|quarts?|qt\.?|pints?|pt\.?)\b',
    re.IGNORECASE
)

# Common unicode vulgar fractions
FRACTIONS = {
    '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅙': 0.167, '⅚': 0.833, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
}

def parse_time_minutes(time_str: str | None) -> int:
    if not time_str:
        return 0
    s = str(time_str).lower().strip()
    total = 0
    hr_match = re.search(r'(\d+)\s*(?:hr|hour)', s)
    if hr_match:
        total += int(hr_match.group(1)) * 60
    min_match = re.search(r'(\d+)\s*(?:min|minute)', s)
    if min_match:
        total += int(min_match.group(1))
    if total == 0 and s.isdigit():
        total = int(s)
    return total

def parse_servings(servings_str: str | None) -> int:
    if not servings_str:
        return 4
    s = str(servings_str).strip()
    m = re.search(r'(\d+)', s)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 100 else 4
    return 4

def clean_ingredient_name(raw: str) -> str:
    """Extract clean core ingredient name from ingredient phrase."""
    text = raw.lower()
    for f, _ in FRACTIONS.items():
        text = text.replace(f, ' ')
    text = re.sub(r'\([^)]*\)', ' ', text)
    text = re.sub(r'[\d/\.\,]+', ' ', text)
    text = UNIT_PATTERN.sub(' ', text)
    prep_words = {
        'chopped', 'diced', 'minced', 'sliced', 'peeled', 'fresh', 'dried', 'grated',
        'shredded', 'crushed', 'melted', 'beaten', 'divided', 'ground', 'frozen',
        'thawed', 'cooked', 'drained', 'rinsed', 'softened', 'packed', 'taste',
        'optional', 'halved', 'to taste', 'extra', 'finely', 'coarsely', 'plus',
        'or', 'needed', 'small', 'medium', 'large', 'boneless', 'skinless', 'all-purpose',
        'warm', 'cold', 'hot', 'room', 'temperature', 'cut', 'into', 'cubes'
    }
    tokens = [t for t in re.findall(r'[a-z\-]+', text) if len(t) > 2 and t not in prep_words]
    if tokens:
        cleaned = ' '.join(tokens[:3])
        if cleaned.endswith('ies'):
            cleaned = cleaned[:-3] + 'y'
        elif cleaned.endswith('es') and not cleaned.endswith('cheese'):
            cleaned = cleaned[:-2]
        elif cleaned.endswith('s') and not cleaned.endswith('ss'):
            cleaned = cleaned[:-1]
        return cleaned.strip()
    return re.sub(r'[^a-zA-Z\s]', '', raw).strip().lower()[:30]

def parse_ingredient_line(line: str) -> dict:
    line = line.strip()
    if not line:
        return {}
    clean_name = clean_ingredient_name(line)
    
    qty = 1.0
    m = re.match(r'^([\d\s/\.½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+)', line)
    if m:
        num_str = m.group(1).strip()
        try:
            val = 0.0
            for char, frac in FRACTIONS.items():
                if char in num_str:
                    val += frac
                    num_str = num_str.replace(char, '')
            parts = num_str.split()
            for p in parts:
                if '/' in p:
                    num, den = p.split('/', 1)
                    val += float(num) / float(den)
                elif p:
                    val += float(p)
            if val > 0:
                qty = round(val, 2)
        except Exception:
            qty = 1.0
            
    unit_m = UNIT_PATTERN.search(line)
    unit = unit_m.group(0).lower() if unit_m else ""
    
    return {
        "raw": line,
        "name": clean_name or line,
        "clean_name": clean_name or line,
        "quantity": qty,
        "unit": unit,
        "optional": "optional" in line.lower()
    }

def safe_parse_instructions(instructions_str: str, directions_str: str) -> list[dict]:
    steps = []
    if instructions_str and instructions_str.strip().startswith('['):
        try:
            parsed = ast.literal_eval(instructions_str)
            if isinstance(parsed, list):
                steps = [str(s).strip() for s in parsed if str(s).strip()]
        except Exception:
            steps = []
            
    if not steps and directions_str:
        lines = [l.strip() for l in directions_str.split('\n') if l.strip()]
        if len(lines) > 1:
            steps = lines
        else:
            sentences = re.split(r'\.\s+(?=[A-Z])', directions_str)
            steps = [s.strip() + ('.' if not s.endswith('.') else '') for s in sentences if s.strip()]
            
    if not steps:
        steps = ["Follow the recipe ingredients and assemble as directed."]
        
    structured = []
    for idx, step_text in enumerate(steps, 1):
        words = step_text.split()
        first_few = " ".join(words[:4]).rstrip('.,;:')
        title = f"Step {idx}: {first_few.capitalize()}"
        time_m = re.search(r'(\d+)\s*(?:to\s*\d+\s*)?(?:minutes?|mins?)', step_text, re.IGNORECASE)
        time_val = int(time_m.group(1)) if time_m else 0
        structured.append({
            "step": idx,
            "title": title,
            "instruction": step_text,
            "time_minutes": time_val
        })
    return structured

def infer_cuisine(title: str, desc: str, ingredients_str: str) -> str:
    combined = f"{title} {desc} {ingredients_str}".lower()
    if any(k in combined for k in ['paneer', 'garam masala', 'turmeric', 'curry powder', 'naan', 'tikka', 'chana masala', 'samosa', 'dal', 'biryani', 'murgh', 'cardamom', 'cumin seed', 'coriander seed', 'curry leaves']):
        return "Indian"
    if any(k in combined for k in ['pasta', 'parmesan', 'mozzarella', 'risotto', 'penne', 'spaghetti', 'basil', 'marinara', 'pesto', 'lasagna', 'fettuccine', 'prosciutto', 'ricotta']):
        return "Italian"
    if any(k in combined for k in ['taco', 'tortilla', 'enchilada', 'salsa', 'jalapeno', 'cilantro', 'fajita', 'quesadilla', 'avocado', 'chipotle', 'guacamole', 'cumin']):
        return "Mexican"
    if any(k in combined for k in ['soy sauce', 'sesame oil', 'teriyaki', 'miso', 'ramen', 'ginger', 'bok choy', 'sriracha', 'tofu', 'stir fry', 'wonton', 'dumpling']):
        return "Asian"
    if any(k in combined for k in ['feta', 'tzatziki', 'hummus', 'pita', 'kalamata', 'greek', 'mediterranean', 'tahini', 'falafel']):
        return "Mediterranean"
    if any(k in combined for k in ['croissant', 'dijon', 'crepe', 'baguette', 'brie', 'hollandaise', 'quiche', 'provencal']):
        return "French"
    return "American / International"

def infer_dietary(ingredients_str: str) -> tuple[bool, bool, bool]:
    s = ingredients_str.lower()
    meat_keywords = [
        'beef', 'pork', 'chicken', 'turkey', 'bacon', 'ham', 'sausage', 'lamb',
        'veal', 'duck', 'shrimp', 'prawn', 'salmon', 'tuna', 'cod', 'tilapia',
        'crab', 'lobster', 'fish', 'anchov', 'gelatin', 'lard', 'prosciutto'
    ]
    dairy_keywords = [
        'milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg', 'honey', 'ghee',
        'parmesan', 'mozzarella', 'cheddar', 'ricotta', 'mayonnaise'
    ]
    gluten_keywords = [
        'flour', 'wheat', 'bread', 'pasta', 'spaghetti', 'macaroni', 'barley', 'rye'
    ]
    
    is_veg = not any(re.search(r'\b' + re.escape(w) + r'\b', s) for w in meat_keywords)
    is_vegan = is_veg and not any(re.search(r'\b' + re.escape(w) + r'\b', s) for w in dairy_keywords)
    is_gf = not any(re.search(r'\b' + re.escape(w) + r'\b', s) for w in gluten_keywords)
    return is_veg, is_vegan, is_gf

def infer_meal_type(category: str, title: str) -> str:
    comb = f"{category} {title}".lower()
    if any(k in comb for k in ['breakfast', 'brunch', 'pancake', 'waffle', 'oatmeal', 'crepe', 'muffin', 'egg', 'toast']):
        return "Breakfast"
    if any(k in comb for k in ['dessert', 'cake', 'cookie', 'pie', 'brownie', 'pudding', 'ice cream', 'sweet']):
        return "Dessert"
    if any(k in comb for k in ['appetizer', 'snack', 'dip', 'finger food', 'bites', 'chips', 'samosa']):
        return "Snack"
    if any(k in comb for k in ['salad', 'soup', 'sandwich', 'wrap']):
        return "Lunch"
    return "Dinner"

def infer_difficulty(total_time: int, steps_count: int, ingredients_count: int) -> str:
    if total_time <= 25 and ingredients_count <= 6 and steps_count <= 4:
        return "Easy"
    if total_time > 60 or ingredients_count > 12 or steps_count > 8:
        return "Advanced"
    return "Medium"

def generate_tips(title: str, category: str, cuisine: str) -> list[str]:
    tips = [
        "Taste and adjust salt and acid (lemon or vinegar) right at the end to brighten the flavours.",
        "Prep all ingredients before heating your pan to maintain cooking control and prevent scorching.",
        "Let hot cooked dishes rest for 3 to 5 minutes before serving so moisture and sauces settle evenly."
    ]
    if cuisine == "Indian":
        tips.append("Bloom whole spices in warm oil or ghee first to release their deep aromatic oils.")
    elif cuisine == "Italian":
        tips.append("Save 1/4 cup of starchy pasta water to emulsify the sauce into a silky restaurant finish.")
    return tips

def main():
    start_time = time.time()
    print(f"Starting PantryMuse database import from {CSV_PATH}...")
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} does not exist. Run scripts/download_recipe_dataset.py first.", file=sys.stderr)
        sys.exit(1)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    cursor.execute("PRAGMA page_size = 4096;")

    # Drop existing tables cleanly
    cursor.execute("DROP TABLE IF EXISTS recipes;")
    cursor.execute("DROP TABLE IF EXISTS recipe_ingredients;")
    cursor.execute("DROP TABLE IF EXISTS ingredients_library;")

    # Schema definition
    cursor.execute("""
    CREATE TABLE recipes (
        id INTEGER PRIMARY KEY,
        slug TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        cuisine TEXT,
        prep_time_minutes INTEGER DEFAULT 0,
        cook_time_minutes INTEGER DEFAULT 0,
        total_time_minutes INTEGER DEFAULT 0,
        servings INTEGER DEFAULT 4,
        yields TEXT,
        rating REAL DEFAULT 4.5,
        rating_count INTEGER DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        is_vegetarian INTEGER DEFAULT 0,
        is_vegan INTEGER DEFAULT 0,
        is_gluten_free INTEGER DEFAULT 0,
        meal_type TEXT,
        difficulty TEXT,
        ingredients_raw TEXT,
        ingredients_json TEXT,
        ingredient_keywords TEXT,
        directions_text TEXT,
        instructions_json TEXT,
        nutrition_json TEXT,
        equipment_json TEXT,
        chefs_tips_json TEXT,
        image_url TEXT,
        source_url TEXT,
        author TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE recipe_ingredients (
        recipe_id INTEGER,
        ingredient_clean TEXT,
        FOREIGN KEY(recipe_id) REFERENCES recipes(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE ingredients_library (
        name TEXT PRIMARY KEY,
        category TEXT,
        synonyms TEXT,
        recipe_count INTEGER DEFAULT 0,
        is_indian INTEGER DEFAULT 0,
        is_common INTEGER DEFAULT 1,
        default_unit TEXT DEFAULT 'pcs'
    );
    """)

    ingredient_counts = {}
    seen_titles = set()
    rows_inserted = 0

    with open(CSV_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        batch_recipes = []
        batch_ingredients = []

        for row_idx, row in enumerate(reader, 1):
            title = (row.get("title") or "").strip()
            if not title:
                continue

            # Defense-in-depth: Strict safety and dietary filter (beef, alcohol, wine, explicit, disallowed meat)
            safety_status, safety_reasons, _ = classify_recipe(row)
            if safety_status != "keep":
                continue

            norm_title = re.sub(r'[^a-z0-9]', '', title.lower())
            if norm_title in seen_titles:
                continue
            seen_titles.add(norm_title)

            raw_ingredients_str = row.get("ingredients") or ""
            raw_ing_list = [i.strip() for i in raw_ingredients_str.split(";") if i.strip()]
            if not raw_ing_list:
                continue

            parsed_ingredients = []
            clean_names = []
            for item in raw_ing_list:
                parsed_item = parse_ingredient_line(item)
                if parsed_item and parsed_item.get("name"):
                    parsed_ingredients.append(parsed_item)
                    cname = parsed_item["clean_name"]
                    clean_names.append(cname)
                    ingredient_counts[cname] = ingredient_counts.get(cname, 0) + 1

            if not clean_names:
                continue

            prep_m = parse_time_minutes(row.get("prep_time"))
            cook_m = parse_time_minutes(row.get("cook_time"))
            tot_m = parse_time_minutes(row.get("total_time"))
            if tot_m == 0:
                tot_m = prep_m + cook_m
            if tot_m == 0:
                tot_m = 30

            servings = parse_servings(row.get("servings"))
            cat = (row.get("category") or "Main Dish").strip()
            desc = (row.get("description") or "").strip()
            author = (row.get("author") or "PantryMuse Chef").strip()

            try:
                rating = float(row.get("rating") or 4.5)
                if rating <= 0:
                    rating = 4.5
            except ValueError:
                rating = 4.5

            rating_count = int(float(row.get("rating_count") or 100)) if row.get("rating_count") else 100
            review_count = int(float(row.get("review_count") or 50)) if row.get("review_count") else 50

            instructions = safe_parse_instructions(row.get("instructions_list", ""), row.get("directions", ""))
            cuisine = infer_cuisine(title, desc, raw_ingredients_str)
            is_veg, is_vegan, is_gf = infer_dietary(raw_ingredients_str)
            meal_type = infer_meal_type(cat, title)
            diff = infer_difficulty(tot_m, len(instructions), len(clean_names))

            nutrition = {
                "calories": float(row.get("calories") or 0) if row.get("calories") else None,
                "carbohydrates_g": float(row.get("carbohydrates_g") or 0) if row.get("carbohydrates_g") else None,
                "protein_g": float(row.get("protein_g") or 0) if row.get("protein_g") else None,
                "fat_g": float(row.get("fat_g") or 0) if row.get("fat_g") else None,
                "dietary_fiber_g": float(row.get("dietary_fiber_g") or 0) if row.get("dietary_fiber_g") else None,
                "sodium_mg": float(row.get("sodium_mg") or 0) if row.get("sodium_mg") else None
            }

            equipment = ["Chef knife", "Cutting board"]
            instr_str = (row.get("directions") or "").lower()
            if "skillet" in instr_str or "pan" in instr_str:
                equipment.append("Skillet / Frying Pan")
            if "pot" in instr_str or "boil" in instr_str:
                equipment.append("Saucepan / Soup Pot")
            if "bake" in instr_str or "oven" in instr_str:
                equipment.append("Baking Dish / Sheet")
            if "whisk" in instr_str or "bowl" in instr_str:
                equipment.append("Mixing Bowl & Whisk")

            tips = generate_tips(title, cat, cuisine)
            slug = f"{re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')}-{row_idx}"
            raw_img = (row.get("image") or "").strip()
            img_status = (row.get("image_safety_status") or "").strip()
            # Only keep image URL if safe model pass or valid URL; otherwise blank for curated fallback
            if img_status and img_status != "safe_model_pass":
                image_url = ""
            elif is_valid_image_url(raw_img):
                image_url = raw_img
            else:
                image_url = ""
            source_url = row.get("url", "").strip()

            recipe_id = row_idx
            keyword_str = " ".join(set(clean_names))

            batch_recipes.append((
                recipe_id,
                slug,
                title,
                desc,
                cat,
                cuisine,
                prep_m,
                cook_m,
                tot_m,
                servings,
                row.get("yields", f"{servings} servings"),
                rating,
                rating_count,
                review_count,
                1 if is_veg else 0,
                1 if is_vegan else 0,
                1 if is_gf else 0,
                meal_type,
                diff,
                raw_ingredients_str,
                json.dumps(parsed_ingredients),
                keyword_str,
                row.get("directions", ""),
                json.dumps(instructions),
                json.dumps(nutrition),
                json.dumps(equipment),
                json.dumps(tips),
                image_url,
                source_url,
                author
            ))

            for cname in set(clean_names):
                batch_ingredients.append((recipe_id, cname))

            rows_inserted += 1

            if len(batch_recipes) >= 2000:
                cursor.executemany("""
                INSERT INTO recipes (
                    id, slug, title, description, category, cuisine,
                    prep_time_minutes, cook_time_minutes, total_time_minutes,
                    servings, yields, rating, rating_count, review_count,
                    is_vegetarian, is_vegan, is_gluten_free, meal_type, difficulty,
                    ingredients_raw, ingredients_json, ingredient_keywords,
                    directions_text, instructions_json, nutrition_json,
                    equipment_json, chefs_tips_json, image_url, source_url, author
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
                """, batch_recipes)

                cursor.executemany("""
                INSERT INTO recipe_ingredients (recipe_id, ingredient_clean) VALUES (?, ?);
                """, batch_ingredients)

                conn.commit()
                batch_recipes = []
                batch_ingredients = []
                print(f"Processed {rows_inserted:,} recipes...")

        if batch_recipes:
            cursor.executemany("""
            INSERT INTO recipes (
                id, slug, title, description, category, cuisine,
                prep_time_minutes, cook_time_minutes, total_time_minutes,
                servings, yields, rating, rating_count, review_count,
                is_vegetarian, is_vegan, is_gluten_free, meal_type, difficulty,
                ingredients_raw, ingredients_json, ingredient_keywords,
                directions_text, instructions_json, nutrition_json,
                equipment_json, chefs_tips_json, image_url, source_url, author
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
            """, batch_recipes)

            cursor.executemany("""
            INSERT INTO recipe_ingredients (recipe_id, ingredient_clean) VALUES (?, ?);
            """, batch_ingredients)
            conn.commit()

    print("Creating database indices...")
    cursor.execute("CREATE INDEX idx_rec_ing_clean ON recipe_ingredients(ingredient_clean);")
    cursor.execute("CREATE INDEX idx_rec_ing_id ON recipe_ingredients(recipe_id);")
    cursor.execute("CREATE INDEX idx_rec_title ON recipes(title);")
    cursor.execute("CREATE INDEX idx_rec_cuisine ON recipes(cuisine);")
    cursor.execute("CREATE INDEX idx_rec_meal_type ON recipes(meal_type);")
    cursor.execute("CREATE INDEX idx_rec_veg ON recipes(is_vegetarian);")
    cursor.execute("CREATE INDEX idx_rec_time ON recipes(total_time_minutes);")
    cursor.execute("CREATE INDEX idx_rec_rating ON recipes(rating DESC);")
    cursor.execute("CREATE INDEX idx_rec_slug ON recipes(slug);")
    conn.commit()

    print("Building curated ingredients library...")
    common_ingredients_seed = [
        # Vegetables
        ("potato", "Vegetables", "potatoes,aloo,spud", 1, "pcs"),
        ("onion", "Vegetables", "onions,pyaz,red onion,white onion", 1, "pcs"),
        ("tomato", "Vegetables", "tomatoes,tamatar,cherry tomato", 1, "pcs"),
        ("garlic", "Vegetables", "lahsun,garlic clove", 1, "cloves"),
        ("ginger", "Vegetables", "adrak,fresh ginger", 1, "inch"),
        ("spinach", "Vegetables", "palak,baby spinach", 1, "bunches"),
        ("bell pepper", "Vegetables", "capsicum,shimla mirch,peppers", 1, "pcs"),
        ("carrot", "Vegetables", "carrots,gajar", 1, "pcs"),
        ("cauliflower", "Vegetables", "gobi,phool gobi", 1, "head"),
        ("green peas", "Vegetables", "peas,matar,frozen peas", 1, "cups"),
        ("green chilli", "Vegetables", "hari mirch,chili,jalapeno", 1, "pcs"),
        ("coriander", "Spices and herbs", "cilantro,dhania,coriander leaves", 1, "bunches"),
        ("curry leaves", "Spices and herbs", "kadi patta", 1, "sprigs"),
        ("mushroom", "Vegetables", "mushrooms,button mushroom", 1, "g"),
        ("broccoli", "Vegetables", "broccoli florets", 1, "head"),
        ("cabbage", "Vegetables", "patta gobi", 1, "head"),
        ("cucumber", "Vegetables", "kheera", 1, "pcs"),
        ("zucchini", "Vegetables", "courgette", 1, "pcs"),
        ("eggplant", "Vegetables", "baingan,aubergine,brinjal", 1, "pcs"),

        # Dairy
        ("paneer", "Dairy", "cottage cheese,indian cottage cheese", 1, "g"),
        ("milk", "Dairy", "doodh,whole milk", 1, "ml"),
        ("butter", "Dairy", "makhan,salted butter,unsalted butter", 1, "tbsp"),
        ("cheese", "Dairy", "cheddar,mozzarella,parmesan", 1, "g"),
        ("yogurt", "Dairy", "dahi,curd,greek yogurt", 1, "cups"),
        ("cream", "Dairy", "heavy cream,malai,whipping cream", 1, "ml"),
        ("ghee", "Dairy", "clarified butter,desi ghee", 1, "tbsp"),

        # Grains and cereals
        ("rice", "Grains and cereals", "chawal,basmati rice,white rice,brown rice", 1, "cups"),
        ("atta", "Grains and cereals", "wheat flour,whole wheat flour,gehu ka atta", 1, "cups"),
        ("flour", "Grains and cereals", "all-purpose flour,maida", 1, "cups"),
        ("poha", "Grains and cereals", "flattened rice,beaten rice", 1, "cups"),
        ("pasta", "Grains and cereals", "spaghetti,penne,macaroni,noodles", 1, "g"),
        ("oats", "Grains and cereals", "rolled oats,oatmeal", 1, "cups"),
        ("bread", "Grains and cereals", "loaf,sandwich bread,slices", 1, "slices"),
        ("besan", "Grains and cereals", "gram flour,chickpea flour", 1, "cups"),
        ("sooji", "Grains and cereals", "semolina,rava", 1, "cups"),

        # Legumes & Pulses
        ("dal", "Legumes", "lentils,toor dal,moong dal,chana dal,masoor dal", 1, "cups"),
        ("chickpeas", "Legumes", "chana,garbanzo,kabuli chana", 1, "cups"),
        ("kidney beans", "Legumes", "rajma", 1, "cups"),
        ("black beans", "Legumes", "beans", 1, "cups"),

        # Meat and poultry (strictly permitted meats only)
        ("chicken", "Meat and poultry", "chicken breast,chicken thighs,murgh", 1, "g"),
        ("egg", "Meat and poultry", "eggs,anda", 1, "pcs"),
        ("pork", "Meat and poultry", "bacon,pork chops,ham", 0, "g"),
        ("mutton", "Meat and poultry", "lamb,goat,chevon,gosht", 1, "g"),
        ("lamb", "Meat and poultry", "mutton,goat,gosht", 1, "g"),
        ("goat", "Meat and poultry", "chevon,mutton", 1, "g"),
        ("pigeon", "Meat and poultry", "squab", 0, "pcs"),

        # Spices and herbs
        ("turmeric", "Spices and herbs", "haldi,turmeric powder", 1, "tsp"),
        ("cumin", "Spices and herbs", "jeera,cumin seeds,cumin powder", 1, "tsp"),
        ("garam masala", "Spices and herbs", "indian spice mix", 1, "tsp"),
        ("mustard seeds", "Spices and herbs", "rai,sarson", 1, "tsp"),
        ("cardamom", "Spices and herbs", "elaichi,green cardamom", 1, "pods"),
        ("cinnamon", "Spices and herbs", "dalchini", 1, "sticks"),
        ("clove", "Spices and herbs", "laung,cloves", 1, "pcs"),
        ("black pepper", "Spices and herbs", "kali mirch,pepper", 1, "tsp"),
        ("red chilli powder", "Spices and herbs", "lal mirch,cayenne", 1, "tsp"),
        ("coriander powder", "Spices and herbs", "dhania powder", 1, "tsp"),
        ("basil", "Spices and herbs", "fresh basil,tulsi", 0, "leaves"),
        ("oregano", "Spices and herbs", "dried oregano", 0, "tsp"),
        ("rosemary", "Spices and herbs", "fresh rosemary", 0, "sprigs"),
        ("thyme", "Spices and herbs", "fresh thyme", 0, "sprigs"),
        ("paprika", "Spices and herbs", "smoked paprika", 0, "tsp"),

        # Nuts and seeds
        ("almond", "Nuts and seeds", "almonds,badam", 1, "g"),
        ("cashew", "Nuts and seeds", "cashews,kaju", 1, "g"),
        ("peanut", "Nuts and seeds", "peanuts,moongphali", 1, "g"),
        ("walnut", "Nuts and seeds", "walnuts,akhrot", 0, "g"),
        ("sesame seeds", "Nuts and seeds", "til", 1, "tbsp"),
        ("chia seeds", "Nuts and seeds", "chia", 0, "tbsp"),

        # Fruits
        ("lemon", "Fruits", "lime,nimbu,lemon juice", 1, "pcs"),
        ("apple", "Fruits", "apples,seb", 1, "pcs"),
        ("banana", "Fruits", "bananas,kela", 1, "pcs"),
        ("coconut", "Fruits", "nariyal,shredded coconut,coconut milk", 1, "cups"),
        ("mango", "Fruits", "aam", 1, "pcs"),
        ("orange", "Fruits", "oranges,santre", 0, "pcs"),
        ("avocado", "Fruits", "avocados", 0, "pcs"),
        ("berries", "Fruits", "strawberries,blueberries", 0, "cups"),

        # Pantry staples
        ("oil", "Pantry staples", "vegetable oil,cooking oil,sunflower oil", 1, "tbsp"),
        ("olive oil", "Pantry staples", "extra virgin olive oil,evoo", 0, "tbsp"),
        ("salt", "Pantry staples", "table salt,kosher salt,sea salt,namak", 1, "tsp"),
        ("sugar", "Pantry staples", "white sugar,brown sugar,chini", 1, "tbsp"),
        ("vinegar", "Pantry staples", "apple cider vinegar,white vinegar", 0, "tbsp"),
        ("soy sauce", "Pantry staples", "dark soy sauce,light soy sauce", 0, "tbsp"),
        ("honey", "Pantry staples", "shahad", 1, "tbsp"),
        ("mustard oil", "Pantry staples", "sarson ka tel", 1, "tbsp")
    ]

    for name, cat, syn, is_ind, unit in common_ingredients_seed:
        rcnt = ingredient_counts.get(name, 0)
        cursor.execute("""
        INSERT OR REPLACE INTO ingredients_library (name, category, synonyms, recipe_count, is_indian, is_common, default_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (name, cat, syn, rcnt, is_ind, 1, unit))

    top_ingredients = sorted(ingredient_counts.items(), key=lambda x: x[1], reverse=True)[:300]
    for cname, cnt in top_ingredients:
        # Defense-in-depth: Never add prohibited items to ingredient library
        dummy_row = {"title": cname, "ingredients": cname}
        status, _, _ = classify_recipe(dummy_row)
        if status != "keep":
            continue

        cursor.execute("SELECT name FROM ingredients_library WHERE name = ?", (cname,))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO ingredients_library (name, category, synonyms, recipe_count, is_indian, is_common, default_unit)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (cname, "Pantry staples", "", cnt, 0, 1, "pcs"))

    conn.commit()

    cursor.execute("SELECT count(*) FROM recipes;")
    total_recipes = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM recipe_ingredients;")
    total_recipe_ingredients = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM ingredients_library;")
    total_lib = cursor.fetchone()[0]

    # Checkpoint and close WAL
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    conn.close()

    elapsed = time.time() - start_time
    print(f"\n=======================================================")
    print(f"SUCCESS: PantryMuse Database Ingestion Complete!")
    print(f"Total Unique Recipes Imported: {total_recipes:,}")
    print(f"Total Recipe Ingredient Links: {total_recipe_ingredients:,}")
    print(f"Ingredient Library Entries:    {total_lib:,}")
    print(f"Elapsed Time:                  {elapsed:.2f} seconds")
    print(f"Database Path:                 {DB_PATH.resolve()}")
    print(f"Database File Size:            {DB_PATH.stat().st_size / (1024*1024):.2f} MB")
    print(f"=======================================================\n")

if __name__ == "__main__":
    main()
