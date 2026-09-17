import math, os

OUT = os.path.dirname(os.path.abspath(__file__))

PAPER  = '#eef2f9'   # --paper, light
ACCENT = '#0b46e0'   # --accent, light
LIFT   = '#6f9dff'   # --accent, dark

def pt(cx, cy, R, deg):
    """Angle in degrees, 0 = straight down, positive = clockwise on screen."""
    a = math.radians(deg)
    return (cx + R * math.sin(a), cy + R * math.cos(a))

def f(v): return f'{v:.2f}'.rstrip('0').rstrip('.')

def open_ring(cx, cy, R, half_gap, gap_at=0):
    """Ring stroke with a gap of 2*half_gap degrees centred on `gap_at`."""
    a1, a2 = gap_at + half_gap, gap_at + 360 - half_gap
    x1, y1 = pt(cx, cy, R, a1)
    x2, y2 = pt(cx, cy, R, a2)
    large = 1 if (a2 - a1) > 180 else 0
    # `pt` runs bottom -> right -> top -> left, i.e. anticlockwise on screen,
    # and a1 -> a2 increases, so this arc is drawn with sweep 0.
    return f'M{f(x1)} {f(y1)}A{f(R)} {f(R)} 0 {large} 0 {f(x2)} {f(y2)}'

def keyhole(cx, cy, R, r, half_gap):
    """The full open-source mark: outer ring, radial legs, inner ring."""
    p1 = pt(cx, cy, R, -half_gap); p2 = pt(cx, cy, R, half_gap)
    q1 = pt(cx, cy, r, -half_gap); q2 = pt(cx, cy, r, half_gap)
    return (f'M{f(p1[0])} {f(p1[1])}A{f(R)} {f(R)} 0 1 1 {f(p2[0])} {f(p2[1])}'
            f'L{f(q2[0])} {f(q2[1])}A{f(r)} {f(r)} 0 1 0 {f(q1[0])} {f(q1[1])}Z')

def check(vx, vy, short, long_, tilt=45):
    """Vertex plus a short arm up-left and a long arm up-right."""
    a = math.radians(tilt)
    return (f'M{f(vx - short*math.cos(a))} {f(vy - short*math.sin(a))}'
            f'L{f(vx)} {f(vy)}'
            f'L{f(vx + long_*math.cos(a))} {f(vy - long_*math.sin(a))}')

def doc(body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
            'viewBox="0 0 64 64" shape-rendering="geometricPrecision">\n'
            + body + '\n</svg>\n')

def stroke(d, color, w):
    return (f'  <path d="{d}" fill="none" stroke="{color}" stroke-width="{f(w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')

variants = {}

# --- 01  ring-check -------------------------------------------------------
# The open-source ring reduced to its outer arc - the bottom gap is what makes
# the mark recognisable - with the checkmark set in the void it leaves.
SW = 5.8
body = [f'  <rect width="64" height="64" fill="{PAPER}"/>',
        stroke(open_ring(32, 32.6, 23.1, 27), ACCENT, SW),
        stroke(check(29.4, 40, 10, 19), ACCENT, SW)]
variants['01-ring-check'] = doc('\n'.join(body))

# --- 02  check-break ------------------------------------------------------
# One idea instead of two: the ring's gap is the hole the check escapes
# through, so the two glyphs share a single event rather than nesting.
SW = 5.8
body = [f'  <rect width="64" height="64" fill="{PAPER}"/>',
        stroke(open_ring(31.5, 33, 22.4, 19, gap_at=137), ACCENT, SW),
        stroke(check(26, 41.5, 9.6, 40, tilt=47), ACCENT, SW)]
variants['02-check-break'] = doc('\n'.join(body))

# --- 03  keyhole-badge ----------------------------------------------------
# The open-source mark kept whole - keyhole, legs and all - with the check
# carried in a badge, the way a verification mark rides a profile picture.
body = [f'  <rect width="64" height="64" fill="{PAPER}"/>',
        stroke(keyhole(28.5, 28, 20, 9.6, 24), ACCENT, 4.3),
        f'  <circle cx="51" cy="51" r="11" fill="{PAPER}"/>',
        f'  <circle cx="51" cy="51" r="8.7" fill="{ACCENT}"/>',
        stroke(check(49.9, 54.5, 3.5, 6.7), PAPER, 2.7)]
variants['03-keyhole-badge'] = doc('\n'.join(body))

# --- 04  solid-knockout ---------------------------------------------------
# 01 inverted: a solid accent tile holds its own against a light or a dark
# tab strip instead of borrowing the browser's chrome for contrast.
SW = 5.6
body = [f'  <rect width="64" height="64" fill="{ACCENT}"/>',
        stroke(open_ring(32, 32.6, 21.6, 27), PAPER, SW),
        stroke(check(29.5, 39.2, 9.4, 17.8), PAPER, SW)]
variants['04-solid-knockout'] = doc('\n'.join(body))

os.makedirs(OUT, exist_ok=True)
for name, svg in variants.items():
    open(f'{OUT}/{name}.svg', 'w').write(svg)
    print(name)
