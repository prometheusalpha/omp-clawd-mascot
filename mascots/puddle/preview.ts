// Renders `art.ts` to `preview.png` beside it so the pixel art can be checked
// outside the TUI: one row per animation, one column per frame, scaled up with
// nearest-neighbour. The sheet uses the terminal's pixel aspect, not square
// pixels, so it matches the TUI. `bun mascots/puddle/preview.ts`.
import { deflateSync } from "node:zlib";
import { ART } from "./art";

const SCALE_X = 12;
// Target cells are 17x47 px (Ghostty, font-size 14, adjust-cell-height 10, 2x);
// one half-block art pixel is 17 wide and 23.5 tall.
const SCALE_Y = Math.round((SCALE_X * 47) / (2 * 17));
const PAD_X = 2 * SCALE_X;
const PAD_Y = 2 * SCALE_Y;
const GAP_X = 2 * SCALE_X;
const GAP_Y = 2 * SCALE_Y;
const ANIMS = ["idle", "working"] as const;

const crc32 = (bytes: Uint8Array): number => {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ 0xffffffff) >>> 0;
};

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** Minimal RGBA8 encoder: one filter-0 scanline per row, one IDAT. */
function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
	const stride = width * 4;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
	}
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header[8] = 8; // bit depth
	header[9] = 6; // colour type: RGBA
	const parts = [
		Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", new Uint8Array()),
	];
	const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png;
}

const palette = ART.palette.map(hex => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16),
] as const);

const frames = ANIMS.map(name => ART.anims[name]!.frames);
const columns = Math.max(...frames.map(anim => anim.length));
const width = PAD_X * 2 + columns * ART.cols * SCALE_X + (columns - 1) * GAP_X;
const height = PAD_Y * 2 + ANIMS.length * ART.pxRows * SCALE_Y + (ANIMS.length - 1) * GAP_Y;
const rgba = new Uint8Array(width * height * 4);

for (const [row, anim] of frames.entries()) {
	const top = PAD_Y + row * (ART.pxRows * SCALE_Y + GAP_Y);
	for (const [column, frame] of anim.entries()) {
		const left = PAD_X + column * (ART.cols * SCALE_X + GAP_X);
		for (const [y, line] of frame.entries()) {
			for (let x = 0; x < line.length; x++) {
				const index = line[x]!;
				if (index === "0") continue;
				const [r, g, b] = palette[parseInt(index, 36) - 1]!;
				for (let dy = 0; dy < SCALE_Y; dy++) {
					let offset = ((top + y * SCALE_Y + dy) * width + left + x * SCALE_X) * 4;
					for (let dx = 0; dx < SCALE_X; dx++, offset += 4) {
						rgba[offset] = r;
						rgba[offset + 1] = g;
						rgba[offset + 2] = b;
						rgba[offset + 3] = 255;
					}
				}
			}
		}
	}
}

await Bun.write(new URL("./preview.png", import.meta.url), encodePng(width, height, rgba));
console.log(`mascots/puddle/preview.png ${width}x${height}`);
