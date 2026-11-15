#!/usr/bin/env python3
"""Filter PantryMuse recipes for safety, dietary compliance, and image moderation.

Default input:  data/raw/recipe.csv
Default output: data/processed/recipes_cleaned.csv

Filtering Rules:
1. BEEF & BOVINE:
   - Excludes all beef and beef-derived recipes (cuts, broths, stocks, extracts,
     bovine gelatin, tallow, fat, suet, bones, and international beef names).
2. ALCOHOL:
   - Completely excludes recipes that use alcoholic ingredients (red/white wine,
     cooking/rice wine, beer/ale/stout, spirits, liqueurs, sake, mirin, cocktails,
     ciders, or alcoholic references in cooking instructions).
   - Protects non-alcoholic vinegars (red/white wine vinegar, cider vinegar),
     soy sauce, and non-alcoholic items.
3. EXPLICIT CONTENT:
   - Filters sexually explicit and pornographic recipe submissions.
   - Routes ambiguous or borderline suggestive text to manual review.
   - Protects normal culinary terms (chicken breast, meatballs, hot sauce, virgin oil).
4. PRESERVED MEAT POLICY:
   - Allowed: Chicken, Mutton / Goat / Lamb, Pigeon / Squab, Pork, and Vegetarian.
   - Excluded: All other red meats, other poultry, and all seafood.
5. AMBIGUOUS INGREDIENTS:
   - Unidentified stocks/broths, unidentified gelatin, and unclear sausages/meats
     are routed to manual review.
6. IMAGE MODERATION:
   - Uses Falconsai/nsfw_image_detection (normal >= 0.95 required).
   - NSFW, uncertain, invalid (such as NaNname), or failed image scans fail closed.
   - Valid recipes with blocked images are kept with image URL blanked for safe fallback.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from io import BytesIO
from pathlib import Path
from typing import Any

MODEL_ID = "Falconsai/nsfw_image_detection"
SAFE_NORMAL_THRESHOLD = 0.95
BLOCK_NSFW_THRESHOLD = 0.50
MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_TIMEOUT_SECONDS = 20
USER_AGENT = "PantryMuse-Recipe-Safety-Audit/1.0"

# Approved HTTPS image host suffixes for source dataset
DEFAULT_ALLOWED_HOSTS = (
    "imagesvc.meredithcorp.io",
    "meredithcorp.io",
    "allrecipes.com",
)

# ---------------------------------------------------------------------------
# 1. NON-BEEF & NON-ALCOHOL FALSE POSITIVE PROTECTION
# ---------------------------------------------------------------------------
NON_BEEF_EXCLUSION_PATTERN = re.compile(
    r"\b(?:"
    r"beefsteak\s+tomato(?:es)?|"
    r"beefsteak\s+(?:plant|fungus|mushroom)|"
    r"(?:vegan|vegetarian|meatless|plant-based|mock)\s+beef"
    r")\b",
    re.I
)

NON_ALCOHOL_EXCLUSION_PATTERN = re.compile(
    r"\b(?:"
    r"apple\s+cider\s+vinegar|cider\s+vinegar|"
    r"pot\s+liquor|"
    r"ginger\s+ale|"
    r"kitchen\s+twine|butcher\s+twine|twine|"
    r"cream\s+of\s+tartar"
    r")\b",
    re.I
)

NON_SEAFOOD_EXCLUSION_PATTERN = re.compile(
    r"\b(?:"
    r"scalloped\s+(?:potatoes?|corn|cabbage|tomatoes?)|"
    r"(?:king\s+)?oyster\s+mushrooms?|"
    r"oyster\s+crackers?|"
    r"untuna|"
    r"musselman(?:\x27s)?"
    r")\b",
    re.I
)

# ---------------------------------------------------------------------------
# 2. BEEF & BOVINE DETECTION PATTERNS
# ---------------------------------------------------------------------------
BEEF_PATTERNS: list[re.Pattern[str]] = [
    # Direct beef names and common ground / roast / cured forms
    re.compile(r"\b(beef|beefs|beefy|all-beef|beefaroni|beefstick|ground\s+beef|roast\s+beef|corned\s+beef)\b", re.I),
    re.compile(r"\bbeefsteak\b", re.I),

    # Beef broth, stock, extract, base, bouillon, gravy, bones, marrow
    re.compile(
        r"\bbeef\s+(?:broth|stock|bouillon|consomm[eé]|base|extract|gravy|dripping[s]?|"
        r"flavor(?:ing)?|seasoning|paste|powder|cube|cubes|bones?|marrow)\b",
        re.I
    ),

    # Beef & bovine fats, gelatins, tissues, organs
    re.compile(
        r"\b(?:beef|bovine)\s+(?:fat|tallow|suet|dripping|gelatin|collagen|protein|"
        r"peptide[s]?|serum|plasma|extract|bone[s]?|marrow|tripe|kidney[s]?|heart[s]?|"
        r"tongue[s]?|liver[s]?)\b",
        re.I
    ),

    # Any explicit bovine ingredient
    re.compile(r"\bbovine\b", re.I),

    # Oxtail, ox tail, ox cheek, ox tongue
    re.compile(r"\b(?:ox\s*tails?|oxtails?|ox\s*cheeks?|ox\s*tongue)\b", re.I),

    # Clearly identified beef cuts (using negative lookbehinds for non-beef cuts)
    re.compile(r"\b(?:ribeye|rib-eye|rib\s+eye)(?:\s+steaks?)?\b", re.I),
    re.compile(r"\bt-bones?(?:\s+steaks?)?\b", re.I),
    re.compile(r"\bporterhouses?(?:\s+steaks?)?\b", re.I),
    re.compile(r"\bfilet\s+mignons?\b", re.I),
    re.compile(r"\bchateaubriand\b", re.I),
    re.compile(r"\bprime\s+ribs?\b", re.I),
    re.compile(r"\b(?:new\s+york|ny|kansas\s+city)\s+strips?(?:\s+steaks?)?\b", re.I),
    re.compile(r"\blondon\s+broil\b", re.I),
    re.compile(r"(?<!pork\s)(?<!chicken\s)(?<!turkey\s)\b(?:flank|skirt|hanger|flat\s+iron|strip|cube|minute|salisbury|swiss)\s+steaks?\b", re.I),
    re.compile(r"\b(?:chicken[- ]fried|country[- ]fried)\s+steaks?\b", re.I),
    re.compile(r"\b(?:philly\s+)?cheesesteaks?\b", re.I),
    re.compile(r"(?<!pork\s)(?<!lamb\s)(?<!veal\s)\b(?:chuck\s+roast|rump\s+roast|pot\s+roast|tri-tip|tri\s+tip)\b", re.I),
    re.compile(r"(?<!pork\s)(?<!chicken\s)(?<!turkey\s)(?<!duck\s)(?<!venison\s)\bbriskets?\b", re.I),
    re.compile(r"(?<!pork\s)(?<!lamb\s)\bshort\s+ribs?\b", re.I),
    re.compile(r"(?<!pork\s)(?<!chicken\s)(?<!turkey\s)\b(?:top\s+|bottom\s+)?sirloins?(?:\s+steaks?|\s+roasts?|\s+tips?)?\b", re.I),
    re.compile(r"(?<!turkey\s)(?<!chicken\s)(?<!duck\s)(?<!venison\s)\bpastrami\b", re.I),
    re.compile(r"\b(?:angus|black\s+angus)\b", re.I),

    # Common international beef ingredient names
    re.compile(r"\bcarne\s+asada\b", re.I),
    re.compile(r"\bwagyu\b", re.I),
    re.compile(r"\bkobe\s+(?:beef|steak)\b", re.I),
    re.compile(r"\bbistecca(?:\s+alla\s+fiorentina)?\b", re.I),
    re.compile(r"\bb[oœ]uf(?:\s+bourguignon)?\b", re.I),
    re.compile(r"\bmanzo\b", re.I),
    re.compile(r"\bcarne\s+(?:de\s+)?res\b", re.I),
    re.compile(r"\b(?:rindfleisch|rinderhack|rinderbraten)\b", re.I),
    re.compile(r"\bbresaola\b", re.I),
    re.compile(r"\b(?:basturma|pastirma)\b", re.I),
    re.compile(r"\bcalves\s+(?:liver|feet|foot)\b", re.I),
    re.compile(r"\bcalf\s+(?:liver|feet|foot)\b", re.I),
]

# ---------------------------------------------------------------------------
# 3. ALCOHOL DETECTION PATTERNS
# ---------------------------------------------------------------------------
ALCOHOL_PATTERN = re.compile(
    r"\b(?:"
    # Standalone wine or wine of any kind
    r"(?:\w+\s+)?wine[s]?|"
    r"wine\s+(?:sauce|reduction|glaze|cork|yeast)|"
    # Specific wine varieties & regions
    r"red\s+wine|white\s+wine|cooking\s+wine|rice\s+wine|shaoxing(?:\s+wine)?|shaohsing(?:\s+wine)?|"
    r"dry\s+white(?:\s+wine)?|dry\s+red(?:\s+wine)?|sweet\s+wine|dessert\s+wine|mulled\s+wine|"
    r"marsala(?:\s+wine)?|sherry(?:\s+wine)?|port(?:\s+wine)?|vermouth|madeira(?:\s+wine)?|"
    r"champagne|prosecco|cava|sparkling\s+wine|chianti|merlot|cabernet(?:\s+sauvignon)?|"
    r"pinot\s+(?:noir|grigio)|chardonnay|sauvignon\s+blanc|riesling|moscato|zinfandel|rioja|bordeaux|ros[eé]\s+wine|"
    # Beers, ales & malts
    r"beer|beers|root\s+beer|butterbeer|ginger\s+beer|birch\s+beer|lager|lagers|ale|ales|stout|stouts|pilsner|pils|porter\s+beer|ipa|pale\s+ale|guinness|malt\s+liquor|"
    # Spirits, liquors & proof alcohol
    r"whiskey|whisky|bourbon|scotch|rye\s+whiskey|vodka|rum|dark\s+rum|white\s+rum|spiced\s+rum|rum\s+extract|brandy\s+extract|bourbon\s+extract|"
    r"gin|tequila|mezcal|brandy|cognac|armagnac|calvados|grappa|pisco|eau\s+de\s+vie|"
    r"sake|mirin|soju|ouzo|arak|pastis|sambuca|absinthe|campari|aperol|"
    r"grain\s+alcohol|everclear|moonshine|\d+\s+proof|"
    r"alcohol|alcoholic|booze|boozy|distilled\s+spirits?|hard\s+liquor|liquors?|"
    # Liqueurs, schnapps & cordials
    r"liqueur|liqueurs|schnapps|amaretto|kahl[uú]a|baileys|triple\s+sec|cointreau|grand\s+marnier|"
    r"cura[cç]ao|limoncello|frangelico|drambuie|chartreuse|cr[eè]me\s+de\s+(?:menthe|cacao|cassis)|chambord|rumchata|"
    # Hard ciders, cocktails & mixed drinks
    r"hard\s+cider|hard\s+seltzer|cocktail|cocktails|mocktail|mocktails|margarita|margaritas|martini|martinis|mojito|mojitos|sangria|sangrias|"
    r"daiquiri|daiquiris|pi[nñ]a\s+colada|cosmopolitan|cosmopolitans|bloody\s+mary|bellini|mimosa|mimosas|"
    r"mint\s+juleps?|moscow\s+mule|mai\s+tai|long\s+island\s+iced\s+tea|mudslide|sidecar|hot\s+toddy|irish\s+coffee|jungle\s+juice|"
    r"paloma|gimlet|caipirinha|jager\s*bomb|manhattan\s+cocktail|true\s+manhattan|southern\s+comfort\s+manhattan|"
    r"old\s+fashioned\s+cocktail|classic\s+old\s+fashioned"
    r")\b",
    re.I
)

# ---------------------------------------------------------------------------
# 4. EXPLICIT SEXUAL TEXT FILTERING PATTERNS
# ---------------------------------------------------------------------------
EXPLICIT_SEXUAL_PATTERN = re.compile(
    r"\b(?:"
    r"porn|pornography|porno|blowjob|handjob|cumshot|deepthroat|threesome|gangbang|"
    r"cunnilingus|fellatio|dildo|vibrator|masturbat(?:e|ion|ing)|penis|vagina|clitoris|"
    r"anal\s+sex|oral\s+sex|intercourse|sex\s+toy|hardcore\s+sex|"
    r"sex\b|sexy\b|slut|sl\*t|nipple[s]?"
    r")\b",
    re.I
)

SUGGESTIVE_TEXT_PATTERN = re.compile(
    r"\b(?:"
    r"aphrodisiac|erotic|horny|orgasmic|orgasm|sensual|kinky|erogenous"
    r")\b",
    re.I
)

# ---------------------------------------------------------------------------
# 5. MEAT POLICY: ALLOWED & DISALLOWED PATTERNS
# ---------------------------------------------------------------------------
ALLOWED_MEAT_PATTERNS: dict[str, re.Pattern[str]] = {
    "chicken": re.compile(r"\b(chicken|hen|rooster|capon|poussin|cornish\s+hen)\b", re.I),
    "mutton": re.compile(r"\b(mutton|lamb|goat|chevon|sheep)\b", re.I),
    "pigeon": re.compile(r"\b(pigeon|squab)\b", re.I),
    "pork": re.compile(
        r"\b(pork|bacon|ham|prosciutto|pancetta|gammon|guanciale|lard|pork\s+belly|"
        r"pork\s+chop|pork\s+loin|pork\s+roast|pork\s+shoulder|pork\s+ribs?|spareribs?)\b",
        re.I
    ),
}

DISALLOWED_MEAT_PATTERNS: dict[str, re.Pattern[str]] = {
    "other_red_meat": re.compile(
        r"\b(veal|bison|buffalo\s+meat|water\s+buffalo|venison|deer|elk|moose|kangaroo|horse|camel)\b",
        re.I
    ),
    "other_poultry": re.compile(
        r"\b(turkey|duck|goose|geese|quail|pheasant|guinea\s+fowl|ostrich|emu|partridge|grouse)\b",
        re.I
    ),
    "seafood": re.compile(
        r"\b(fish(?:es|cake|cakes|sauce|ball|balls|stick|sticks|meal)?|fish\s+sauce|"
        r"salmon|tuna|cod|halibut|trout|sardine|sardines|anchov(?:y|ies)|seafood|"
        r"shrimp|shrimps|prawn|prawns|"
        r"crab(?:s|meat|cake|cakes)?|crabbies|krab|krabby|"
        r"lobster(?:s|meat)?|"
        r"oyster(?:s|sauce)?|oyster\s+sauce|"
        r"mussel(?:s)?|"
        r"clam(?:s|ato)?|clam\s+juice|"
        r"scallop|scallops|"
        r"squid(?:s)?|calamari|octopus|eel|"
        r"mahi\s+mahi|tilapia|bass|snapper|swordfish|catfish|mackerel|haddock|caviar|roe|surimi|"
        r"flounder|walleye|grouper|rockfish|perch|conch|crawfish|crayfish|monkfish|bluefish|pike|whitefish|sole|"
        r"carp|pollock|barramundi|scup|pompano|smelt|herring|scampi|shellfish|mollusk|crustacean)\b",
        re.I
    ),
    "other_meat": re.compile(r"\b(rabbit|hare|wild\s+boar|boar|frog|alligator|crocodile|snail|escargot)\b", re.I),
}

# Ambiguous animal stocks, unidentified gelatins, and unclear meat ingredients
AMBIGUOUS_PROTEIN_PATTERN = re.compile(
    r"\b(sausage|sausages|hot\s*dogs?|frankfurters?|salami|pepperoni|bologna|chorizo|kielbasa|andouille|bratwurst|"
    r"meatballs?|meat\s*loaf|meatloaf|ground\s+meat|minced\s+meat|mince|stew\s+meat|mixed\s+meat|"
    r"broth|stock|bouillon|consomm[eé]|demi-glace|gelatin|animal\s+fat|animal\s+rennet|suet|tallow|drippings|"
    r"meat\s+extract|meat\s+base|meat\s+flavor(?:ing)?)\b",
    re.I
)

# Recognised specified broths, stocks, and meats that are NOT ambiguous
KNOWN_SPECIFIED_CLEAR_PATTERNS = [
    # Allowed broths/stocks/bouillons
    r"\bchicken\s+(?:bone\s+)?(?:broth|stock|bouillon|base)\b",
    r"\bmutton\s+(?:broth|stock|bouillon)\b",
    r"\blamb\s+(?:broth|stock|bouillon)\b",
    r"\bgoat\s+(?:broth|stock|bouillon)\b",
    r"\bpork\s+(?:broth|stock|bouillon)\b",
    r"\bpigeon\s+(?:broth|stock)\b",
    # Vegetarian broths/stocks/bouillons
    r"\bvegetable\s+(?:broth|stock|bouillon|base)\b",
    r"\bmushroom\s+(?:broth|stock|bouillon)\b",
    r"\bonion\s+(?:broth|stock)\b",
    r"\b(?:vegan|vegetarian)\s+(?:broth|stock|bouillon|base)\b",
    # Specified allowed sausages & meats
    r"\bchicken\s+sausages?\b",
    r"\bpork\s+sausages?\b",
    r"\bchicken\s+meatballs?\b",
    r"\bpork\s+meatballs?\b",
    r"\b(?:vegan|vegetarian)\s+(?:sausages?|meatballs?)\b",
    # Plant-based gelatin substitutes
    r"\b(?:agar|agar-agar|agar\s+agar|pectin|carrageenan)\b",
    r"\bpork\s+gelatin\b",
]


def is_valid_image_url(url: str | None) -> bool:
    """Return True if url is a well-formed HTTP(S) image URL.
    
    Treats invalid values like 'NaNname', 'nan', 'none', empty strings,
    or non-http strings as missing images, never as downloadable URLs.
    """
    if not url:
        return False
    u = str(url).strip()
    if not u or u.lower() in {"nan", "nanname", "none", "null", "undefined", "false", "0"}:
        return False
    try:
        parsed = urllib.parse.urlparse(u)
        return parsed.scheme in ("https", "http") and bool(parsed.netloc)
    except Exception:
        return False


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def safe_host(host: str | None, allow_hosts: list[str]) -> bool:
    if not host:
        return False
    h = host.lower().rstrip(".")
    return any(h == allowed or h.endswith("." + allowed) for allowed in allow_hosts)


def fetch_image_bytes(url: str, allow_hosts: list[str]) -> bytes:
    if not is_valid_image_url(url):
        raise ValueError("invalid_or_missing_image_url")

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not safe_host(parsed.hostname, allow_hosts):
        raise ValueError("untrusted_image_host_or_non_https")

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=IMAGE_TIMEOUT_SECONDS) as response:
        final_url = urllib.parse.urlparse(response.geturl())
        if final_url.scheme != "https" or not safe_host(final_url.hostname, allow_hosts):
            raise ValueError("redirected_to_untrusted_host")
        content_type = (response.headers.get("Content-Type") or "").lower()
        if not content_type.startswith("image/"):
            raise ValueError(f"not_an_image_content_type:{content_type or 'missing'}")
        data = response.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("image_exceeds_8mb_limit")
        if not data:
            raise ValueError("empty_image")
        return data


def classify_recipe(row: dict[str, str]) -> tuple[str, list[str], list[str]]:
    """Classify a recipe according to safety, alcohol, beef, and meat policies."""
    all_text = " ".join((row.get(k) or "") for k in (
        "title", "description", "ingredients", "directions", "instructions_list", "category", "author", "yields"
    ))

    # 1. EXPLICIT CONTENT FILTERING
    if EXPLICIT_SEXUAL_PATTERN.search(all_text):
        return "exclude_explicit", ["explicit_sexual_content"], []

    # 2. ALCOHOL FILTERING (Checked across all text fields including directions)
    clean_alcohol_text = NON_ALCOHOL_EXCLUSION_PATTERN.sub(" ", all_text)
    if ALCOHOL_PATTERN.search(clean_alcohol_text):
        return "exclude_alcohol", ["contains_alcohol"], []

    # 3. BEEF & BOVINE FILTERING (Checked across all text fields)
    clean_beef_text = NON_BEEF_EXCLUSION_PATTERN.sub(" ", all_text)
    if any(p.search(clean_beef_text) for p in BEEF_PATTERNS):
        return "exclude_beef", ["beef_or_beef_ingredient"], []

    # 4. CATEGORY SEAFOOD EXCLUSION
    category_lower = (row.get("category") or "").strip().lower()
    if category_lower == "seafood":
        return "exclude_not_on_meat_allowlist", ["disallowed_seafood"], []

    # 5. PROTEIN & DISALLOWED MEATS CLASSIFICATION (Title + Ingredients)
    protein_text = " ".join((row.get(k) or "") for k in ("title", "ingredients"))
    protein_text = NON_BEEF_EXCLUSION_PATTERN.sub(" ", protein_text)
    clean_disallowed_text = NON_SEAFOOD_EXCLUSION_PATTERN.sub(" ", protein_text)

    allowed = [name for name, pattern in ALLOWED_MEAT_PATTERNS.items() if pattern.search(protein_text)]
    disallowed = [name for name, pattern in DISALLOWED_MEAT_PATTERNS.items() if pattern.search(clean_disallowed_text)]

    # 6. AMBIGUOUS INGREDIENTS & SUGGESTIVE TEXT
    reasons: list[str] = []
    if SUGGESTIVE_TEXT_PATTERN.search(all_text):
        reasons.append("suggestive_or_borderline_text")

    ambiguous_text = protein_text
    for clear_pattern in KNOWN_SPECIFIED_CLEAR_PATTERNS:
        ambiguous_text = re.sub(clear_pattern, " ", ambiguous_text, flags=re.I)
    if AMBIGUOUS_PROTEIN_PATTERN.search(ambiguous_text):
        reasons.append("ambiguous_meat_or_stock_ingredient")

    if disallowed:
        return "exclude_not_on_meat_allowlist", [f"disallowed_{x}" for x in disallowed], allowed
    if reasons:
        return "manual_review", reasons, allowed

    # 7. KEPT RECIPES (Chicken, Mutton, Pigeon, Pork, or Vegetarian)
    return "keep", [], allowed


def load_classifier():
    try:
        import torch
        from PIL import Image
        from transformers import pipeline
    except ImportError as exc:
        raise RuntimeError(
            "Image screening dependencies are missing. Install with: "
            "pip install torch transformers pillow"
        ) from exc
    device = 0 if torch.cuda.is_available() else -1
    classifier = pipeline("image-classification", model=MODEL_ID, device=device)
    return classifier, Image


def classify_image(url: str, classifier: Any, Image: Any, allow_hosts: list[str]) -> dict[str, Any]:
    if not is_valid_image_url(url):
        return {"status": "missing_image", "normal_score": None, "nsfw_score": None, "error": "invalid_url"}

    try:
        payload = fetch_image_bytes(url, allow_hosts)
        image = Image.open(BytesIO(payload)).convert("RGB")
        predictions = classifier(image, top_k=None)
        scores = {str(p.get("label", "")).lower(): float(p.get("score", 0.0)) for p in predictions}
        normal_score = scores.get("normal", 0.0)
        nsfw_score = scores.get("nsfw", 0.0)
        if normal_score >= SAFE_NORMAL_THRESHOLD and nsfw_score <= (1.0 - SAFE_NORMAL_THRESHOLD + 1e-6):
            status = "safe_model_pass"
        elif nsfw_score >= BLOCK_NSFW_THRESHOLD:
            status = "blocked_nsfw"
        else:
            status = "manual_review"
        return {"status": status, "normal_score": normal_score, "nsfw_score": nsfw_score, "error": ""}
    except Exception as exc:
        return {"status": "scan_failed_or_untrusted", "normal_score": None, "nsfw_score": None,
                "error": str(exc)[:300]}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    csv.field_size_limit(min(sys.maxsize, 100_000_000))
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise RuntimeError("Input CSV has no header row")
        rows = list(reader)
        return list(reader.fieldnames), rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def run_automated_tests() -> bool:
    """Automated tests covering all required filtering policies and edge cases."""
    test_cases: list[dict[str, Any]] = [
        # --- 1. BEEF & BEEF DERIVATIVES (MUST BE EXCLUDE_BEEF) ---
        {
            "name": "Ground Beef Tacos",
            "row": {"title": "Classic Beef Tacos", "ingredients": "1 lb ground beef ; taco shells", "directions": "Cook beef."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Braised Oxtail",
            "row": {"title": "Jamaican Oxtail", "ingredients": "2 lbs oxtails ; allspice ; thyme", "directions": "Braise oxtails."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Grilled Ribeye Steak",
            "row": {"title": "Cast Iron Ribeye", "ingredients": "1 ribeye steak ; butter ; garlic", "directions": "Sear ribeye."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Beef Broth French Onion Soup",
            "row": {"title": "French Onion Soup", "ingredients": "onions ; 4 cups beef broth ; gruyere", "directions": "Simmer in beef broth."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Belgian Fries in Beef Tallow",
            "row": {"title": "Tallow Fries", "ingredients": "potatoes ; beef tallow for frying ; salt", "directions": "Fry in beef tallow."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Gummies with Bovine Gelatin",
            "row": {"title": "Gummy Candy", "ingredients": "fruit juice ; 2 tbsp bovine gelatin", "directions": "Dissolve bovine gelatin."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Mexican Carne Asada Tacos",
            "row": {"title": "Carne Asada Tacos", "ingredients": "flank steak ; lime juice ; cilantro", "directions": "Grill carne asada."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Cast Iron Ribeye Steaks (Plural)",
            "row": {"title": "Pan-Seared Ribeye Steaks", "ingredients": "2 ribeye steaks ; rosemary ; butter", "directions": "Sear steaks."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Chicken-Fried Steak with Cube Steaks",
            "row": {"title": "Southern Chicken-Fried Steak", "ingredients": "4 cube steaks ; flour ; oil ; milk", "directions": "Fry cube steaks."},
            "expected_status": "exclude_beef", "expected_tags": []
        },
        {
            "name": "Philly Cheesesteak Sandwich",
            "row": {"title": "Philly Cheesesteak", "ingredients": "hoagie rolls ; provolone ; thinly sliced ribeye", "directions": "Grill beef and onions."},
            "expected_status": "exclude_beef", "expected_tags": []
        },

        # --- 2. ALCOHOL DETECTION (MUST BE EXCLUDE_ALCOHOL) ---
        {
            "name": "Coq au Vin with Red Wine",
            "row": {"title": "Coq au Vin", "ingredients": "chicken thighs ; 2 cups red wine ; mushrooms", "directions": "Braise chicken in red wine."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Risotto with Dry White Wine",
            "row": {"title": "Mushroom Risotto", "ingredients": "arborio rice ; 1/2 cup white wine ; vegetable stock", "directions": "Deglaze rice with white wine."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Beer Battered Chicken Tenders",
            "row": {"title": "Beer Battered Chicken", "ingredients": "chicken breast ; 1 cup beer ; flour", "directions": "Dip chicken in beer batter."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Stout Glazed Pork Chops",
            "row": {"title": "Stout Pork Chops", "ingredients": "pork chops ; 1 cup stout ; brown sugar", "directions": "Simmer pork chops in stout."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Bourbon Glazed Salmon",
            "row": {"title": "Bourbon Salmon", "ingredients": "salmon ; 2 tbsp bourbon ; maple syrup", "directions": "Baste with bourbon."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Penne alla Vodka",
            "row": {"title": "Penne Vodka", "ingredients": "penne ; heavy cream ; tomato sauce ; 1/4 cup vodka", "directions": "Simmer vodka in tomato sauce."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Tequila Lime Grilled Chicken",
            "row": {"title": "Tequila Lime Chicken", "ingredients": "chicken breasts ; 2 oz tequila ; lime juice", "directions": "Marinate in tequila and lime."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Bananas Foster with Rum",
            "row": {"title": "Bananas Foster", "ingredients": "bananas ; butter ; brown sugar ; 1/4 cup dark rum", "directions": "Flambé with rum."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Steak Dianne with Brandy / Cognac",
            "row": {"title": "Pork Diane with Cognac", "ingredients": "pork loin ; shallots ; 2 tbsp cognac ; cream", "directions": "Flambé with cognac."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Poached Pears in Champagne",
            "row": {"title": "Champagne Pears", "ingredients": "pears ; 1 bottle champagne ; sugar ; cinnamon", "directions": "Poach pears in champagne."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Chicken Marsala",
            "row": {"title": "Chicken Marsala", "ingredients": "chicken cutlets ; mushrooms ; 1/2 cup marsala wine", "directions": "Simmer in marsala wine."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Japanese Teriyaki with Mirin and Sake",
            "row": {"title": "Chicken Teriyaki", "ingredients": "chicken thighs ; soy sauce ; 2 tbsp mirin ; 1 tbsp sake", "directions": "Glaze with mirin and sake."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Tiramisu with Coffee Liqueur",
            "row": {"title": "Classic Tiramisu", "ingredients": "mascarpone ; ladyfingers ; espresso ; 2 tbsp kahlua liqueur", "directions": "Dip ladyfingers in espresso and kahlua."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Braised Pork in Hard Cider",
            "row": {"title": "Hard Cider Pork Stew", "ingredients": "pork shoulder ; 2 cups hard cider ; apples", "directions": "Simmer in hard cider."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Dandelion Wine (Wine of Any Kind)",
            "row": {"title": "Dandelion Wine", "ingredients": "dandelion blossoms ; water ; sugar ; wine yeast", "directions": "Let the wine ferment."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Tomato Sauce with Burgundy Wine",
            "row": {"title": "Rich Tomato Sauce", "ingredients": "tomatoes ; garlic ; 1/2 cup burgundy wine", "directions": "Simmer with burgundy."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "High Proof Grain Alcohol / Moonshine",
            "row": {"title": "Apple Pie Moonshine", "ingredients": "apple cider ; cinnamon ; 1 bottle 190 proof grain alcohol", "directions": "Mix with grain alcohol."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Classic Margarita Cocktail",
            "row": {"title": "Classic Margarita", "ingredients": "tequila ; triple sec ; lime juice ; coarse salt", "directions": "Shake with ice and strain into glass."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Mint Julep Cocktail",
            "row": {"title": "Mint Julep Cocktail", "ingredients": "mint leaves ; bourbon whiskey ; simple syrup ; crushed ice", "directions": "Muddle mint and top with bourbon."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "RumChata Liqueur Dessert",
            "row": {"title": "RumChata Pudding", "ingredients": "vanilla pudding mix ; milk ; 1/2 cup RumChata liqueur", "directions": "Whisk pudding with rumchata."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Hidden Alcohol in Directions (Deglaze with Wine)",
            "row": {"title": "Savory Skillet Chicken", "ingredients": "chicken breasts ; olive oil ; garlic ; rosemary", "directions": "Sear chicken, then deglaze the skillet with 1/2 cup dry white wine."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },

        # --- 3. WINE VINEGARS & ALCOHOL DERIVATIVES EXCLUSION ---
        {
            "name": "Salad Dressing with Red Wine Vinegar (Excluded Wine Vinegar)",
            "row": {"title": "House Vinaigrette", "ingredients": "olive oil ; 2 tbsp red wine vinegar ; dijon mustard ; garlic", "directions": "Whisk red wine vinegar and olive oil."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Cucumber Salad with White Wine Vinegar (Excluded Wine Vinegar)",
            "row": {"title": "Cucumber Salad", "ingredients": "cucumbers ; 3 tbsp white wine vinegar ; dill ; salt", "directions": "Toss cucumbers in white wine vinegar."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Asian Slaw with Rice Wine Vinegar and Soy Sauce (Excluded Wine Vinegar)",
            "row": {"title": "Sesame Cabbage Slaw", "ingredients": "cabbage ; 2 tbsp rice wine vinegar ; 1 tbsp soy sauce ; sesame oil", "directions": "Toss with rice wine vinegar."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Root Beer Float (Excluded Beer)",
            "row": {"title": "Root Beer Float", "ingredients": "vanilla ice cream ; 1 bottle root beer", "directions": "Pour root beer over ice cream."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Roast Chicken with Apple Cider Vinegar Glaze (Allowed Pure Fruit Vinegar)",
            "row": {"title": "Glazed Roast Chicken", "ingredients": "chicken thighs ; 2 tbsp apple cider vinegar ; honey", "directions": "Glaze with apple cider vinegar."},
            "expected_status": "keep", "expected_tags": ["chicken"]
        },
        {
            "name": "Braised Collard Greens with Pot Liquor (Allowed Southern Term)",
            "row": {"title": "Braised Collard Greens", "ingredients": "collard greens ; apple cider vinegar ; garlic ; salt", "directions": "The pot liquor is delicious served with corn bread."},
            "expected_status": "keep", "expected_tags": []
        },

        # --- 4. EXPLICIT TEXT FILTERING ---
        {
            "name": "Recipe with Explicit Pornographic Joke Text",
            "row": {"title": "Troll Recipe", "ingredients": "sugar ; flour ; explicit blowjob reference", "directions": "Mix together."},
            "expected_status": "exclude_explicit", "expected_tags": []
        },
        {
            "name": "Recipe Linking to Pornographic Site",
            "row": {"title": "Spam Dish", "ingredients": "pasta ; cheese ; visit our hardcore porno link", "directions": "Bake."},
            "expected_status": "exclude_explicit", "expected_tags": []
        },
        {
            "name": "Better Than Sex Cake (Explicit Sexual Word in Title)",
            "row": {"title": "Better Than Sex Cake II", "ingredients": "devil's food cake mix ; condensed milk ; caramel topping ; toffee bits", "directions": "Bake cake and poke holes."},
            "expected_status": "exclude_explicit", "expected_tags": []
        },
        {
            "name": "Sex-In-A-Pan Layered Dessert (Explicit Sexual Word)",
            "row": {"title": "Sex-In-A-Pan", "ingredients": "flour ; butter ; pecans ; cream cheese ; chocolate pudding", "directions": "Layer ingredients in pan."},
            "expected_status": "exclude_explicit", "expected_tags": []
        },
        {
            "name": "Slippery Nipples Drink (Explicit Anatomical Slang)",
            "row": {"title": "Slippery Nipples", "ingredients": "sambuca ; baileys irish cream", "directions": "Layer sambuca and irish cream."},
            "expected_status": "exclude_explicit", "expected_tags": []
        },
        {
            "name": "Suggestive / Double-Entendre Text (Manual Review)",
            "row": {"title": "Sensual Aphrodisiac Chocolate Truffles", "ingredients": "dark chocolate ; cream ; chili", "directions": "Enjoy this seductive treat."},
            "expected_status": "manual_review", "expected_tags": []
        },

        # --- 5. NORMAL CULINARY TERM FALSE-POSITIVE PROTECTION ---
        {
            "name": "Pan-seared Chicken Breast (Normal Cooking Term)",
            "row": {"title": "Herb Chicken Breast", "ingredients": "2 chicken breasts ; olive oil ; salt", "directions": "Sear chicken breast."},
            "expected_status": "keep", "expected_tags": ["chicken"]
        },
        {
            "name": "Spaghetti with Pork Meatballs (Normal Cooking Term)",
            "row": {"title": "Spaghetti with Pork Meatballs", "ingredients": "spaghetti ; tomato sauce ; pork meatballs", "directions": "Simmer pork meatballs."},
            "expected_status": "keep", "expected_tags": ["pork"]
        },
        {
            "name": "Buffalo Wings with Extra Hot Sauce (Normal Cooking Term)",
            "row": {"title": "Spicy Buffalo Wings", "ingredients": "chicken wings ; butter ; 1/2 cup hot sauce", "directions": "Toss wings in hot sauce."},
            "expected_status": "keep", "expected_tags": ["chicken"]
        },
        {
            "name": "Salad with Extra Virgin Olive Oil (Normal Cooking Term)",
            "row": {"title": "Greek Salad", "ingredients": "tomatoes ; cucumbers ; extra virgin olive oil ; oregano", "directions": "Drizzle with virgin olive oil."},
            "expected_status": "keep", "expected_tags": []
        },
        {
            "name": "Roasted Cauliflower with Beefsteak Tomato (Normal Cooking Term)",
            "row": {"title": "Roasted Cauliflower", "ingredients": "cauliflower florets ; 2 beefsteak tomatoes ; olive oil", "directions": "Roast with beefsteak tomato."},
            "expected_status": "keep", "expected_tags": []
        },

        # --- 6. PRESERVED MEAT POLICY (ALLOWED, EXCLUDED, AMBIGUOUS) ---
        {
            "name": "Mutton Biryani (Allowed Mutton)",
            "row": {"title": "Mutton Biryani", "ingredients": "500g mutton ; basmati rice ; spices", "directions": "Cook mutton with rice."},
            "expected_status": "keep", "expected_tags": ["mutton"]
        },
        {
            "name": "Slow-cooked Goat Curry (Allowed Goat)",
            "row": {"title": "Goat Curry", "ingredients": "1 lb goat meat ; onions ; garlic ; ginger", "directions": "Simmer goat gently."},
            "expected_status": "keep", "expected_tags": ["mutton"]
        },
        {
            "name": "Roast Squab / Pigeon (Allowed Pigeon)",
            "row": {"title": "Roast Squab", "ingredients": "2 squab ; butter ; garlic", "directions": "Roast squab."},
            "expected_status": "keep", "expected_tags": ["pigeon"]
        },
        {
            "name": "Crispy Bacon and Pork Chops (Allowed Pork)",
            "row": {"title": "Pork Chops with Bacon", "ingredients": "2 pork chops ; 4 slices bacon", "directions": "Sear in skillet."},
            "expected_status": "keep", "expected_tags": ["pork"]
        },
        {
            "name": "Roast Turkey Dinner (Disallowed Poultry)",
            "row": {"title": "Roast Turkey", "ingredients": "whole turkey ; stuffing ; butter", "directions": "Roast turkey."},
            "expected_status": "exclude_not_on_meat_allowlist", "expected_tags": []
        },
        {
            "name": "Grilled Salmon Fillet (Disallowed Seafood)",
            "row": {"title": "Grilled Salmon", "ingredients": "salmon fillet ; lemon ; olive oil", "directions": "Grill salmon."},
            "expected_status": "exclude_not_on_meat_allowlist", "expected_tags": []
        },
        {
            "name": "Garlic Butter Shrimp (Disallowed Seafood)",
            "row": {"title": "Garlic Shrimp", "ingredients": "1 lb shrimp ; garlic ; butter", "directions": "Sauté shrimp."},
            "expected_status": "exclude_not_on_meat_allowlist", "expected_tags": []
        },
        {
            "name": "Chicken Breasts Stuffed with Crabmeat (Disallowed Crabmeat)",
            "row": {"title": "Chicken Breasts Stuffed with Crabmeat", "ingredients": "chicken breasts ; fresh crabmeat ; bread crumbs", "directions": "Bake in oven."},
            "expected_status": "exclude_not_on_meat_allowlist", "expected_tags": ["chicken"]
        },
        {
            "name": "Chocolate Mousse in Wine Glass (Wine Exclusion)",
            "row": {"title": "Chocolate Mousse", "ingredients": "chocolate ; eggs ; cream", "directions": "Pour into wine glasses."},
            "expected_status": "exclude_alcohol", "expected_tags": []
        },
        {
            "name": "Veal Scallopini (Disallowed Red Meat)",
            "row": {"title": "Veal Scallopini", "ingredients": "veal cutlets ; butter ; lemon", "directions": "Pan fry veal."},
            "expected_status": "exclude_not_on_meat_allowlist", "expected_tags": []
        },
        {
            "name": "Unspecified Broth (Ambiguous -> Manual Review)",
            "row": {"title": "Country Vegetable Soup", "ingredients": "carrots ; celery ; 4 cups broth ; noodles", "directions": "Simmer in broth."},
            "expected_status": "manual_review", "expected_tags": []
        },
        {
            "name": "Unidentified Gelatin (Ambiguous -> Manual Review)",
            "row": {"title": "Strawberry Jello", "ingredients": "strawberries ; 1 packet unflavored gelatin ; sugar", "directions": "Dissolve gelatin."},
            "expected_status": "manual_review", "expected_tags": []
        },
        {
            "name": "Unspecified Sausage (Ambiguous -> Manual Review)",
            "row": {"title": "Sausage Pizza", "ingredients": "pizza crust ; tomato sauce ; mozzarella ; sausage", "directions": "Top with sausage."},
            "expected_status": "manual_review", "expected_tags": []
        },
        {
            "name": "Dal Tadka (Safe Vegetarian)",
            "row": {"title": "Yellow Dal Tadka", "ingredients": "toor dal ; turmeric ; cumin ; ghee ; tomato", "directions": "Simmer dal with spices."},
            "expected_status": "keep", "expected_tags": []
        },
        {
            "name": "Palak Paneer (Safe Vegetarian)",
            "row": {"title": "Palak Paneer", "ingredients": "spinach ; paneer ; cream ; garam masala", "directions": "Simmer paneer in spinach puree."},
            "expected_status": "keep", "expected_tags": []
        },
    ]

    print("\n=======================================================")
    print("RUNNING AUTOMATED FILTERING RULES UNIT TESTS")
    print("=======================================================\n")

    passed = 0
    for idx, tc in enumerate(test_cases, 1):
        status, reasons, meat_tags = classify_recipe(tc["row"])
        status_ok = status == tc["expected_status"]
        tags_ok = set(meat_tags) == set(tc["expected_tags"])

        if status_ok and tags_ok:
            print(f"[{idx:02d}/PASS] {tc['name']}")
            passed += 1
        else:
            print(f"[{idx:02d}/FAIL] {tc['name']}")
            print(f"       Expected: status={tc['expected_status']}, tags={tc['expected_tags']}")
            print(f"       Actual:   status={status}, tags={meat_tags}, reasons={reasons}")

    # Image URL validation tests
    image_tests = [
        ("NaNname", False),
        ("nan", False),
        ("", False),
        ("   ", False),
        ("None", False),
        ("null", False),
        ("http://", False),
        ("https://imagesvc.meredithcorp.io/v3/mm/image?url=sample.jpg", True),
        ("https://www.allrecipes.com/thmb/sample.jpg", True),
    ]

    img_passed = 0
    for val, expected in image_tests:
        res = is_valid_image_url(val)
        if res == expected:
            img_passed += 1
        else:
            print(f"[FAIL Image Test] Value: {val!r}, Expected: {expected}, Got: {res}")

    # NSFW Threshold Logic Tests
    # normal >= 0.95 -> safe_model_pass
    # nsfw >= 0.50 -> blocked_nsfw
    # else -> manual_review
    def mock_eval_image(normal: float, nsfw: float) -> str:
        if normal >= SAFE_NORMAL_THRESHOLD and nsfw <= (1.0 - SAFE_NORMAL_THRESHOLD + 1e-6):
            return "safe_model_pass"
        elif nsfw >= BLOCK_NSFW_THRESHOLD:
            return "blocked_nsfw"
        else:
            return "manual_review"

    img_logic_tests = [
        (0.98, 0.01, "safe_model_pass"),
        (0.95, 0.04, "safe_model_pass"),
        (0.20, 0.80, "blocked_nsfw"),
        (0.40, 0.55, "blocked_nsfw"),
        (0.85, 0.15, "manual_review"),  # Uncertain image withheld from output
        (0.70, 0.25, "manual_review"),  # Uncertain image withheld from output
    ]

    img_logic_passed = 0
    for norm, nsfw, exp_stat in img_logic_tests:
        stat = mock_eval_image(norm, nsfw)
        if stat == exp_stat:
            img_logic_passed += 1
        else:
            print(f"[FAIL Image Logic] Normal: {norm}, NSFW: {nsfw}, Expected: {exp_stat}, Got: {stat}")

    total_all = len(test_cases) + len(image_tests) + len(img_logic_tests)
    passed_all = passed + img_passed + img_logic_passed
    print(f"\nImage URL Tests: {img_passed}/{len(image_tests)} passed")
    print(f"Image Moderation Logic Tests: {img_logic_passed}/{len(img_logic_tests)} passed")
    print(f"Recipe Filter Tests: {passed}/{len(test_cases)} passed")
    print(f"TOTAL TEST RESULTS: {passed_all}/{total_all} PASSED ({(passed_all/total_all)*100:.1f}%)\n")

    return passed_all == total_all


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="data/raw/recipe.csv")
    parser.add_argument("--output", default="data/processed/recipes_cleaned.csv")
    parser.add_argument("--excluded", default="data/processed/recipes_excluded.csv")
    parser.add_argument("--review", default="data/processed/recipes_manual_review.csv")
    parser.add_argument("--image-audit", default="data/processed/image_safety_audit.csv")
    parser.add_argument("--report", default="data/processed/safety_report.json")
    parser.add_argument("--cache", default="data/processed/image_scan_cache.json")
    parser.add_argument("--allow-host", action="append", default=[], help="Additional approved HTTPS image host suffix")
    parser.add_argument("--skip-image-scan", action="store_true", help="Meat & alcohol filter only; image URLs stripped")
    parser.add_argument("--limit-rows", type=int, default=0, help="Testing only; 0 means all rows")
    parser.add_argument("--test", action="store_true", help="Run automated test suite without scanning dataset")
    args = parser.parse_args()

    if args.test:
        success = run_automated_tests()
        return 0 if success else 1

    source = Path(args.input)
    if not source.is_file():
        raise RuntimeError(f"Dataset CSV not found: {source}. Download it before running this script.")

    headers, rows = read_csv(source)
    source_rows_missing_image = sum(1 for row in rows if not is_valid_image_url(row.get("image")))
    if "ingredients" not in headers:
        raise RuntimeError("Expected an 'ingredients' column was not found")
    if "image" not in headers:
        raise RuntimeError("Expected an 'image' column was not found")
    if args.limit_rows:
        rows = rows[:args.limit_rows]

    allowed_hosts = list(DEFAULT_ALLOWED_HOSTS) + [x.lower().strip() for x in args.allow_host if x.strip()]

    kept: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    meat_counts: Counter[str] = Counter()
    exclusion_counts: Counter[str] = Counter()

    for row in rows:
        status, reasons, meat_tags = classify_recipe(row)
        row["meat_tags"] = ",".join(meat_tags) if meat_tags else "vegetarian_or_no_identified_meat"
        row["filter_status"] = status
        row["filter_reason"] = ";".join(reasons)
        if status == "keep":
            kept.append(row)
            for tag in (meat_tags or ["vegetarian_or_no_identified_meat"]):
                meat_counts[tag] += 1
        elif status == "manual_review":
            review.append(row)
        else:
            excluded.append(row)
            for reason in reasons:
                exclusion_counts[reason] += 1

    # Load reusable image scan cache
    cache_path = Path(args.cache)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if cache_path.exists():
        try:
            image_cache = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            image_cache = {}
    else:
        image_cache = {}

    classifier = Image = None
    if not args.skip_image_scan:
        classifier, Image = load_classifier()

    # Collect valid HTTP(S) image URLs (NaNname treated as missing, never downloaded)
    image_sample_titles: dict[str, str] = {}
    for row in rows:
        raw_url = (row.get("image") or "").strip()
        if is_valid_image_url(raw_url):
            image_sample_titles.setdefault(raw_url, row.get("title", ""))
    image_urls = sorted(image_sample_titles)

    if not args.skip_image_scan:
        for index, url in enumerate(image_urls, start=1):
            key = sha256_text(url)
            result = image_cache.get(key)
            if not isinstance(result, dict) or result.get("status") not in {
                "safe_model_pass", "blocked_nsfw", "manual_review"
            }:
                result = classify_image(url, classifier, Image, allowed_hosts)
                image_cache[key] = result
                cache_path.write_text(json.dumps(image_cache, indent=2), encoding="utf-8")
            if index % 100 == 0 or index == len(image_urls):
                print(f"Scanned {index:,}/{len(image_urls):,} unique images")
            time.sleep(0.03)

    audit_rows: list[dict[str, Any]] = []
    for url in image_urls:
        key = sha256_text(url)
        if args.skip_image_scan:
            result = {"status": "not_scanned_image_stripped", "normal_score": None,
                      "nsfw_score": None, "error": "image scan skipped"}
        else:
            result = image_cache.get(key, {
                "status": "scan_failed_or_untrusted", "normal_score": None,
                "nsfw_score": None, "error": "no scan result available"
            })
        status = result.get("status", "scan_failed_or_untrusted")
        audit_rows.append({
            "title": image_sample_titles.get(url, ""),
            "image_url_sha256": key,
            "image_url": url if status == "safe_model_pass" else "",
            "image_safety_status": status,
            "normal_score": result.get("normal_score"),
            "nsfw_score": result.get("nsfw_score"),
            "error": result.get("error", ""),
        })

    # Apply image decisions: failed, unmoderated, or uncertain URLs are blanked in the output
    # The valid recipe is KEPT and will use a safe placeholder/curated photo
    for row in kept:
        raw_img = (row.get("image") or "").strip()
        if not is_valid_image_url(raw_img):
            image_status = "missing_image"
            result = {"normal_score": None, "nsfw_score": None, "error": ""}
        elif args.skip_image_scan:
            image_status = "not_scanned_image_stripped"
            result = {"normal_score": None, "nsfw_score": None, "error": "image scan skipped"}
        else:
            result = image_cache.get(sha256_text(raw_img), {})
            image_status = result.get("status", "scan_failed_or_untrusted")
        row["image_safety_status"] = image_status
        row["image_nsfw_score"] = result.get("nsfw_score")
        row["image"] = raw_img if image_status == "safe_model_pass" else ""

    output_headers = headers + [h for h in ("meat_tags", "filter_status", "filter_reason", "image_safety_status", "image_nsfw_score") if h not in headers]
    write_csv(Path(args.output), output_headers, kept)
    review_headers = headers + [h for h in ("meat_tags", "filter_status", "filter_reason") if h not in headers]
    write_csv(Path(args.excluded), review_headers, excluded)
    write_csv(Path(args.review), review_headers, review)
    write_csv(Path(args.image_audit), ["title", "image_url_sha256", "image_url", "image_safety_status", "normal_score", "nsfw_score", "error"], audit_rows)

    image_counts = Counter(row.get("image_safety_status", "") for row in audit_rows)
    report = {
        "input_file": str(source),
        "input_rows_processed": len(rows),
        "kept_recipe_rows": len(kept),
        "excluded_recipe_rows": len(excluded),
        "manual_review_recipe_rows": len(review),
        "meat_tag_counts": dict(meat_counts),
        "exclusion_reason_counts": dict(exclusion_counts),
        "unique_image_urls_total": len(image_urls),
        "unique_image_urls_scanned": 0 if args.skip_image_scan else len(image_urls),
        "unique_image_status_counts": dict(image_counts),
        "source_recipe_rows_missing_image": source_rows_missing_image,
        "image_model": None if args.skip_image_scan else MODEL_ID,
        "important": "Only safe_model_pass images (normal >= 0.95) remain in the output image column. Other image URLs are blanked for safe UI placeholders. Valid recipes are kept even when their image is blocked.",
    }
    report["safe_image_threshold"] = {"normal_minimum": SAFE_NORMAL_THRESHOLD, "nsfw_block_minimum": BLOCK_NSFW_THRESHOLD}
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    print(f"\nCleaned recipes: {args.output}")
    print(f"Excluded recipes: {args.excluded}")
    print(f"Manual-review recipes: {args.review}")
    print(f"Image audit: {args.image_audit}")
    print(f"Report: {args.report}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
