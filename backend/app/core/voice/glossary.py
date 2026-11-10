"""
Domain vocabulary for grape-farm voice entry.

Used two ways:
  · sent to Soniox as `context.terms` so product names / Marathi farm words are
    recognised instead of being phonetically mangled;
  · sent to Gemini as the canonical spellings to normalise to.
"""

# Common agro-input names (Latin script, canonical spelling).
PRODUCTS = [
    # Insecticides / miticides
    "Movento", "Confidor", "Actara", "Karate", "Imidacloprid", "Thiamethoxam",
    "Spinosad", "Abamectin", "Emamectin benzoate", "Profenofos", "Fipronil",
    # Fungicides
    "Score", "Nativo", "Amistar", "Antracol", "Ridomil", "Bavistin", "Mancozeb",
    "Copper oxychloride", "Bordeaux mixture", "Sulphur", "Tebuconazole",
    "Propiconazole", "Azoxystrobin", "Metalaxyl", "Fosetyl-Al", "Cymoxanil",
    "Thiram", "Trichoderma", "Ethapon",
    # PGRs
    "GA3", "Gibberellic acid", "CPPU", "Cycocel", "CCC", "Dormex",
    "Hydrogen cyanamide", "Ethephon",
    # Nutrients / fertilisers
    "Vitaflora", "Calcium nitrate", "Magnesium nitrate", "Potassium nitrate",
    "Urea", "MAP", "MKP", "SOP", "19:19:19", "13:0:45", "12:61:00", "0:52:34",
    "0:0:50", "Humic acid", "Seaweed extract", "Boron", "Zinc sulphate",
    "Ferrous sulphate", "Magnesium sulphate", "Calcium chloride",
    "Potassium sulphate", "Amino acid",
]

# Marathi / Hindi farm words and operation vocabulary (Devanagari + Roman).
FARM_TERMS = [
    "फवारणी", "फर्टिगेशन", "ड्रिप", "ड्रेंचिंग", "सोडले", "सोडली", "घेतला", "घेतली",
    "फूट काढली", "फेल फूट", "छाटणी", "काडी", "थिनिंग", "डिपिंग", "गर्डलिंग",
    "पेस्टिंग", "बोर्डो", "सबकेन", "बांधणी", "तण काढणी", "पाणी दिले", "मजूर",
    "प्लॉट", "पंप", "लिटर", "मिली", "ग्रॅम", "किलो", "बॅग", "एकर",
]

SPRAY_CUES = "फवारणी, फवारला/फवारली, पंप, 'फवारणी घेतली/घेतला' (= sprayed), औषध (pesticide/fungicide), 'ml/litre ने' dose per 100 L water"
FERTIGATION_CUES = "ड्रिपमधून/ड्रिपने खत सोडले/सोडली (= released through drip), फर्टिगेशन, ड्रेंचिंग, खताची बॅग सोडली, nutrients such as calcium nitrate, magnesium nitrate, 19:19:19, 13:0:45, 0:52:34, humic, seaweed given via drip"
LABOUR_CUES = "मजुरांनी/बायांनी काम केले, फूट काढली, फेल फूट काढली, छाटणी, थिनिंग, डिपिंग, गर्डलिंग, बांधणी, तण काढणी, पान काढणे, कात्री/कटिंग — manual field work done by people"

# Words that are just fillers/interjections in these dictations.
FILLERS = "अरे / ara / are / हं / ok / बघा — ignore them"

# Attendance vocabulary (sent to Soniox as context terms)
ATTENDANCE_TERMS = [
    "हजेरी", "आला", "आली", "आले", "आले नाहीत", "आला नाही", "आली नाही", "गैरहजर",
    "दांडी", "अर्धा दिवस", "हाफ डे", "पूर्ण दिवस", "माणसं", "जण", "बायका", "मजूर",
    "ग्रुप", "टीम", "सकाळी", "दुपारी", "संध्याकाळी", "वाजता", "काल", "परवा", "आज",
]
