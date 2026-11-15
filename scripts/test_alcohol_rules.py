import re

NON_ALCOHOL = re.compile(
    r'\b(?:'
    r'(?:red\s+wine|white\s+wine|rice\s+wine|sherry|champagne|apple\s+cider|cider)\s+vinegar|'
    r'wine\s+vinegar|'
    r'non-alcoholic\s+(?:beer|wine|cider|spirits?)|'
    r'alcohol-free\s+(?:beer|wine|cider|spirits?)|'
    r'root\s+beer|ginger\s+beer|birch\s+beer|'
    r'winesap\s+apples?|'
    r'cream\s+of\s+tartar'
    r')\b',
    re.I
)

ALCOHOL = re.compile(
    r'\b(?:'
    r'red\s+wine|white\s+wine|cooking\s+wine|rice\s+wine|shaoxing(?:\s+wine)?|shaohsing(?:\s+wine)?|'
    r'dry\s+white|dry\s+red|sweet\s+wine|dessert\s+wine|mulled\s+wine|'
    r'marsala(?:\s+wine)?|sherry(?:\s+wine)?|port(?:\s+wine)?|vermouth|madeira(?:\s+wine)?|'
    r'champagne|prosecco|cava|sparkling\s+wine|chianti|merlot|cabernet(?:\s+sauvignon)?|'
    r'pinot\s+noir|chardonnay|sauvignon\s+blanc|riesling|moscato|zinfandel|ros[eé]\s+wine|'
    r'beer|beers|lager|lagers|ale|ales|stout|stouts|pilsner|porter\s+beer|ipa|pale\s+ale|guinness|'
    r'whiskey|whisky|bourbon|scotch|vodka|rum|gin|tequila|mezcal|brandy|cognac|armagnac|calvados|grappa|'
    r'sake|mirin|soju|ouzo|arak|pastis|sambuca|absinthe|campari|aperol|'
    r'liqueur|liqueurs|schnapps|amaretto|kahl[uú]a|baileys|triple\s+sec|cointreau|grand\s+marnier|cura[cç]ao|'
    r'limoncello|frangelico|drambuie|chartreuse|cr[eè]me\s+de\s+(?:menthe|cacao|cassis)|chambord|'
    r'hard\s+cider|hard\s+seltzer|cocktail|cocktails|margarita|margaritas|martini|martinis|mojito|sangria|'
    r'daiquiri|pi[nñ]a\s+colada|cosmopolitan|bloody\s+mary|bellini|mimosa'
    r')\b',
    re.I
)

samples = [
    '2 tbsp red wine vinegar',
    '1/4 cup white wine vinegar',
    '2 cups soy sauce',
    '1 glass red wine',
    '1/2 cup white wine',
    '1 bottle dark beer',
    '2 tbsp mirin',
    '1 oz bourbon whiskey',
    '1 cup chicken broth, 1 cup dry white wine',
    '1 cup apple cider vinegar',
    'root beer float with vanilla ice cream',
    'ginger beer with fresh mint',
    'winesap apple pie with cinnamon',
    'flambé with 2 tablespoons brandy in the skillet'
]

for s in samples:
    cleaned = NON_ALCOHOL.sub(' ', s)
    m = ALCOHOL.search(cleaned)
    res = f"EXCLUDED (ALCOHOL: {m.group(0)})" if m else "SAFE (NO ALCOHOL)"
    print(f"{s} --> {res}")
