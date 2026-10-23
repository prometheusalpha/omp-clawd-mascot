// Column pitch is exact (width / 8); row bands come from the alpha projection
// because row heights differ.
// Slice the crab sheet on its 8-column grid into sprites/<animation>/NN.png.
// Usage: bun slice.ts [sheet.webp] [names] [maxFrames] [palette]
//   names:     comma-separated, one per row; rows past the list are skipped
//   maxFrames: keep only the leading columns of every row (idle is a 3-frame loop)
//   palette:   comma-separated hex; remap every crop onto it, dropping the
//              compression shades and the magenta left in transparent pixels
const HERE = import.meta.dir;
const SRC = Bun.argv[2] ?? `${HERE}/sheet.webp`;
const OUT = `${HERE}/sprites`;
const [SW, SH] = Bun.spawnSync(["magick", SRC, "-format", "%wx%h", "info:"]).stdout.toString().trim().split("x").map(Number) as [number, number];
const W = SW, H = SH, COLS = 8, CELL_W = W / COLS;
const NAMES = Bun.argv[3]?.split(",") ?? ["headphones-old", "skate-a", "skate-b", "miner", "pale", "sleep", "run-spark", "skate-c", "detective"];
const MAX_FRAMES = Bun.argv[4] ? Number(Bun.argv[4]) : Infinity;
const PALETTE = Bun.argv[5]?.split(",") ?? [];
const a = new Uint8Array(Bun.spawnSync(["magick", SRC, "-alpha", "extract", "-depth", "8", "gray:-"]).stdout);
const filled = (x: number, y: number) => a[y * W + x] > 24;
const bands: Array<[number, number]> = [];
let start = -1;
for (let y = 0; y < H; y++) {
  let any = false;
  for (let x = 0; x < W; x++) if (filled(x, y)) { any = true; break; }
  if (any && start < 0) start = y;
  if (!any && start >= 0) { bands.push([start, y - 1]); start = -1; }
}
if (start >= 0) bands.push([start, H - 1]);
const merged: Array<[number, number]> = [];
for (const b of bands) {
  const last = merged[merged.length - 1];
  if (last && b[0] - last[1] <= 8) last[1] = b[1];
  else merged.push([...b] as [number, number]);
}
const table: string[][] = [];
const PAL_FILE = PALETTE.length ? `${Bun.env.TMPDIR ?? "/tmp"}/crab-palette.png` : undefined;
if (PAL_FILE) {
  const res = Bun.spawnSync(["magick", ...PALETTE.map(hex => `xc:${hex}`), "+append", PAL_FILE]);
  if (res.exitCode !== 0) throw new Error(res.stderr.toString());
}
for (const [r, [ry0, ry1]] of merged.entries()) {
  const name = NAMES[r];
  if (!name) break;
  // Frames dropped since the last slice would otherwise stay in the pack.
  Bun.spawnSync(["rm", "-rf", `${OUT}/${name}`]);
  // Expand into the gap so antialiased edges survive, never into a neighbour row.
  const prev = merged[r - 1], next = merged[r + 1];
  const y0 = Math.max(0, ry0 - 4, prev ? Math.floor((prev[1] + ry0) / 2) + 1 : 0);
  const y1 = Math.min(H - 1, ry1 + 4, next ? Math.floor((ry1 + next[0]) / 2) : H - 1);
  const h = y1 - y0 + 1;
  const counts: number[] = [];
  for (let c = 0; c < COLS && c < MAX_FRAMES; c++) {
    const x0 = c * CELL_W;
    let any = false;
    for (let y = y0; y <= y1 && !any; y++) for (let x = x0; x < x0 + CELL_W; x++) if (filled(x, y)) { any = true; break; }
    if (!any) continue;
    const file = `${OUT}/${name}/${String(c + 1).padStart(2, "0")}.png`;
    Bun.spawnSync(["mkdir", "-p", `${OUT}/${name}`]);
    const crop = ["-crop", `${CELL_W}x${h}+${x0}+${y0}`, "+repage"];
    // The sheets keep the magenta their silhouettes were cut against as opaque
    // pixels along every edge. Drop them before remapping, otherwise they take
    // the nearest palette slot (blue) and ring the whole crab.
    const clean = ["-fx", "((r>g+0.15)&&(b>g+0.15)&&(abs(r-b)<0.4*max(r,b)))?0:u"];
    // `-remap` drops alpha, so the crop's own alpha is copied back over the result.
    const res = PAL_FILE
      ? Bun.spawnSync(["magick", SRC, ...crop, ...clean, "-background", PALETTE[0]!, "-alpha", "remove", "-alpha", "off", "-dither", "None", "-remap", PAL_FILE, "(", SRC, ...crop, ...clean, "-alpha", "extract", ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite", "-depth", "8", "-strip", file])
      : Bun.spawnSync(["magick", SRC, ...crop, "-strip", file]);
    if (res.exitCode !== 0) throw new Error(res.stderr.toString());
    counts.push(c + 1);
  }
  table.push([name, String(r), `${y0}-${y1} (h=${h})`, String(counts.length), counts.join(",")]);
}
console.log(["anim", "row", "band", "frames", "cols"].join("\t"));
for (const row of table) console.log(row.join("\t"));
