"""
Reading a medicine box or a prescription.

The feature is two separate jobs, and keeping them apart is what makes it
useful rather than a demo:

  1. Recognition — pixels to text. This needs a real OCR engine, so it is
     optional and pluggable (see `run_ocr`). Tesseract, if the machine has it,
     is used through pytesseract; otherwise this half is simply unavailable.

  2. Extraction — text to fields. This is where the value is, it is pure
     Python, it has no dependencies at all, and it is the same code whether the
     text arrived from OCR or was typed in by hand off the box. Names are
     resolved against the shared catalog, which is exactly the reference data
     this app already keeps.

Because the two halves are separate, the app can always offer the feature: with
an engine installed it reads the photo, and without one the user types what the
label says and still gets the form filled in for them. Nothing here writes
anything — the extracted fields are a *suggestion*, and the user edits and
confirms them in the normal Add Medicine form.
"""

from __future__ import annotations

import difflib
import re

from .models import CatalogMedicine, Form

# ---------------------------------------------------------------------------
# 1. Recognition
# ---------------------------------------------------------------------------

# Tesseract language packs to try, in order. `nep` covers a Devanagari
# prescription; both are optional and a missing pack just falls back to English.
OCR_LANGS = "eng+nep"


def ocr_available() -> bool:
    """True when this machine can actually turn an image into text."""
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
    except Exception:
        return False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def run_ocr(image_bytes: bytes) -> str:
    """
    Image bytes to raw text. Raises RuntimeError when no engine is installed —
    the view turns that into a clear message and the app offers manual entry.
    """
    try:
        import pytesseract
        from PIL import Image
    except Exception as exc:  # pragma: no cover - depends on the environment
        raise RuntimeError(
            "No OCR engine is installed on the server. Install Tesseract plus "
            "`pytesseract` and `Pillow`, or type the label text instead."
        ) from exc

    import io

    with Image.open(io.BytesIO(image_bytes)) as image:
        # Greyscale is what Tesseract wants, and a photographed box is rarely
        # upright — EXIF orientation is applied so sideways shots still read.
        try:
            from PIL import ImageOps

            image = ImageOps.exif_transpose(image)
        except Exception:
            pass
        prepared = image.convert("L")
        try:
            return pytesseract.image_to_string(prepared, lang=OCR_LANGS)
        except Exception:
            # A missing language pack is the usual cause; English alone still
            # reads the strength and most brand names.
            return pytesseract.image_to_string(prepared)


# ---------------------------------------------------------------------------
# 2. Extraction
# ---------------------------------------------------------------------------

STRENGTH_RE = re.compile(
    r"\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|gm?|ml|iu|%)\b", re.IGNORECASE
)

# "1-0-1" — morning, midday, night. The standard way a dose is written on a
# South Asian prescription, and the single most informative token on the page.
PATTERN_RE = re.compile(r"\b([0-2½]|1/2)\s*[-–]\s*([0-2½]|1/2)\s*[-–]\s*([0-2½]|1/2)\b")

DURATION_RE = re.compile(
    r"\b(?:for|x|×)\s*(\d{1,3})\s*(day|days|din|दिन|week|weeks|month|months)\b",
    re.IGNORECASE,
)

# Latin dosing abbreviations, as they appear on a handwritten slip.
FREQUENCY_CODES = {
    "od": 1, "qd": 1, "sid": 1, "once daily": 1, "once a day": 1,
    "bd": 2, "bid": 2, "twice daily": 2, "twice a day": 2,
    "tds": 3, "tid": 3, "thrice daily": 3, "three times a day": 3,
    "qds": 4, "qid": 4, "four times a day": 4,
}

MEAL_WORDS = {
    "before": ("before meal", "before food", "before meals", "ac", "खाना अघि", "भोजन अघि"),
    "after": ("after meal", "after food", "after meals", "pc", "खाना पछि", "भोजन पछि"),
    "with": ("with meal", "with food", "with meals", "खानासँग"),
}

ROUTINE_WORDS = {
    "breakfast": ("breakfast", "morning", "बिहान", "बिहानको"),
    "lunch": ("lunch", "noon", "midday", "दिउँसो", "मध्यान्ह"),
    "dinner": ("dinner", "evening", "supper", "साँझ", "बेलुका"),
    "bedtime": ("bedtime", "at night", "night", "hs", "सुत्ने बेला", "राति"),
}

# Which clock time each routine slot means. The same defaults the app offers,
# so a scanned prescription and a hand-entered one land on the same schedule.
ROUTINE_TIMES = {
    "breakfast": "08:00",
    "lunch": "13:00",
    "dinner": "19:00",
    "bedtime": "22:00",
}

# The times a "n times a day" instruction spreads across, when the prescription
# says how often but not when.
FREQUENCY_TIMES = {
    1: ["08:00"],
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["06:00", "12:00", "18:00", "22:00"],
}

FORM_WORDS = {
    Form.TABLET: ("tab", "tablet", "tabs", "चक्की"),
    Form.CAPSULE: ("cap", "capsule", "caps"),
    Form.SYRUP: ("syp", "syrup", "suspension", "susp"),
    Form.INJECTION: ("inj", "injection", "vial"),
    Form.DROPS: ("drop", "drops", "eye drop", "ear drop"),
    Form.INHALER: ("inhaler", "puff", "rotacap"),
    Form.CREAM: ("cream", "ointment", "gel"),
    Form.PATCH: ("patch",),
}

# Lines that are never a medicine: the letterhead and the footer of a slip.
NOISE_RE = re.compile(
    r"\b(hospital|clinic|pharmacy|patient|doctor|dr\.?|address|phone|reg|nmc|"
    r"date|age|sex|signature|prescription|rx|advice|follow\s*up|diagnosis)\b",
    re.IGNORECASE,
)

# A word that could be a medicine name: letters only, long enough to match on.
WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']{3,}")


def _contains(haystack: str, needles) -> bool:
    return any(re.search(rf"\b{re.escape(word)}\b", haystack) for word in needles)


def _number(raw: str) -> float:
    if raw in {"½", "1/2"}:
        return 0.5
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return 0.0


def catalog_match(line: str) -> CatalogMedicine | None:
    """
    The catalog entry this line is naming, if any.

    Two passes, because OCR gets brand names slightly wrong far more often than
    it gets them right: an exact prefix match first, then a close-enough match
    over the small set of entries sharing the word's first three letters. The
    second pass is what turns "Paracetarnol" back into "Paracetamol".
    """
    words = WORD_RE.findall(line)
    if not words:
        return None

    for word in words:
        exact = (
            CatalogMedicine.objects.filter(is_active=True)
            .filter(name__istartswith=word)
            .order_by("name", "strength")
            .first()
        )
        if exact:
            return exact

    for word in words:
        candidates = list(
            CatalogMedicine.objects.filter(
                is_active=True, name__istartswith=word[:3]
            ).order_by("name")[:60]
        )
        if not candidates:
            continue
        names = [c.name for c in candidates]
        close = difflib.get_close_matches(word, names, n=1, cutoff=0.78)
        if close:
            return next(c for c in candidates if c.name == close[0])
    return None


def parse_line(line: str) -> dict | None:
    """One line of a prescription or label, as far as it can be understood."""
    clean = " ".join(line.split())
    if len(clean) < 3 or NOISE_RE.search(clean):
        return None

    lowered = clean.lower()
    found: dict = {
        "line": clean,
        "name": "",
        "strength": "",
        "form": "",
        "dosage": "",
        "frequency": "",
        "times": [],
        "routine": "anytime",
        "mealRelation": "none",
        "durationDays": None,
        "catalogId": None,
        "confidence": 0.0,
    }
    score = 0.0

    # --- strength -----------------------------------------------------------
    if strength := STRENGTH_RE.search(clean):
        unit = strength.group(2).lower()
        unit = {"ug": "mcg", "µg": "mcg", "g": "g", "gm": "g"}.get(unit, unit)
        found["strength"] = f"{strength.group(1).replace(',', '.')} {unit}"
        score += 0.3

    # --- form ---------------------------------------------------------------
    for form, words in FORM_WORDS.items():
        if _contains(lowered, words):
            found["form"] = form
            score += 0.1
            break

    # --- name, resolved against the catalog ---------------------------------
    if match := catalog_match(clean):
        found["name"] = match.name
        found["catalogId"] = str(match.id)
        if not found["strength"] and match.strength:
            found["strength"] = match.strength
        if not found["form"]:
            found["form"] = match.form
        score += 0.5
    else:
        # Nothing in the catalog: the longest plausible word is the best guess,
        # and the user is going to confirm it anyway.
        words = [w for w in WORD_RE.findall(clean) if w.lower() not in FREQUENCY_CODES]
        if words:
            found["name"] = max(words, key=len).strip("-'").title()
            score += 0.15

    # --- how often ----------------------------------------------------------
    doses_per_day = 0
    if pattern := PATTERN_RE.search(clean):
        slots = [_number(pattern.group(i)) for i in (1, 2, 3)]
        times = [
            ROUTINE_TIMES[slot]
            for slot, amount in zip(("breakfast", "lunch", "dinner"), slots)
            if amount > 0
        ]
        if times:
            found["times"] = times
            doses_per_day = len(times)
            score += 0.35
    else:
        for code, count in FREQUENCY_CODES.items():
            if re.search(rf"\b{re.escape(code)}\b", lowered):
                doses_per_day = count
                found["times"] = FREQUENCY_TIMES[count]
                score += 0.25
                break

    # --- routine and meal ---------------------------------------------------
    for routine, words in ROUTINE_WORDS.items():
        if _contains(lowered, words):
            found["routine"] = routine
            if not found["times"]:
                found["times"] = [ROUTINE_TIMES[routine]]
                doses_per_day = 1
            score += 0.15
            break

    for relation, words in MEAL_WORDS.items():
        if _contains(lowered, words):
            found["mealRelation"] = relation
            score += 0.1
            break

    # --- for how long -------------------------------------------------------
    if duration := DURATION_RE.search(clean):
        amount = int(duration.group(1))
        unit = duration.group(2).lower()
        multiplier = 7 if unit.startswith("week") else 30 if unit.startswith("month") else 1
        found["durationDays"] = amount * multiplier
        score += 0.15

    if doses_per_day:
        found["frequency"] = {
            1: "Once a day",
            2: "Twice a day",
            3: "Three times a day",
            4: "Every 6 hours",
        }.get(doses_per_day, "Once a day")

    # A line with neither a recognised name nor a strength is not a medicine.
    if not found["catalogId"] and not found["strength"] and not found["times"]:
        return None

    unit = dict(Form.choices).get(found["form"], "dose").lower()
    found["dosage"] = (
        f"1 {unit} ({found['strength']})" if found["strength"] else f"1 {unit}"
    )
    found["confidence"] = round(min(score, 1.0), 2)
    return found


def extract(text: str) -> dict:
    """
    Everything readable in a scan, best candidate first.

    Duplicates are collapsed by name: a box shows its own name three times, and
    the app only wants to be offered it once.
    """
    lines = [line for line in (text or "").splitlines() if line.strip()]
    seen: dict[str, dict] = {}

    for line in lines:
        parsed = parse_line(line)
        if not parsed:
            continue
        key = (parsed["catalogId"] or parsed["name"]).lower()
        previous = seen.get(key)
        if previous is None or parsed["confidence"] > previous["confidence"]:
            # Keep whichever reading understood more of the line, but never
            # lose a detail the weaker reading found on its own.
            if previous:
                for field in ("times", "strength", "durationDays", "frequency"):
                    if not parsed[field] and previous[field]:
                        parsed[field] = previous[field]
            seen[key] = parsed

    medicines = sorted(seen.values(), key=lambda m: -m["confidence"])
    return {
        "text": text or "",
        "medicines": medicines,
        "count": len(medicines),
    }
