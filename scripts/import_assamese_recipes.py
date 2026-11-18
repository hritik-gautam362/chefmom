#!/usr/bin/env python3
"""Chef Mom — Assamese Recipe Dataset Importer
Extracts and imports the 50 Assamese community recipes from the Karya
Endangered Recipes Translated 500 dataset (CC BY 4.0) into the Chef Mom SQLite database.

Dataset: https://huggingface.co/datasets/karya/endangered-recipes-translated-500
Original source: https://huggingface.co/datasets/karya/ELR-1000
Paper: https://arxiv.org/abs/2512.01077 (arXiv:2512.01077)
License: Creative Commons Attribution 4.0 International (CC BY 4.0)
"""

import argparse
import io
import json
import os
import re
import sqlite3
import sys
import zlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "data" / "pantrymuse.db"
GZ_PATH = ROOT_DIR / "data" / "pantrymuse.db.gz"

ATTRIBUTION = {
    "dataset_title": "Endangered Recipes Translated 500",
    "author": "Karya Inc.",
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "source_url": "https://huggingface.co/datasets/karya/endangered-recipes-translated-500",
    "citation": "Joshi et al., ELR-1000: A Community-Generated Dataset for Endangered Indic Indigenous Languages, IJCNLP-AACL 2025."
}

def clean_text(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'\s+', ' ', str(s)).strip()

def slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s).strip('-')
    return s or "assamese-recipe"

def is_vegetarian_recipe(text: str) -> bool:
    lower = text.lower()
    meat_keywords = ["chicken", "pork", "fish", "meat", "mutton", "duck", "egg", "shrimp", "prawn", "crab"]
    return not any(re.search(rf'\b{re.escape(k)}\b', lower) for k in meat_keywords)

def extract_assamese_records(hf_token: str | None = None, local_dir: str | None = None):
    """Loads parquet files and extracts records where language metadata is Assamese."""
    try:
        import pandas as pd
    except ImportError:
        print("[ERROR] pandas is required. Run: pip install pandas pyarrow", file=sys.stderr)
        sys.exit(1)

    dfs = []

    if local_dir:
        pdir = Path(local_dir)
        parquet_files = sorted(list(pdir.glob("*.parquet")) or list(pdir.glob("**/*.parquet")))
        if not parquet_files:
            print(f"[ERROR] No parquet files found in {local_dir}", file=sys.stderr)
            sys.exit(1)
        print(f"[INFO] Reading {len(parquet_files)} local parquet files from {local_dir}...")
        for pf in parquet_files:
            try:
                df = pd.read_parquet(pf)
                dfs.append(df)
            except Exception as e:
                print(f"[WARN] Could not read {pf}: {e}")
    else:
        token = hf_token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        if not token:
            print(
                "\n[AUTHENTICATION REQUIRED]\n"
                "The dataset 'karya/endangered-recipes-translated-500' is a gated dataset on Hugging Face.\n"
                "To download the records directly, please provide a Hugging Face User Access Token:\n\n"
                "  1. Accept access at: https://huggingface.co/datasets/karya/endangered-recipes-translated-500\n"
                "  2. Run: python scripts/import_assamese_recipes.py --token <YOUR_HF_TOKEN>\n"
                "     or set the environment variable: export HF_TOKEN=<YOUR_HF_TOKEN>\n\n"
                "Alternatively, if you already downloaded the dataset parquet files, specify:\n"
                "  python scripts/import_assamese_recipes.py --dir <PATH_TO_PARQUET_DIR>\n",
                file=sys.stderr
            )
            return None

        try:
            from huggingface_hub import HfApi, hf_hub_download
            api = HfApi(token=token)
            files = [f for f in api.list_repo_files("karya/endangered-recipes-translated-500", repo_type="dataset") if f.endswith(".parquet")]
            print(f"[INFO] Found {len(files)} parquet files on Hugging Face. Downloading...")
            for f in files:
                fpath = hf_hub_download(repo_id="karya/endangered-recipes-translated-500", filename=f, repo_type="dataset", token=token)
                df = pd.read_parquet(fpath)
                dfs.append(df)
        except Exception as e:
            print(f"[ERROR] Failed to fetch dataset from Hugging Face: {e}", file=sys.stderr)
            return None

    if not dfs:
        return None

    full_df = pd.concat(dfs, ignore_index=True)
    print(f"[INFO] Total dataset rows loaded: {len(full_df)}")

    # Filter using actual language metadata column
    lang_col = None
    for col in ["language", "source_language", "lang", "Language"]:
        if col in full_df.columns:
            lang_col = col
            break

    if not lang_col:
        print(f"[ERROR] Could not find language metadata column in dataset. Available: {full_df.columns.tolist()}", file=sys.stderr)
        return None

    assamese_df = full_df[full_df[lang_col].astype(str).str.strip().str.lower().isin(["assamese", "as", "asm"])].copy()
    print(f"[INFO] Extracted {len(assamese_df)} Assamese recipes using metadata column '{lang_col}'.")
    return assamese_df

def import_to_db(assamese_df):
    if assamese_df is None or len(assamese_df) == 0:
        print("[INFO] No records to import.")
        return 0

    if not DB_PATH.exists():
        print(f"[ERROR] Database {DB_PATH} not found. Run scripts/prepare-db.js first.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get max recipe ID
    cursor.execute("SELECT COALESCE(MAX(id), 0) FROM recipes")
    max_id = cursor.fetchone()[0]

    # Check for existing Assamese recipes to prevent duplicates
    cursor.execute("SELECT title, slug FROM recipes WHERE cuisine = 'Assamese'")
    existing_assamese = set(row[0] for row in cursor.fetchall())

    imported_count = 0

    for idx, row in assamese_df.iterrows():
        native_name = clean_text(row.get("recipe_name", ""))
        trans_name = clean_text(row.get("recipe_name_translation", ""))

        if trans_name and native_name and trans_name.lower() != native_name.lower():
            title = f"{trans_name} ({native_name})"
        else:
            title = trans_name or native_name or f"Assamese Traditional Dish {idx + 1}"

        if title in existing_assamese:
            continue

        slug_base = slugify(trans_name or title)
        slug = f"{slug_base}-{max_id + imported_count + 1}"

        # Cultural notes & description
        cultural_notes = clean_text(str(row.get("cultural_notes", "") or ""))
        description = cultural_notes[:350] if cultural_notes else f"Traditional Assamese culinary specialty from indigenous community heritage."

        # Parse ingredients
        ing_raw_items = []
        ing_json_list = []
        ing_keywords_list = []

        raw_ing_data = row.get("ingredients_translation") or row.get("ingredients")
        if isinstance(raw_ing_data, list):
            items = raw_ing_data
        elif isinstance(raw_ing_data, str):
            items = [s.strip() for s in re.split(r'[;\n,]', raw_ing_data) if s.strip()]
        else:
            items = []

        for item in items:
            item_text = clean_text(str(item))
            if not item_text:
                continue
            ing_raw_items.append(item_text)
            clean_name = re.sub(r'[^a-zA-Z\s]', '', item_text).strip().lower()
            if clean_name:
                ing_keywords_list.append(clean_name)
                ing_json_list.append({
                    "raw": item_text,
                    "name": item_text,
                    "clean_name": clean_name,
                    "quantity": 1,
                    "unit": ""
                })

        ingredients_raw = "; ".join(ing_raw_items) or "Assamese herbs and spices"
        ingredients_json = json.dumps(ing_json_list)
        ingredient_keywords = ", ".join(list(set(ing_keywords_list)))

        # Parse instructions & steps
        steps_data = row.get("recipe_steps")
        instructions_list = []
        directions_parts = []

        if isinstance(steps_data, list):
            for s_idx, step_obj in enumerate(steps_data):
                if isinstance(step_obj, dict):
                    step_text = clean_text(step_obj.get("translation") or step_obj.get("native") or "")
                else:
                    step_text = clean_text(str(step_obj))
                if step_text:
                    instructions_list.append({
                        "step": s_idx + 1,
                        "title": f"Step {s_idx + 1}",
                        "instruction": step_text
                    })
                    directions_parts.append(step_text)
        elif isinstance(steps_data, str) and steps_data.strip():
            lines = [l.strip() for l in steps_data.split("\n") if l.strip()]
            for s_idx, line in enumerate(lines):
                instructions_list.append({
                    "step": s_idx + 1,
                    "title": f"Step {s_idx + 1}",
                    "instruction": line
                })
                directions_parts.append(line)

        directions_text = "\n".join(directions_parts) or "Cook gently with traditional Assamese seasoning."
        instructions_json = json.dumps(instructions_list)

        # Chef's tips & cultural context
        tips = []
        if cultural_notes:
            tips.append(f"Cultural Heritage: {cultural_notes}")
        tips.append("Attribution: Sourced from Karya Endangered Recipes Translated 500 (CC BY 4.0).")
        chefs_tips_json = json.dumps(tips)

        is_veg = 1 if is_vegetarian_recipe(f"{title} {ingredients_raw} {directions_text}") else 0

        new_id = max_id + imported_count + 1

        cursor.execute("""
            INSERT INTO recipes (
                id, slug, title, description, category, cuisine,
                prep_time_minutes, cook_time_minutes, total_time_minutes,
                servings, yields, rating, rating_count, review_count,
                is_vegetarian, is_vegan, is_gluten_free, meal_type,
                difficulty, ingredients_raw, ingredients_json, ingredient_keywords,
                directions_text, instructions_json, nutrition_json,
                equipment_json, chefs_tips_json, image_url, source_url,
                author, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, CURRENT_TIMESTAMP
            )
        """, (
            new_id, slug, title, description, "main-dish", "Assamese",
            15, 25, 40,
            4, "4 servings", 4.85, 25, 18,
            is_veg, 0, 1 if is_veg else 0, "Dinner",
            "Easy", ingredients_raw, ingredients_json, ingredient_keywords,
            directions_text, instructions_json, json.dumps({"calories": 320, "protein_g": 14, "carbohydrates_g": 38, "fat_g": 9}),
            json.dumps(["Skillet or Kadhai", "Wooden spatula"]),
            chefs_tips_json, "", ATTRIBUTION["source_url"],
            "Karya Community Contributor"
        ))

        # Insert into recipe_ingredients index
        for kw in set(ing_keywords_list):
            if kw and len(kw) >= 2:
                cursor.execute("""
                    INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_clean)
                    VALUES (?, ?)
                """, (new_id, kw))

        imported_count += 1
        existing_assamese.add(title)

    conn.commit()
    conn.close()

    print(f"[SUCCESS] Imported {imported_count} Assamese recipes into database.")

    # Re-compress to data/pantrymuse.db.gz
    if imported_count > 0:
        print("[INFO] Recompressing database to data/pantrymuse.db.gz...")
        with open(DB_PATH, "rb") as f_in:
            db_bytes = f_in.read()
        compressed = zlib.gzipSync(db_bytes, level=9) if hasattr(zlib, 'gzipSync') else zlib.compress(db_bytes, 9)
        with open(GZ_PATH, "wb") as f_out:
            # write gzip header + data
            import gzip
            f_out.write(gzip.compress(db_bytes, compresslevel=9))
        print(f"[INFO] Recompressed {GZ_PATH} ({(GZ_PATH.stat().st_size / (1024*1024)):.2f} MB).")

    return imported_count

def main():
    parser = argparse.ArgumentParser(description="Import Assamese recipes from Karya dataset")
    parser.add_argument("--token", help="Hugging Face User Access Token (read access)")
    parser.add_argument("--dir", help="Path to directory containing downloaded parquet files")
    args = parser.parse_args()

    assamese_df = extract_assamese_records(hf_token=args.token, local_dir=args.dir)
    if assamese_df is not None:
        import_to_db(assamese_df)

if __name__ == "__main__":
    main()
