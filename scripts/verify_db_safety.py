#!/usr/bin/env python3
"""Comprehensive safety audit of data/pantrymuse.db"""
import sqlite3
import re
import sys
from pathlib import Path

# Ensure paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
for p in (str(ROOT_DIR), str(SCRIPT_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from sanitize_recipe_dataset import (
    BEEF_PATTERNS,
    ALCOHOL_PATTERN,
    EXPLICIT_SEXUAL_PATTERN,
    NON_BEEF_EXCLUSION_PATTERN,
    NON_ALCOHOL_EXCLUSION_PATTERN,
    DISALLOWED_MEAT_PATTERNS
)

db_path = ROOT_DIR / "data" / "pantrymuse.db"
if not db_path.exists():
    print(f"Error: {db_path} does not exist", file=sys.stderr)
    sys.exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

total_recipes = cursor.execute("SELECT COUNT(*) FROM recipes").fetchone()[0]
print(f"Total recipes in database: {total_recipes:,}")

violations = []
meat_counts = {"veg": 0, "chicken": 0, "pork": 0, "mutton": 0, "pigeon": 0}

cursor.execute("SELECT id, title, description, category, cuisine, ingredients_raw, directions_text, is_vegetarian FROM recipes")
for row in cursor.fetchall():
    r_id, title, desc, cat, cuisine, ing_raw, dirs, is_veg = row
    desc_str = desc or ""
    cat_str = cat or ""
    cuisine_str = cuisine or ""
    ing_str = ing_raw or ""
    dirs_str = dirs or ""
    all_text = f"{title} {desc_str} {cat_str} {cuisine_str} {ing_str} {dirs_str}"
    
    # 1. Explicit check
    if EXPLICIT_SEXUAL_PATTERN.search(all_text):
        violations.append(("explicit", r_id, title))
        
    # 2. Alcohol & wine check
    clean_alc = NON_ALCOHOL_EXCLUSION_PATTERN.sub(" ", all_text)
    if ALCOHOL_PATTERN.search(clean_alc):
        violations.append(("alcohol", r_id, title))
        
    # 3. Beef check
    clean_beef = NON_BEEF_EXCLUSION_PATTERN.sub(" ", all_text)
    if any(p.search(clean_beef) for p in BEEF_PATTERNS):
        violations.append(("beef", r_id, title))
        
    # 4. Disallowed meat check in ingredients
    ing_clean = NON_BEEF_EXCLUSION_PATTERN.sub(" ", ing_str)
    for d_name, d_pat in DISALLOWED_MEAT_PATTERNS.items():
        if d_pat.search(ing_clean):
            violations.append((f"disallowed_{d_name}", r_id, title))
            
    # Tally meats
    if is_veg:
        meat_counts["veg"] += 1
    if re.search(r"\b(chicken|hen|rooster|capon|poussin)\b", ing_clean, re.I):
        meat_counts["chicken"] += 1
    if re.search(r"\b(pork|bacon|ham|prosciutto|pancetta)\b", ing_clean, re.I):
        meat_counts["pork"] += 1
    if re.search(r"\b(mutton|lamb|goat)\b", ing_clean, re.I):
        meat_counts["mutton"] += 1
    if re.search(r"\b(pigeon|squab)\b", ing_clean, re.I):
        meat_counts["pigeon"] += 1

print("\n=======================================================")
print("PANTRYMUSE.DB COMPREHENSIVE SAFETY AUDIT")
print("=======================================================")
print(f"Total recipes checked:        {total_recipes:,}")
print(f"Safety violations found:      {len(violations)}")
if violations:
    print("Violations:", violations[:20])
    sys.exit(1)

print("PASSED: Exactly 0 beef recipes or ingredients!")
print("PASSED: Exactly 0 wine or alcoholic drinks/ingredients!")
print("PASSED: Exactly 0 cocktails or mixed alcoholic drinks!")
print("PASSED: Exactly 0 sexually explicit or pornographic content!")
print("PASSED: Exactly 0 disallowed seafood or other meats!")
print("\nActive Safe Recipe Portfolio:")
print(f"  - Vegetarian / Plant-based: {meat_counts['veg']:,}")
print(f"  - Chicken Poultry:          {meat_counts['chicken']:,}")
print(f"  - Pork:                     {meat_counts['pork']:,}")
print(f"  - Mutton / Lamb / Goat:     {meat_counts['mutton']:,}")
print(f"  - Pigeon / Squab:           {meat_counts['pigeon']:,}")
print("=======================================================\n")
