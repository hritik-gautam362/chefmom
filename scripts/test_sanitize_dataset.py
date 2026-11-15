#!/usr/bin/env python3
"""Automated unit and regression test suite for scripts/sanitize_recipe_dataset.py.
Validates:
- Beef and beef derivatives (cuts, broths, fats, gelatins, bovine derivatives, international names)
- Red and white wine, cooking wine, beer, and all major alcoholic beverages
- Hidden alcohol references in cooking instructions
- Explicit sexual recipe text & suggestive double-entendres
- Normal cooking term false-positive protections (chicken breast, meatballs, hot sauce, virgin oil)
- NSFW image classification & uncertain image withholding (normal >= 0.95)
- Preserved meat policy: Chicken, Mutton, Goat/Lamb, Pigeon, Pork, and Vegetarian
- Excluded meats: All other red meats, other poultry, and all seafood
- Ambiguous ingredients routed to manual review
- Invalid image handling (NaNname, empty strings, nan values treated as missing)
"""
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sanitize_recipe_dataset import run_automated_tests, is_valid_image_url, classify_recipe


def test_suite():
    assert run_automated_tests() is True


def test_alcohol_vinegar_distinction():
    # Ordinary red wine vinegar must NOT be excluded as alcohol
    row_vinegar = {
        "title": "Greek Salad Dressing",
        "ingredients": "olive oil ; 2 tbsp red wine vinegar ; oregano ; garlic",
        "directions": "Whisk red wine vinegar and olive oil."
    }
    status, reasons, tags = classify_recipe(row_vinegar)
    assert status == "keep"
    assert "contains_alcohol" not in reasons

    # Real wine must be excluded as alcohol
    row_wine = {
        "title": "Beef Bourguignon without beef name",
        "ingredients": "mushrooms ; 2 cups red wine ; carrots ; onions",
        "directions": "Simmer in red wine."
    }
    status, reasons, tags = classify_recipe(row_wine)
    assert status == "exclude_alcohol"
    assert "contains_alcohol" in reasons


def test_hidden_alcohol_in_instructions():
    row_hidden = {
        "title": "Skillet Chicken Thighs",
        "ingredients": "chicken thighs ; salt ; pepper ; garlic ; olive oil",
        "directions": "Sear chicken on both sides, then deglaze the pan with 1/2 cup dry white wine."
    }
    status, reasons, tags = classify_recipe(row_hidden)
    assert status == "exclude_alcohol"
    assert "contains_alcohol" in reasons


def test_explicit_text_and_culinary_terms():
    # Normal culinary term: chicken breast
    row_breast = {
        "title": "Grilled Chicken Breast",
        "ingredients": "2 chicken breasts ; olive oil ; lemon ; herbs",
        "directions": "Grill chicken breast until cooked through."
    }
    status, reasons, tags = classify_recipe(row_breast)
    assert status == "keep"
    assert tags == ["chicken"]

    # Explicit text
    row_explicit = {
        "title": "Troll Recipe",
        "ingredients": "flour ; sugar ; visit porn site",
        "directions": "Mix together."
    }
    status, reasons, tags = classify_recipe(row_explicit)
    assert status == "exclude_explicit"


def test_nan_image():
    assert is_valid_image_url("NaNname") is False
    assert is_valid_image_url("nan") is False
    assert is_valid_image_url("") is False
    assert is_valid_image_url(None) is False
    assert is_valid_image_url("https://imagesvc.meredithcorp.io/sample.jpg") is True


if __name__ == "__main__":
    test_suite()
    test_alcohol_vinegar_distinction()
    test_hidden_alcohol_in_instructions()
    test_explicit_text_and_culinary_terms()
    test_nan_image()
    print("All tests in test_sanitize_dataset.py passed!")
