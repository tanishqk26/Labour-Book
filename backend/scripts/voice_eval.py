"""
Run real recordings through the voice pipeline and print what it understood.

No database needed. Put farmer recordings (m4a/mp3/wav/ogg/webm) in a folder,
optionally next to a same-named .json with the expected result, then:

    cd backend
    .venv\\Scripts\\python scripts\\voice_eval.py samples\\ --plots "35,36,Crimson,Thompson A"

Expected file format (samples\\01.json) — every key optional:
    {"operations": [{"plot": "35", "category": "Spraying"},
                    {"plot": "36", "category": "Labour Work"}]}

Needs SONIOX_API_KEY and GEMINI_API_KEY in backend/.env.
Prints the transcript, the drafts, and (when expected data exists) a
plot/category accuracy summary.
"""

import argparse
import asyncio
import json
import sys
import uuid
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT))

from app.config import settings  # noqa: E402
from app.core.voice import glossary  # noqa: E402
from app.core.voice.operations import PlotRef, parse_operations_text  # noqa: E402
from app.core.voice.soniox import transcribe  # noqa: E402

AUDIO_EXT = {".m4a", ".mp3", ".wav", ".ogg", ".webm", ".aac", ".mp4", ".flac"}
MIME = {".m4a": "audio/mp4", ".mp4": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav",
        ".ogg": "audio/ogg", ".webm": "audio/webm", ".aac": "audio/aac", ".flac": "audio/flac"}


async def run(folder: Path, plot_names: list[str], lang: str) -> int:
    if not settings.voice_enabled:
        print("Set SONIOX_API_KEY and GEMINI_API_KEY in backend/.env first.")
        return 2
    plots = [PlotRef(id=uuid.uuid4(), name=n) for n in plot_names]
    terms = list(dict.fromkeys(plot_names + glossary.PRODUCTS + glossary.FARM_TERMS))[:400]
    context = {
        "general": [{"key": "domain", "value": "Grape farming (viticulture) in Maharashtra, India"}],
        "text": "Daily farm diary: spraying, fertigation through drip, labour work on numbered grape plots.",
        "terms": terms,
    }

    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in AUDIO_EXT)
    if not files:
        print(f"No audio files in {folder}")
        return 1

    plot_hits = plot_total = cat_hits = cat_total = 0
    for f in files:
        print("=" * 70)
        print(f.name)
        transcript = await transcribe(
            f.read_bytes(), filename=f.name, content_type=MIME.get(f.suffix.lower(), "audio/mp4"),
            language_hints=["mr", "hi", "en"], context=context,
        )
        print("TRANSCRIPT:", transcript)
        drafts = await parse_operations_text(transcript, plots, today=date.today(), lang=lang)
        for d in drafts:
            prods = ", ".join(f"{p.name} ({p.dose or '-'})" for p in d.products)
            print(f"  - [{d.category}] plot={d.plot_name or '?'} date={d.operation_date} conf={d.confidence:.2f} "
                  f"review={d.needs_review}\n      {d.notes}  | {prods}")

        exp_path = f.with_suffix(".json")
        if exp_path.exists():
            expected = json.loads(exp_path.read_text(encoding="utf-8")).get("operations", [])
            got = {(d.plot_name or "", d.category) for d in drafts}
            got_plots = {d.plot_name for d in drafts}
            for e in expected:
                plot_total += 1
                plot_hits += e.get("plot") in got_plots
                if "category" in e:
                    cat_total += 1
                    cat_hits += (e.get("plot", ""), e["category"]) in got
            print(f"  expected {len(expected)} op(s), got {len(drafts)}")

    if plot_total:
        print("=" * 70)
        print(f"Plot match:   {plot_hits}/{plot_total}  ({100 * plot_hits / plot_total:.0f}%)")
        if cat_total:
            print(f"Category:     {cat_hits}/{cat_total}  ({100 * cat_hits / cat_total:.0f}%)")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path)
    ap.add_argument("--plots", default="", help='Comma-separated plot names, e.g. "35,36,Crimson"')
    ap.add_argument("--lang", default="mr", choices=["mr", "hi", "en"])
    a = ap.parse_args()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    sys.exit(asyncio.run(run(a.folder, [p.strip() for p in a.plots.split(",") if p.strip()], a.lang)))
