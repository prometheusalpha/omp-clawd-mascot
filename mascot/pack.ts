// Pack sprites/ (sliced from the crab sheets) into palette-indexed art-pixel
// grids consumed by mascot-bubble.ts. Run after re-slicing a sheet.
// The sheet is pixel art scaled by a constant factor, so each art pixel is the
// majority colour of a small block (see sampleColor) rather than an average,
// which would bleed the 1-pixel eyes and the silhouette into the body.
// Pitch comes from the animation's union bbox, which keeps every frame of an
// animation on the same scale and the widget height fixed across animations.
const HERE = import.meta.dir;
const ROOT = `${HERE}/sprites`;
const COLS = 16;
const PX_ROWS = 12;
const ANIMS = ["headphones", "skate-a", "skate-b", "miner", "pale", "sleep", "run-spark", "skate-c", "detective"];
/** Animations drawn without the sheet's black rim; the silhouette is the edge. */
const RIMLESS: Record<string, true> = { headphones: true };
/** Cut radius in source pixels: the drawn outline is one art module (~7px); 12 also takes the ring baked around it. */
const RIM_PX = 12;

type Frame = { w: number; h: number; rgba: Uint8Array };

async function load(file: string): Promise<Frame> {
  const [w, h] = Bun.spawnSync(["magick", file, "-format", "%wx%h", "info:"]).stdout.toString().trim().split("x").map(Number);
  return { w: w!, h: h!, rgba: new Uint8Array(Bun.spawnSync(["magick", file, "-depth", "8", "RGBA:-"]).stdout) };
}


/** The sheets keep the magenta their silhouettes were cut against, so an opaque
 * fringe pixel is magenta-ish rather than a blend of the art. */
const isFringe = (r: number, g: number, b: number) => r > g + 40 && b > g + 40 && Math.abs(r - b) < 0.4 * Math.max(r, b);

/**
 * Colour of the art pixel centred at (x, y): the most common colour in its 3x3
 * block. The sheets are flat fills, so one pixel is the whole art pixel, but
 * lossy compression leaves a 1-pixel fringe along every silhouette; a single
 * sample that lands on the fringe drags a stray colour into the pack, while the
 * fringe cannot outvote a 3x3 block. Blocks with no majority (the tips of the
 * legs, the corner of a claw) fall back to their centre pixel instead of
 * vanishing, which would notch the silhouette.
 */
function sampleColor(f: Frame, x: number, y: number): number[] | null {
  // 16-level buckets: compression noise spreads one fill over a few shades, so
  // exact matches would never reach a majority on the older sheets.
  const counts = new Map<string, { rgb: number[]; n: number }>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = x + dx, sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) continue;
      const i = (sy * f.w + sx) * 4;
      const [r, g, b] = [f.rgba[i]!, f.rgba[i + 1]!, f.rgba[i + 2]!];
      if (f.rgba[i + 3]! < 100) continue;
      // The sheets keep the magenta their silhouettes were cut against, so an
      // opaque fringe pixel is magenta-ish rather than a blend of the art.
      if (isFringe(r, g, b)) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const hit = counts.get(key);
      if (hit) {
        hit.rgb[0] = hit.rgb[0]! + r;
        hit.rgb[1] = hit.rgb[1]! + g;
        hit.rgb[2] = hit.rgb[2]! + b;
        hit.n++;
      } else counts.set(key, { rgb: [r, g, b], n: 1 });
    }
  }
  let best: { rgb: number[]; n: number } | undefined;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  if (best && best.n >= 5) return best.rgb.map(v => Math.round(v / best.n));
  const i = (y * f.w + x) * 4;
  const [r, g, b] = [f.rgba[i]!, f.rgba[i + 1]!, f.rgba[i + 2]!];
  return f.rgba[i + 3]! >= 128 && !isFringe(r, g, b) ? [r, g, b] : null;
}

function unionBox(frames: Frame[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const f of frames)
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = (y * f.w + x) * 4;
        // Fringe pixels are opaque but never sampled, and they ring the whole
        // silhouette: counting them would pad the box on every side and shrink
        // the art that the pitch has to fit.
        if (f.rgba[i + 3]! < 128 || isFringe(f.rgba[i]!, f.rgba[i + 1]!, f.rgba[i + 2]!)) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

/**
 * Cut the silhouette outline out of `f`. The sheets outline every shape in
 * black, and at 16x12 that rim is a whole art pixel around the crab: it reads
 * as a heavy border and, worse, merges the legs into a slab. Black within
 * RIM_PX of the transparency goes transparent instead, so the terminal shows
 * the orange body and the legs stay apart. Interior black (the eyes) is
 * farther than RIM_PX and survives.
 */
function cutOutline(f: Frame) {
  const { w, h, rgba } = f;
  // Sheet antialiasing is a soft rim of its own; drop it or it stretches the
  // union bbox, which shrinks every frame to make room for pixels that never
  // survive sampling.
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3]! < 128) rgba.fill(0, i * 4, i * 4 + 4);
  const dist = new Int32Array(w * h).fill(RIM_PX + 1);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3]! < 128) { dist[i] = 0; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!, d = dist[i]!;
    if (d === RIM_PX) continue;
    const x = i % w, y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j]! > d + 1) { dist[j] = d + 1; queue.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (dist[i]! > RIM_PX) continue;
    if (rgba[i * 4]! + rgba[i * 4 + 1]! + rgba[i * 4 + 2]! > 90) continue;
    rgba[i * 4 + 3] = 0;
  }
}

const out: Record<string, { palette: string[]; frames: string[][] }> = {};
for (const anim of ANIMS) {
  const dir = `${ROOT}/${anim}`;
  const files = [...new Bun.Glob("*.png").scanSync(dir)].sort().map(n => `${dir}/${n}`);
  const frames: Frame[] = [];
  for (const file of files) frames.push(await load(file));
  if (RIMLESS[anim]) for (const f of frames) cutOutline(f);
  const box = unionBox(frames);
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  // Square art pixels: one pitch for both axes, large enough to fit the canvas.
  const pitch = Math.max(bw / COLS, bh / PX_ROWS);
  const drawCols = Math.round(bw / pitch), drawH = Math.round(bh / pitch);
  const offX = Math.floor((COLS - drawCols) / 2), offY = PX_ROWS - drawH;

  const grids: Array<Array<number[] | null>> = [];
  for (const f of frames) {
    const grid: Array<Array<number[] | null>> = Array.from({ length: PX_ROWS }, () => Array(COLS).fill(null));
    for (let row = 0; row < drawH; row++) {
      for (let col = 0; col < drawCols; col++) {
        const sx = Math.round(box.x0 + (col + 0.5) * pitch);
        const sy = Math.round(box.y0 + (row + 0.5) * pitch);
        const px = sampleColor(f, sx, sy);
        if (!px) continue;
        grid[offY + row]![offX + col] = px;
      }
    }
    // The sheet frames are not registered against each other: the crab sits a
    // row higher in some of them, and a shared grid turns that into a bob. Sit
    // every frame on the canvas floor instead.
    let floor = PX_ROWS - 1;
    while (floor >= 0 && !grid[floor]!.some(cell => cell)) floor--;
    const shift = PX_ROWS - 1 - floor;
    if (shift > 0) {
      for (let row = PX_ROWS - 1; row >= shift; row--) grid[row] = grid[row - shift]!;
      for (let row = 0; row < shift; row++) grid[row] = Array(COLS).fill(null);
    }
    grids.push(grid);
  }

  // Merge near-identical colours then keep the most frequent ones. Lossy sheet
  // compression scatters a flat colour into shades that dodge fixed bucket keys,
  // so the merge is distance-based: walk colours by frequency and keep the first
  // one that is not a near-duplicate of a keeper. Without it the idle crab's blue
  // earpieces lose their slots to a dozen shades of the body orange.
  const MERGE_R2 = 40 ** 2;
  const freq = new Map<string, { rgb: number[]; n: number }>();
  for (const g of grids) for (const row of g) for (const px of row) {
    if (!px) continue;
    const key = px.join(",");
    const hit = freq.get(key);
    if (hit) hit.n++;
    else freq.set(key, { rgb: px, n: 1 });
  }
  const palette: number[][] = [];
  for (const c of [...freq.values()].sort((a, b) => b.n - a.n)) {
    if (palette.length === 12) break;
    if (palette.some(p => (p[0]! - c.rgb[0]!) ** 2 + (p[1]! - c.rgb[1]!) ** 2 + (p[2]! - c.rgb[2]!) ** 2 < MERGE_R2)) continue;
    palette.push(c.rgb);
  }
  const hex = (c: number[]) => "#" + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  out[anim] = {
    palette: palette.map(hex),
    frames: grids.map(g => g.map(row => row.map(px => {
      if (!px) return "0";
      let best = 0, bestD = Infinity;
      for (let c = 0; c < palette.length; c++) {
        const d = (px[0]! - palette[c]![0]!) ** 2 + (px[1]! - palette[c]![1]!) ** 2 + (px[2]! - palette[c]![2]!) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      return (best + 1).toString(36);
    }).join(""))),
  };
}
// Emitted as a .ts module so the extension loads through Bun's ordinary module
// graph without depending on JSON loader support in the extension pipeline.
const payload = { cols: COLS, pxRows: PX_ROWS, anims: out };
const body = `// Generated by pack.ts from sprites/. Do not edit by hand.
export default ${JSON.stringify(payload, null, "\t")} as const;
`;
await Bun.write(`${HERE}/frames.ts`, body);
console.log("bytes:", body.length);
for (const [n, a] of Object.entries(out)) console.log(n, a.frames.length, a.palette.join(" "));
