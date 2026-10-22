"""Subset Geist / Geist Mono and export them for the SVG generator.

Writes two files into scripts/profile/vendor/:
  fonts.json    base64 WOFF2 subsets, keyed "<family>-<weight>" (e.g. "sans-600")
  metrics.json  advance widths + vertical metrics in font units, used by core/text.mjs

Usage (one-off, only when fonts or the glyph set change):
  python scripts/profile/tools/vendor_fonts.py <path-to-extracted-geist-npm-package>

Requires fontTools + brotli. Geist is licensed under the SIL OFL 1.1 (no Reserved
Font Name), so subsetting and embedding is permitted; the license ships in vendor/.
"""

import base64
import io
import json
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor"

FONTS = {
    "sans-400": "geist-sans/Geist-Regular.ttf",
    "sans-500": "geist-sans/Geist-Medium.ttf",
    "sans-600": "geist-sans/Geist-SemiBold.ttf",
    "sans-700": "geist-sans/Geist-Bold.ttf",
    "mono-400": "geist-mono/GeistMono-Regular.ttf",
    "mono-500": "geist-mono/GeistMono-Medium.ttf",
}

# Basic Latin, Latin-1, general punctuation, arrows and a few math symbols.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + list(range(0x2010, 0x2028))
    + list(range(0x2030, 0x203B))
    + list(range(0x2190, 0x2200))
    + [0x2212, 0x2122, 0x20AC, 0x2248, 0x2264, 0x2265, 0x221E, 0x00D7]
)


def subset_font(path: Path) -> bytes:
    font = TTFont(path)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt", "tnum", "case", "zero"]
    options.name_IDs = ["*"]  # keep copyright / license strings inside the font
    options.hinting = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    return buf.getvalue()


def metrics(path: Path) -> dict:
    font = TTFont(path)
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    widths = {}
    for cp in UNICODES:
        glyph = cmap.get(cp)
        if glyph is not None:
            widths[chr(cp)] = hmtx[glyph][0]
    return {
        "unitsPerEm": font["head"].unitsPerEm,
        "ascender": os2.sTypoAscender,
        "descender": os2.sTypoDescender,
        "capHeight": getattr(os2, "sCapHeight", 700),
        "xHeight": getattr(os2, "sxHeight", 500),
        "fallback": widths.get("n", 550),
        "widths": widths,
    }


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    package = Path(sys.argv[1])
    fonts_dir = package / "dist" / "fonts"
    VENDOR.mkdir(parents=True, exist_ok=True)

    fonts, all_metrics = {}, {}
    for key, rel in FONTS.items():
        src = fonts_dir / rel
        data = subset_font(src)
        fonts[key] = base64.b64encode(data).decode("ascii")
        all_metrics[key] = metrics(src)
        print(f"{key:9s} {src.name:24s} {len(data) / 1024:6.1f} KB")

    (VENDOR / "fonts.json").write_text(json.dumps(fonts), encoding="utf-8")
    (VENDOR / "metrics.json").write_text(json.dumps(all_metrics, ensure_ascii=False), encoding="utf-8")
    shutil.copyfile(package / "LICENSE.txt", VENDOR / "LICENSE-Geist.txt")
    print("wrote vendor/fonts.json, vendor/metrics.json, vendor/LICENSE-Geist.txt")


if __name__ == "__main__":
    main()
