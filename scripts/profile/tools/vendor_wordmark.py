"""Rasterise the hero wordmark into a dot-matrix grid (pixelated-canvas style).

Each grid cell stores how much of it is covered by the glyphs (0..1). The hero
component turns coverage into dot radius/opacity, so the halftone look, the
twinkle and the light sweep are all decided at render time.

Usage (one-off, only when the wordmark text or font changes):
  python scripts/profile/tools/vendor_wordmark.py <path-to-extracted-geist-npm-package>

Writes scripts/profile/vendor/wordmark.json. Requires Pillow + numpy.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]

TEXT = "RunyShark"
FONT = "geist-sans/Geist-Bold.ttf"
TARGET_WIDTH = 660      # output px the wordmark should span inside the 860px hero
CELL = 6                # output px per dot cell
SUPERSAMPLE = 12        # raster px per output px (coverage precision)
TRACKING = -0.045       # em, tight like Vercel display headings
MIN_COVERAGE = 0.06     # drop near-empty edge cells


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    font_path = Path(sys.argv[1]) / "dist" / "fonts" / FONT

    # Measure at 1000px to derive the output font size that hits TARGET_WIDTH.
    probe = ImageFont.truetype(str(font_path), 1000)
    advances = [probe.getlength(ch) for ch in TEXT]
    width_at_1000 = sum(advances) + TRACKING * 1000 * (len(TEXT) - 1)
    font_size = TARGET_WIDTH * 1000 / width_at_1000

    scale = SUPERSAMPLE
    font = ImageFont.truetype(str(font_path), round(font_size * scale))
    ascent, descent = font.getmetrics()
    pad = CELL * scale * 2
    raster_w = int(TARGET_WIDTH * scale + pad * 2)
    raster_h = int(ascent + descent + pad * 2)
    img = Image.new("L", (raster_w, raster_h), 0)
    draw = ImageDraw.Draw(img)

    x = pad
    for ch in TEXT:
        draw.text((x, pad), ch, font=font, fill=255)
        x += font.getlength(ch) + TRACKING * font_size * scale

    arr = np.asarray(img, dtype=np.float32) / 255.0
    ys, xs = np.nonzero(arr > 0.5)
    top, bottom = ys.min(), ys.max()
    left, right = xs.min(), xs.max()
    baseline_raster = pad + ascent  # PIL draws text with its ascent from the top

    cell_px = CELL * scale
    cols = int(np.ceil((right - left + 1) / cell_px)) + 2
    rows = int(np.ceil((bottom - top + 1) / cell_px)) + 2
    origin_x = left - cell_px
    origin_y = top - cell_px

    dots = []
    for r in range(rows):
        for c in range(cols):
            y0, x0 = origin_y + r * cell_px, origin_x + c * cell_px
            block = arr[max(y0, 0):y0 + cell_px, max(x0, 0):x0 + cell_px]
            cov = float(block.mean()) if block.size else 0.0
            if cov >= MIN_COVERAGE:
                dots.append([c, r, round(cov, 3)])

    out = {
        "text": TEXT,
        "font": FONT,
        "fontSize": round(font_size, 2),
        "cell": CELL,
        "cols": cols,
        "rows": rows,
        "width": cols * CELL,
        "height": rows * CELL,
        # distance (output px) from the grid top to the text baseline
        "baseline": round((baseline_raster - origin_y) / scale, 2),
        "dots": dots,
    }
    dest = ROOT / "vendor" / "wordmark.json"
    dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"font {font_size:.1f}px grid {cols}x{rows} ({out['width']}x{out['height']}px) dots {len(dots)} -> {dest}")


if __name__ == "__main__":
    main()
