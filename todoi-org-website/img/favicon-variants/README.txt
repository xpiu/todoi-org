todoi.org — favicon variants
============================

Four ways of combining the checkmark from the old favicon with the
open-source mark (../open-source-transp-icon.svg). Each is rendered at
512, 180 (apple-touch), 32 and 16 px. Colours are the live palette:
paper #eef2f9, accent #0b46e0.

  01-ring-check      The mark reduced to its outer arc — the gap at the
                     bottom is what makes it recognisable — with the check
                     set in the void it leaves. The most legible pairing.
  02-check-break     The gap is the hole the check escapes through, so the
                     two glyphs share one event instead of nesting.
  03-keyhole-badge   The mark kept whole (keyhole, legs and all) with the
                     check carried in a badge. The most faithful, and the
                     weakest at 16 px: the keyhole's own stroke-to-hole
                     ratio does not survive that scale, so the inner circle
                     here is drawn larger than the mark's own proportions.
  04-solid-knockout  01 inverted. Shipped as the site favicon — a solid
                     accent tile holds its own against a light or a dark
                     tab strip rather than borrowing the browser's chrome
                     for contrast.

Every tile is fully opaque, which is what Apple's touch icon wants and
what keeps the mark readable on either browser chrome.

To ship a different one, copy its -16/-32/-180 PNGs over
../favicon-16.png, ../favicon-32.png and ../apple-touch-icon.png.

Rebuilding
----------
  python3 build.py            # rewrites the four .svg sources
  # then rasterise each .svg at 512/180/32/16 (headless Chrome was used;
  # any renderer that honours stroke-linecap and viewBox will do)
