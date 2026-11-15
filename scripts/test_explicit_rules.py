import re

EXPLICIT_SEXUAL = re.compile(
    r'\b(?:'
    r'porn|pornography|porno|blowjob|handjob|cumshot|deepthroat|threesome|gangbang|'
    r'cunnilingus|fellatio|dildo|vibrator|masturbat(?:e|ion|ing)|penis|vagina|clitoris|'
    r'anal\s+sex|oral\s+sex|intercourse|sex\s+toy|hardcore\s+sex'
    r')\b',
    re.I
)

SUGGESTIVE_TEXT = re.compile(
    r'\b(?:aphrodisiac|erotic|horny|orgasmic|orgasm|sensual|kinky|erogenous)\b',
    re.I
)

culinary_samples = [
    'Pan-seared chicken breast with garlic herb butter',
    'Spaghetti and meatballs with tomato sauce',
    'Buffalo chicken wings with extra hot sauce',
    'Extra virgin olive oil dressing with lemon',
    'Thai peanut noodles with roasted peanuts',
    'Tossed green salad with vinaigrette',
    'Slow-cooked Boston pork butt roast',
    'Shrimp cocktail with spicy cocktail sauce',
    'Tiramisu with espresso and ladyfingers',
]

explicit_samples = [
    'Troll submission recipe featuring blowjob jokes and crude text',
    'Offensive dish with explicit porn links',
    'Dessert shaped like a dildo',
]

suggestive_samples = [
    'Romantic dinner with natural aphrodisiac oysters',
    'Sensual chocolate fondue for lovers',
]

print("--- TESTING CULINARY SAMPLES (MUST NOT TRIGGER EXPLICIT) ---")
for s in culinary_samples:
    m_exp = EXPLICIT_SEXUAL.search(s)
    m_sug = SUGGESTIVE_TEXT.search(s)
    print(f"{s[:45]}... --> {'EXPLICIT' if m_exp else 'SUGGESTIVE' if m_sug else 'SAFE'}")
    assert not m_exp and not m_sug

print("\n--- TESTING EXPLICIT SAMPLES (MUST TRIGGER EXPLICIT) ---")
for s in explicit_samples:
    m_exp = EXPLICIT_SEXUAL.search(s)
    print(f"{s[:45]}... --> {'EXPLICIT' if m_exp else 'NOT EXPLICIT'}")
    assert m_exp

print("\n--- TESTING SUGGESTIVE SAMPLES (MUST TRIGGER SUGGESTIVE/MANUAL REVIEW) ---")
for s in suggestive_samples:
    m_sug = SUGGESTIVE_TEXT.search(s)
    print(f"{s[:45]}... --> {'SUGGESTIVE' if m_sug else 'NOT SUGGESTIVE'}")
    assert m_sug

print("\nAll explicit text filtering tests passed!")
