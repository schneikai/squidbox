# Regenerate (from apps/mobile, needs Pillow): python3 scripts/traceOctopus.py assets/splash.png > src/components/octopus/octopusParts.json
"""Traces the splash octopus into parts for the Octopus component's bending idle animation.

Output (JSON): every part as a simplified polygon [[x, y, sharp], ...] in the cropped image's pixels,
plus where that crop sits in the splash image and the logo's palette. Arms come with a root (where
they leave the body, which never moves) and a tip, so the app can bend each arm around its root. The
arms reach on behind the head, which is drawn over them, so no hairline shows where they meet, however
the head squeezes. The mouth's centre is where the bubbles start, the head's bottom centre where it
squeezes from.
"""
import json
import math
import sys
from collections import deque

from PIL import Image

full = Image.open(sys.argv[1]).convert('RGBA')
box = full.getchannel('A').getbbox()
im = full.crop(box)
W, H = im.size
px = im.load()
CUT = 300  # where the head ends and the front arms begin
BEHIND = 24  # how far the back arms reach on behind the body
FIXED = 0.25  # OctopusArm's FIXED: the share of an arm, from its root, that never bends
SEED = 370  # a row where the front arms are apart
ARMS = {'back': 2, 'front': 5}  # Octopus.jsx's DRAWN names each one

PAL = {
    'head': (0xFF, 0x69, 0x30), 'shade': (0xFF, 0x54, 0x26), 'back': (0xF0, 0x44, 0x24),
    'backShade': (0xD8, 0x3D, 0x24), 'mouthLight': (0xFF, 0xAE, 0x8B), 'mouth': (0xFF, 0x95, 0x68),
    'eye': (0x43, 0x3F, 0x43),
}
cls = [[None] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a >= 128:
            cls[y][x] = min(PAL, key=lambda k: sum((c - d) ** 2 for c, d in zip((r, g, b), PAL[k])))

NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def inside(x, y):
    return 0 <= x < W and 0 <= y < H


def components(pred):
    seen = set()
    out = []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or not pred(x, y):
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in NEIGHBOURS:
                    n = (cx + dx, cy + dy)
                    if inside(*n) and n not in seen and pred(*n):
                        seen.add(n)
                        q.append(n)
            out.append(pts)
    return sorted(out, key=len, reverse=True)


def dilate(pts, steps, ok):
    pts = set(pts)
    for _ in range(steps):
        pts |= {(x + dx, y + dy) for (x, y) in pts for dx, dy in NEIGHBOURS
                if inside(x + dx, y + dy) and ok(x + dx, y + dy)}
    return pts


def expect(found, kind):
    if len(found) != ARMS[kind]:
        sys.exit(f'traceOctopus: found {len(found)} {kind} arms, not {ARMS[kind]}; fix the trace or Octopus.jsx')


# The back arms reach below the head; the mouth's inside, in the same colours, doesn't.
backs = [c for c in components(lambda x, y: cls[y][x] in ('back', 'backShade'))
         if len(c) > 200 and max(y for _, y in c) >= CUT]
expect(backs, 'back')
back_set = {p for c in backs for p in c}
opaque = lambda x, y: cls[y][x] is not None
front = lambda x, y: opaque(x, y) and (x, y) not in back_set
# The arms reach on behind the head, up to where its sides meet the back arms: above that, a squeezed
# head would show them.
TOP = max(min(y for x, y in c for dx, dy in NEIGHBOURS if inside(x + dx, y + dy) and front(x + dx, y + dy))
          for c in backs)

# Front arms: seeded where they are apart, grown through the body up to the cut and on behind the head.
label = {}
seeds = [c for c in components(lambda x, y: front(x, y) and SEED <= y < SEED + 6) if len(c) > 10]
expect(seeds, 'front')
q = deque()
for i, c in enumerate(seeds):
    for p in c:
        label[p] = i
        q.append(p)
while q:
    x, y = q.popleft()
    for dx, dy in NEIGHBOURS:
        n = (x + dx, y + dy)
        if inside(*n) and n[1] >= TOP and n not in label and front(*n):
            label[n] = label[(x, y)]
            q.append(n)
# A little overlap with the neighbours, so no hairline shows between two arms.
arms = [dilate([p for p, l in label.items() if l == i], 2, lambda x, y: y >= TOP and front(x, y))
        for i in range(len(seeds))]


def contour(pts):
    s = set(pts)
    changed = True
    while changed:  # fill diagonal-only contacts so every corner has one way out
        changed = False
        for (x, y) in list(s):
            for dx in (1, -1):
                if (x + dx, y + 1) in s and (x + dx, y) not in s and (x, y + 1) not in s:
                    s.add((x + dx, y))
                    changed = True
    edges = {}
    for (x, y) in s:
        if (x, y - 1) not in s: edges[(x, y)] = (x + 1, y)
        if (x + 1, y) not in s: edges[(x + 1, y)] = (x + 1, y + 1)
        if (x, y + 1) not in s: edges[(x + 1, y + 1)] = (x, y + 1)
        if (x - 1, y) not in s: edges[(x, y + 1)] = (x, y)
    loops = []
    while edges:
        start, cur = edges.popitem()
        loop = [start]
        while cur != start and cur in edges:
            loop.append(cur)
            cur = edges.pop(cur)
        loops.append(loop)
    return max(loops, key=len)


def rdp(points, eps):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    idx, dmax = 0, 0
    for i in range(1, len(points) - 1):
        d = abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / n
        if d > dmax:
            idx, dmax = i, d
    if dmax > eps:
        return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def polygon(pts, eps=0.9):
    loop = contour(pts)
    # Average out the pixel stairs before simplifying (a closed moving average over 7 corners).
    n0 = len(loop)
    loop = [(sum(loop[(i + k) % n0][0] for k in range(-3, 4)) / 7, sum(loop[(i + k) % n0][1] for k in range(-3, 4)) / 7)
            for i in range(n0)]
    far = max(range(len(loop)), key=lambda i: math.dist(loop[i], loop[0]))
    simple = rdp(loop[:far + 1], eps)[:-1] + rdp(loop[far:] + [loop[0]], eps)[:-1]
    n = len(simple)
    out = []
    for i, c in enumerate(simple):
        a, b = simple[i - 1], simple[(i + 1) % n]
        turn = abs((math.atan2(b[1] - c[1], b[0] - c[0]) - math.atan2(c[1] - a[1], c[0] - a[0]) + math.pi)
                   % (2 * math.pi) - math.pi)
        # Only the corners of the cut under the head stay sharp; everything else is a smooth curve.
        sharp = turn > math.radians(50) and abs(c[1] - CUT) < 8
        out.append([round(c[0], 1), round(c[1], 1), 1 if sharp else 0])
    return out


def parts_of(region, names):
    # Shading reaches a little past its arm's outline; the page clips it to the arm, so their edges match.
    return [polygon(dilate(c, 4, opaque)) for c in components(lambda x, y: (x, y) in region and cls[y][x] in names) if len(c) > 30]


out = {'image': list(full.size), 'offset': list(box[:2]), 'size': [W, H],
       'colors': {k: '#%02X%02X%02X' % v for k, v in PAL.items()}, 'arms': []}
for c in backs:
    xs = [x for x, _ in c]
    left = sum(xs) / len(xs) < W / 2
    inner = max(c) if left else min(c)
    tip = min(c) if left else max(c)
    ux, uy = tip[0] - inner[0], tip[1] - inner[1]
    fixed = lambda x, y: ((x - inner[0]) * ux + (y - inner[1]) * uy) / (ux * ux + uy * uy) < FIXED
    # Reaches on behind the body and the front arms' roots, only where it never bends.
    region = dilate(c, BEHIND, lambda x, y: y >= TOP and front(x, y) and fixed(x, y))
    out['arms'].append({'back': True, 'root': list(inner), 'tip': list(tip), 'shape': polygon(region),
                        'shades': parts_of(region, ('backShade',))})
for a in sorted(arms, key=lambda c: sum(x for x, _ in c) / len(c)):
    top = [p for p in a if p[1] == CUT]
    root = [sum(x for x, _ in top) / len(top), CUT]
    tip = max(a, key=lambda p: math.dist(p, root))
    out['arms'].append({'back': False, 'root': root, 'tip': list(tip), 'shape': polygon(a),
                        'shades': parts_of(set(a), ('shade',))})

head = components(lambda x, y: y < CUT and front(x, y))[0]
out['head'] = polygon(head)
bottom = [x for x, y in head if y == CUT - 1]
out['headBase'] = [(min(bottom) + max(bottom) + 1) / 2, CUT]
eyes = [c for c in components(lambda x, y: cls[y][x] == 'eye') if len(c) > 50][:2]
out['eyes'] = [{'cx': sum(x for x, _ in e) / len(e) + 0.5, 'cy': sum(y for _, y in e) / len(e) + 0.5,
                'rx': (max(x for x, _ in e) - min(x for x, _ in e) + 1) / 2,
                'ry': (max(y for _, y in e) - min(y for _, y in e) + 1) / 2} for e in eyes]
in_mouth = lambda x, y: y < CUT and front(x, y) and cls[y][x] in ('mouth', 'mouthLight', 'shade', 'back', 'backShade')
mouth = components(in_mouth)[0]
out['mouth'] = polygon(mouth)
out['mouthCenter'] = [round(sum(x for x, _ in mouth) / len(mouth) + 0.5, 1), round(sum(y for _, y in mouth) / len(mouth) + 0.5, 1)]
out['mouthLight'] = [polygon(c) for c in components(lambda x, y: cls[y][x] == 'mouthLight') if len(c) > 30]
out['mouthIn'] = [polygon(c) for c in components(lambda x, y: y < CUT and front(x, y) and cls[y][x] in ('shade', 'back', 'backShade')) if len(c) > 30]
print(json.dumps(out, separators=(',', ':')))
