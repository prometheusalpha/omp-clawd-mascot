// Column pitch is exact (width / 8); row bands come from the alpha projection
// because row heights differ.
// Slice the crab sheet on its 8-column grid into sprites/<animation>/NN.png.
// Usage: bun slice.ts <sheet.webp>
const HERE = import.meta.dir;
const SRC = Bun.argv[2] ?? `${HERE}/sheet.webp`;
const OUT = `${HERE}/sprites`;
const [SW, SH] = Bun.spawnSync(["magick", SRC, "-format", "%wx%h", "info:"]).stdout.toString().trim().split("x").map(Number) as [number, number];
const W = SW, H = SH, COLS = 8, CELL_W = W / COLS;
const NAMES = ["headphones", "skate-a", "skate-b", "miner", "pale", "sleep", "run-spark", "skate-c", "detective"];
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
for (const [r, [ry0, ry1]] of merged.entries()) {
  const name = NAMES[r] ?? `row-${r}`;
  // Expand into the gap so antialiased edges survive, never into a neighbour row.
  const prev = merged[r - 1], next = merged[r + 1];
  const y0 = Math.max(0, ry0 - 4, prev ? Math.floor((prev[1] + ry0) / 2) + 1 : 0);
  const y1 = Math.min(H - 1, ry1 + 4, next ? Math.floor((ry1 + next[0]) / 2) : H - 1);
  const h = y1 - y0 + 1;
  const counts: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const x0 = c * CELL_W;
    let any = false;
    for (let y = y0; y <= y1 && !any; y++) for (let x = x0; x < x0 + CELL_W; x++) if (filled(x, y)) { any = true; break; }
    if (!any) continue;
    const file = `${OUT}/${name}/${String(c + 1).padStart(2, "0")}.png`;
    Bun.spawnSync(["mkdir", "-p", `${OUT}/${name}`]);
    const res = Bun.spawnSync(["magick", SRC, "-crop", `${CELL_W}x${h}+${x0}+${y0}`, "+repage", file]);
    if (res.exitCode !== 0) throw new Error(res.stderr.toString());
    counts.push(c + 1);
  }
  table.push([name, String(r), `${y0}-${y1} (h=${h})`, String(counts.length), counts.join(",")]);
}
console.log(["anim", "row", "band", "frames", "cols"].join("\t"));
for (const row of table) console.log(row.join("\t"));
