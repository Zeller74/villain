# Makes the paintings in web/public/locations from the wiki's scans of the boards, by taking off
# the printed symbols and the see-through Hero band. No clean copy of this art is published.
#
#   python scripts/clean-locations.py <folder of <villain>.jpg scans> web/public/locations [villain/slot ...]
#
# Needs opencv-python and numpy, and a scan at its full size, about 4470px wide. Each location
# takes about half a minute. Check the results by eye: the filled areas are a guess at what the
# symbols covered, so they hold up on sky, water and foliage and less well on busy scenes.
#
# The band is only a tint, so it is lifted off and the real art comes back. The symbols are solid
# discs with nothing under them, so those areas are filled with texture copied from elsewhere on
# the same tile, working in from the edge so that lines in the painting carry on across the gap.
import os
import sys
import cv2
import numpy as np

SCANS, OUT = sys.argv[1:3]
ONLY = sys.argv[3:]

# how many symbols each location has in its top and bottom rows, from server/src/data/characters
LAYOUT = {
    "captain": [(2, 2), (2, 2), (2, 2), (2, 2)],
    "prince": [(2, 2), (2, 2), (2, 2), (0, 3)],
    "lady": [(2, 2), (2, 2), (2, 2), (0, 3)],
    "lotso": [(0, 3), (2, 2), (2, 2), (2, 2)],
    "maleficent": [(2, 2), (2, 2), (2, 2), (2, 2)],
    "mother": [(2, 2), (1, 3), (1, 3), (2, 2)],
    "pete": [(2, 2), (2, 2), (2, 2), (2, 2)],
}
COLUMNS = {0: [], 1: [0.50], 2: [0.305, 0.697], 3: [0.19, 0.50, 0.815]}
ROWS = {"top": 0.170, "bottom": 0.825}
RADIUS = 0.132  # of the tile's width, a little past the disc so its rim goes too
# a few tiles print a small padlock in the corner for a location that starts locked
PADLOCKS = {("captain", 3), ("lady", 3)}
PATCH = 14      # half the side of a copied patch
SEARCH = 420    # how far along the row to look for texture
ROW_MARGIN = 45 # texture may come from this far above or below a row of discs
FINAL_CROP = 0.03


def tile_of(scan, slot):
    H, W = scan.shape[:2]
    x0, x1 = int(W * (0.1665 + 0.2082 * slot)), int(W * (0.3665 + 0.2082 * slot))
    return scan[int(H * 0.075):int(H * 0.80), x0:x1].copy()


def strongest_edge(profile, offset):
    return offset + int(np.argmax(profile))


def band_geometry(t):
    """The band sits slightly differently on each scan, so find its edges on this tile."""
    h, w = t.shape[:2]
    g = cv2.GaussianBlur(cv2.cvtColor(t, cv2.COLOR_BGR2GRAY), (0, 0), 1.5).astype(np.float32)
    dy = np.abs(np.diff(g, axis=0))
    dx = np.abs(np.diff(g, axis=1))
    y0, y1 = int(h * 0.33), int(h * 0.385)
    bottom = strongest_edge(np.median(dy[y0:y1, int(w * 0.12):int(w * 0.88)], axis=1), y0)
    x0, x1 = int(w * 0.025), int(w * 0.075)
    left = strongest_edge(np.median(dx[int(h * 0.04):int(h * 0.30), x0:x1], axis=0), x0)
    x0, x1 = int(w * 0.935), int(w * 0.985)
    right = strongest_edge(np.median(dx[int(h * 0.04):int(h * 0.30), x0:x1], axis=0), x0)
    return left, right, bottom


def band_mask(h, w, left, right, bottom):
    corner = int(0.055 * w)
    m = np.zeros((h, w), np.uint8)
    cv2.rectangle(m, (left, 0), (right, bottom - corner), 255, -1)
    cv2.rectangle(m, (left + corner, 0), (right - corner, bottom), 255, -1)
    cv2.circle(m, (left + corner, bottom - corner), corner, 255, -1)
    cv2.circle(m, (right - corner, bottom - corner), corner, 255, -1)
    return m


def disc_centres(t, top, bottom):
    """Starts from the layout and settles on the circle actually printed near that spot."""
    h, w = t.shape[:2]
    g = cv2.medianBlur(cv2.cvtColor(t, cv2.COLOR_BGR2GRAY), 5)
    found = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.2, minDist=w * 0.15, param1=120, param2=30,
                             minRadius=int(w * 0.09), maxRadius=int(w * 0.135))
    circles = [] if found is None else found[0][:, :2]
    centres = []
    for count, y in ((top, ROWS["top"]), (bottom, ROWS["bottom"])):
        for x in COLUMNS[count]:
            want = np.array([x * w, y * h])
            near = [c for c in circles if np.linalg.norm(c - want) < 0.05 * w]
            centres.append(tuple(int(v) for v in (min(near, key=lambda c: np.linalg.norm(c - want)) if near else want)))
    return centres


def tint_of(tiles):
    """The art carries on across the band's edge, so the pixels either side of the bottom edge
    show the tint: inside = slope * outside + offset, one pair of numbers per colour."""
    pairs = []
    for t, band, discs in tiles:
        h, w = band.shape
        ys, xs = np.where(band > 0)
        bottom = {}
        for y, x in zip(ys, xs):
            if y > bottom.get(x, -1):
                bottom[x] = y
        blocked = cv2.dilate(discs, np.ones((15, 15), np.uint8)) > 0
        for x, y in bottom.items():
            if x % 2 or y + 12 >= h or y - 12 < 0 or blocked[y, x]:
                continue
            for off in (12, 15, 18):
                if y + off < h:
                    pairs.append((t[y - off, x], t[y + off, x]))
    inside = np.array([p[0] for p in pairs], np.float32)
    outside = np.array([p[1] for p in pairs], np.float32)
    tint = []
    for c in range(3):
        # a straight fit, ignoring the pairs where the art really does change across the edge
        slope, offset = np.polyfit(outside[:, c], inside[:, c], 1)
        for _ in range(4):
            err = np.abs(inside[:, c] - (slope * outside[:, c] + offset))
            good = err < np.percentile(err, 70)
            slope, offset = np.polyfit(outside[good, c], inside[good, c], 1)
        tint.append((float(np.clip(slope, 0.3, 1.0)), float(offset)))
    return tint


def lift_band(t, band, tint):
    out = t.astype(np.float32)
    for c, (slope, offset) in enumerate(tint):
        channel = out[:, :, c]
        channel[band > 0] = np.clip((channel[band > 0] - offset) / slope, 0, 255)
    return out.astype(np.uint8)


def settle_seam(lifted, original, band, edge_y):
    """Evens out the tone step left along the bottom of the band, fading out as it goes up."""
    h, w = band.shape
    out = lifted.astype(np.float32)
    inside = np.median(lifted[edge_y - 22:edge_y - 11], axis=0).astype(np.float32)
    outside = np.median(original[edge_y + 11:edge_y + 22], axis=0).astype(np.float32)
    gap = cv2.GaussianBlur((outside - inside)[None], (0, 0), sigmaX=45)[0]
    fade = np.exp(-np.maximum(0, edge_y - np.arange(h)) / 75.0)[:, None, None]
    out += (band[:, :, None] > 0) * fade * gap[None]
    return np.clip(out, 0, 255).astype(np.uint8)


def fill(img, hole):
    """Exemplar inpainting: repeatedly take the most promising patch on the edge of the gap, find
    the best match for its known part nearby, and copy across what is missing."""
    img = img.copy()
    hole = (hole > 0).astype(np.uint8)
    h, w = hole.shape
    confidence = (1 - hole).astype(np.float32)
    size = 2 * PATCH + 1
    kernel = np.ones((size, size), np.uint8)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    while hole.any():
        front = (cv2.dilate(hole, np.ones((3, 3), np.uint8)) - hole) > 0
        ys, xs = np.where(front)
        ys_ok = (ys >= PATCH) & (ys < h - PATCH) & (xs >= PATCH) & (xs < w - PATCH)
        if not ys_ok.any():
            # whatever is left touches the edge of the image
            img = cv2.inpaint(img, hole * 255, 5, cv2.INPAINT_TELEA)
            break
        ys, xs = ys[ys_ok], xs[ys_ok]
        # lines in the painting pull the fill along them, and well-known patches go first
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3) * (1 - hole)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3) * (1 - hole)
        nx = cv2.Sobel(hole.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
        ny = cv2.Sobel(hole.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
        norm = np.sqrt(nx ** 2 + ny ** 2) + 1e-6
        strength = np.abs(gy * nx - gx * ny) / norm
        conf = cv2.blur(confidence, (size, size))
        grad = cv2.blur(strength, (5, 5))
        score = conf[ys, xs] * (grad[ys, xs] / 255 + 0.05)
        i = int(np.argmax(score))
        py, px = int(ys[i]), int(xs[i])

        y0, y1 = max(0, py - SEARCH), min(h, py + SEARCH + 1)
        x0, x1 = max(0, px - SEARCH), min(w, px + SEARCH + 1)
        roi = img[y0:y1, x0:x1]
        target = img[py - PATCH:py + PATCH + 1, px - PATCH:px + PATCH + 1]
        known = (hole[py - PATCH:py + PATCH + 1, px - PATCH:px + PATCH + 1] == 0)
        tpl_mask = np.repeat(known[:, :, None], 3, axis=2).astype(np.float32)
        result = cv2.matchTemplate(roi.astype(np.float32), target.astype(np.float32), cv2.TM_SQDIFF, mask=tpl_mask)
        # only patches made entirely of real pixels may be copied from
        whole = cv2.erode(1 - hole[y0:y1, x0:x1], kernel, borderType=cv2.BORDER_CONSTANT, borderValue=0)
        allowed = whole[PATCH:PATCH + result.shape[0], PATCH:PATCH + result.shape[1]]
        result = np.where(np.isfinite(result) & (allowed > 0), result, np.inf)
        if not np.isfinite(result).any():
            img = cv2.inpaint(img, hole * 255, 5, cv2.INPAINT_TELEA)
            break
        sy, sx = np.unravel_index(int(np.argmin(result)), result.shape)
        source = roi[sy:sy + size, sx:sx + size]
        missing = ~known
        target[missing] = source[missing]
        region = confidence[py - PATCH:py + PATCH + 1, px - PATCH:px + PATCH + 1]
        region[missing] = conf[py, px]
        hole[py - PATCH:py + PATCH + 1, px - PATCH:px + PATCH + 1][missing] = 0
        gray[py - PATCH:py + PATCH + 1, px - PATCH:px + PATCH + 1] = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)
    return img


for villain, slots in LAYOUT.items():
    if ONLY and not any(o.startswith(villain + "/") for o in ONLY):
        continue
    scan = cv2.imread(f"{SCANS}/{villain}.jpg", cv2.IMREAD_COLOR)
    prepared = []
    for slot, (top, bottom) in enumerate(slots):
        t = tile_of(scan, slot)
        h, w = t.shape[:2]
        left, right, edge = band_geometry(t)
        centres = disc_centres(t, top, bottom)
        discs = np.zeros((h, w), np.uint8)
        for c in centres:
            cv2.circle(discs, c, int(RADIUS * w), 255, -1)
        if (villain, slot) in PADLOCKS:
            cv2.circle(discs, (int(0.925 * w), int(0.93 * h)), int(0.06 * w), 255, -1)
        prepared.append((t, band_mask(h, w, left, right, edge), discs, edge))
    tint = tint_of([p[:3] for p in prepared])
    print(villain, "tint", [(round(a, 2), round(b)) for a, b in tint], flush=True)
    for slot, (t, band, discs, edge) in enumerate(prepared):
        if ONLY and f"{villain}/{slot}" not in ONLY:
            continue
        h, w = band.shape
        lifted = settle_seam(lift_band(t, band, tint), t, band, edge)
        # the thin line round the band is printed, so it is painted out from either side
        k = np.ones((3, 3), np.uint8)
        ring = cv2.dilate(band, k, iterations=9) - cv2.erode(band, k, iterations=9)
        ring[discs > 0] = 0
        healed = cv2.inpaint(lifted, ring, 7, cv2.INPAINT_TELEA)
        filled = healed.copy()
        for rows in (range(0, h // 2), range(h // 2, h)):
            row_mask = np.zeros_like(discs)
            row_mask[rows.start:rows.stop] = discs[rows.start:rows.stop]
            where = np.where(row_mask.any(axis=1))[0]
            if len(where) == 0:
                continue
            y0, y1 = max(0, where[0] - ROW_MARGIN), min(h, where[-1] + ROW_MARGIN + 1)
            filled[y0:y1] = fill(filled[y0:y1], row_mask[y0:y1])
        # smooth what was copied in, so it reads as paint rather than as patches
        calm = cv2.bilateralFilter(filled, 11, 28, 7)
        calm = cv2.GaussianBlur(calm, (0, 0), 1.6)
        inside = cv2.GaussianBlur(discs, (0, 0), 2).astype(np.float32)[:, :, None] / 255
        filled = (calm * inside + filled * (1 - inside)).astype(np.uint8)
        # feather the join so no edge of the disc is left showing
        soft = cv2.GaussianBlur(cv2.dilate(discs, k, iterations=1), (0, 0), 3).astype(np.float32)[:, :, None] / 255
        final = (filled * soft + healed * (1 - soft)).astype(np.uint8)
        m = int(FINAL_CROP * w)
        os.makedirs(f"{OUT}/{villain}", exist_ok=True)
        cv2.imwrite(f"{OUT}/{villain}/L{slot + 1}.webp", final[m:h - m, m:w - m], [cv2.IMWRITE_WEBP_QUALITY, 86])
        print("done", villain, slot, flush=True)
