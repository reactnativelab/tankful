#!/usr/bin/env node
/**
 * Regenerates every launcher/splash asset under assets/images/ from the two
 * brand source PNGs. Run it after either source changes:
 *
 *   node scripts/generate-brand-assets.js
 *
 * Sources, and why both are needed:
 *   app-icon-tankful.png     152x150, opaque. The icon as designed: the orange
 *                            drop-and-gauge mark centred on a soft diagonal
 *                            gradient plate. Far below the 1024px stores want,
 *                            so it is the authority for *composition and
 *                            background*, not for mark detail.
 *   splash-screen-tankful.png 876x1796, opaque. Full-bleed artwork that happens
 *                            to carry the same mark at 164x217 -- ~1.8x the
 *                            linear resolution of the copy in the icon plate.
 *                            It is the authority for *mark detail*.
 *
 * Neither source is vector, so every output is still an upscale. Replace both
 * with an SVG master if one ever turns up and this script gets much shorter.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const IMAGES = path.join(__dirname, '..', 'assets', 'images');
const ICON_SRC = path.join(IMAGES, 'app-icon-tankful.png');
const ARTWORK_SRC = path.join(IMAGES, 'splash-screen-tankful.png');

const CANVAS = 1024;

/** The mark's bounding box inside the splash artwork, with a few px of slack. */
const ARTWORK_MARK_CROP = { left: 325, top: 287, width: 212, height: 262 };

/** The mark fills 118 of the source plate's 150px of height, dead centre. */
const PLATE_MARK_HEIGHT = 118 / 150;

/**
 * Android reserves the outer 18dp of a 108dp adaptive icon, leaving the inner
 * 72dp -- 66.67% -- as the only region every launcher mask keeps. A circular
 * mask keeps only the circle inscribed in that square, so the foreground is
 * sized by the mark's *enclosing circle*, not its bounding box.
 */
const SAFE_ZONE = 0.66;

/** Transparent margin around the mark on the splash icon canvas. */
const SPLASH_MARK_HEIGHT = 0.85;

/** Lossless -- the plate is a smooth gradient and would band under a palette. */
const PNG_OPTS = { compressionLevel: 9 };

// --- mark extraction --------------------------------------------------------

/**
 * Pulls the orange mark off the smooth light background it is baked onto.
 *
 * The mark is the only strongly warm thing in either crop, so: flag it by hue,
 * least-squares-fit a bilinear model of the background to everything else, then
 * solve the compositing equation C = aF + (1-a)B on the blue channel -- orange
 * has almost none of it and both backgrounds have plenty, which makes that one
 * channel a clean matte -- and un-premultiply to recover the mark's own colour.
 */
async function keyMark(src, crop) {
  const loaded = crop ? sharp(src).extract(crop) : sharp(src);
  const { data, info } = await loaded.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const at = (x, y, c) => data[(y * w + x) * channels + c];

  const isMark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y, 0) - at(x, y, 2) > 45 && at(x, y, 0) > 120) isMark[y * w + x] = 1;
    }
  }

  const grow = (mask, radius) => {
    const grown = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) grown[ny * w + nx] = 1;
          }
        }
      }
    }
    return grown;
  };
  // Anti-aliased fringes are part mark, part background: keep them out of the
  // background fit, but still let them produce a partial alpha below.
  const excludedFromFit = grow(isMark, 2);
  const couldBeMark = grow(isMark, 3);

  const model = [];
  for (let c = 0; c < 3; c++) {
    const normal = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const rhs = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (excludedFromFit[y * w + x]) continue;
        const u = x / w;
        const v = y / h;
        const basis = [1, u, v, u * v];
        const value = at(x, y, c);
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) normal[i][j] += basis[i] * basis[j];
          rhs[i] += basis[i] * value;
        }
      }
    }
    model.push(solve4(normal, rhs));
  }
  const backgroundAt = (x, y, c) => {
    const u = x / w;
    const v = y / h;
    const [a, b, d, e] = model[c];
    return a + b * u + d * v + e * u * v;
  };

  // The mark's own blue level, taken low in the distribution so anti-aliased
  // edges don't drag it toward the background.
  const markBlues = [];
  for (let i = 0; i < w * h; i++) if (isMark[i]) markBlues.push(data[i * channels + 2]);
  markBlues.sort((a, b) => a - b);
  const markBlue = markBlues[Math.floor(markBlues.length * 0.1)];

  const keyed = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!couldBeMark[y * w + x]) continue; // stays fully transparent
      const bgBlue = backgroundAt(x, y, 2);
      const alpha = clamp((bgBlue - at(x, y, 2)) / Math.max(1, bgBlue - markBlue), 0, 1);
      if (alpha < 0.03) continue;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const unmixed = (at(x, y, c) - (1 - alpha) * backgroundAt(x, y, c)) / alpha;
        keyed[i + c] = Math.round(clamp(unmixed, 0, 255));
      }
      keyed[i + 3] = Math.round(alpha * 255);
    }
  }

  floodEdgeColour(keyed, w, h);

  const box = alphaBounds(keyed, w, h);
  const png = await sharp(keyed, { raw: { width: w, height: h, channels: 4 } })
    .extract(box)
    .png()
    .toBuffer();

  return { png, width: box.width, height: box.height, backgroundAt, sourceWidth: w, sourceHeight: h };
}

/** Gaussian elimination on a 4x4 system -- the normal equations of the fit. */
function solve4(a, rhs) {
  const m = a.map((row, i) => [...row, rhs[i]]);
  for (let i = 0; i < 4; i++) {
    let pivot = i;
    for (let k = i + 1; k < 4; k++) if (Math.abs(m[k][i]) > Math.abs(m[pivot][i])) pivot = k;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    for (let k = i + 1; k < 4; k++) {
      const f = m[k][i] / m[i][i];
      for (let j = i; j < 5; j++) m[k][j] -= f * m[i][j];
    }
  }
  const out = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let t = m[i][4];
    for (let j = i + 1; j < 4; j++) t -= m[i][j] * out[j];
    out[i] = t / m[i][i];
  }
  return out;
}

/**
 * Rewrites the colour of partly transparent pixels from their opaque
 * neighbours, outward one ring at a time.
 *
 * Un-premultiplying divides by alpha, so the thinner the edge the more it
 * amplifies the source's own sensor noise -- which shows up as a speckled
 * fringe when the mark is scaled down, and costs a lot of PNG. The alpha
 * matte itself is untouched; only the colour under it is replaced.
 */
function floodEdgeColour(rgba, w, h) {
  const CONFIDENT = 230; // ~0.9 alpha
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] >= CONFIDENT) known[i] = 1;

  for (let pass = 0; pass < 8; pass++) {
    const next = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i] || rgba[i * 4 + 3] === 0) continue;
        let n = 0;
        const sum = [0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const j = ny * w + nx;
            if (!known[j]) continue;
            n++;
            for (let c = 0; c < 3; c++) sum[c] += rgba[j * 4 + c];
          }
        }
        if (n) next.push([i, sum.map((v) => Math.round(v / n))]);
      }
    }
    if (!next.length) break;
    for (const [i, rgb] of next) {
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgb[c];
      known[i] = 1;
    }
  }
}

function alphaBounds(rgba, w, h) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** The farthest any opaque pixel sits from the bitmap's centre. */
async function enclosingRadius(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  let max = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 8) continue;
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r > max) max = r;
    }
  }
  return max;
}

/** Scales the mark to `height` px and centres it on a transparent canvas. */
async function centreMark(mark, height) {
  const width = Math.round((height * mark.width) / mark.height);
  const scaled = await sharp(mark.png).resize(width, height, { kernel: 'lanczos3' }).toBuffer();
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, left: Math.round((CANVAS - width) / 2), top: Math.round((CANVAS - height) / 2) }])
    .png(PNG_OPTS);
}

// --- outputs ----------------------------------------------------------------

async function main() {
  const plate = await keyMark(ICON_SRC, null);
  const mark = await keyMark(ARTWORK_SRC, ARTWORK_MARK_CROP);

  // icon.png -- the plate rebuilt at 1024. The gradient comes from the fitted
  // model of the real plate (it is smooth, so it resamples exactly), the mark
  // from the sharper copy in the artwork, at the composition the plate uses.
  // Upscaling the 152x150 plate wholesale instead would halve the mark's
  // effective resolution.
  const side = Math.min(plate.sourceWidth, plate.sourceHeight);
  const offsetX = (plate.sourceWidth - side) / 2;
  const offsetY = (plate.sourceHeight - side) / 2;
  const gradient = Buffer.alloc(CANVAS * CANVAS * 3);
  for (let y = 0; y < CANVAS; y++) {
    for (let x = 0; x < CANVAS; x++) {
      const sx = offsetX + (x / CANVAS) * side;
      const sy = offsetY + (y / CANVAS) * side;
      const i = (y * CANVAS + x) * 3;
      for (let c = 0; c < 3; c++) gradient[i + c] = Math.round(clamp(plate.backgroundAt(sx, sy, c), 0, 255));
    }
  }
  const iconMarkHeight = Math.round(CANVAS * PLATE_MARK_HEIGHT);
  const iconMarkWidth = Math.round((iconMarkHeight * mark.width) / mark.height);
  const iconMark = await sharp(mark.png).resize(iconMarkWidth, iconMarkHeight, { kernel: 'lanczos3' }).toBuffer();
  await sharp(gradient, { raw: { width: CANVAS, height: CANVAS, channels: 3 } })
    .composite([{
      input: iconMark,
      left: Math.round((CANVAS - iconMarkWidth) / 2),
      top: Math.round((CANVAS - iconMarkHeight) / 2),
    }])
    .removeAlpha()
    .png(PNG_OPTS)
    .toFile(path.join(IMAGES, 'icon.png'));

  // adaptive-icon-foreground.png -- the bare mark, sized so its enclosing
  // circle is exactly the 66% safe circle, which is the strictest of the
  // launcher masks. The plate's gradient does not come along; app.json's
  // android.adaptiveIcon.backgroundColor stands in for it.
  const radius = await enclosingRadius(mark.png);
  const safeHeight = Math.round((mark.height * (CANVAS * SAFE_ZONE)) / (2 * radius));
  await (await centreMark(mark, safeHeight)).toFile(path.join(IMAGES, 'adaptive-icon-foreground.png'));

  // splash-icon.png -- the same mark, larger, on transparency. The dark variant
  // is identical: the mark is orange, which holds up on both backgrounds, and
  // expo-splash-screen wants a real file for the -night drawable rather than an
  // image-less dark override.
  const splashIcon = await (await centreMark(mark, Math.round(CANVAS * SPLASH_MARK_HEIGHT))).toBuffer();
  fs.writeFileSync(path.join(IMAGES, 'splash-icon.png'), splashIcon);
  fs.writeFileSync(path.join(IMAGES, 'splash-icon-dark.png'), splashIcon);

  // The flat stand-in for the plate's gradient: its area mean, which for a
  // bilinear fit is simply its value at the centre of the plate.
  const plateColor = toHex([0, 1, 2].map((c) => plate.backgroundAt(plate.sourceWidth / 2, plate.sourceHeight / 2, c)));

  console.log(`mark source        ${mark.width}x${mark.height} keyed out of ${path.basename(ARTWORK_SRC)}`);
  console.log(`icon.png           ${CANVAS}x${CANVAS}, opaque, mark ${iconMarkWidth}x${iconMarkHeight}`);
  console.log(`adaptive foreground${' '.repeat(1)}${CANVAS}x${CANVAS}, transparent, mark fits a ${Math.round(CANVAS * SAFE_ZONE)}px circle`);
  console.log(`splash icons       ${CANVAS}x${CANVAS}, transparent, light and dark identical`);
  console.log('');
  console.log(`app.json android.adaptiveIcon.backgroundColor should be ${plateColor}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
