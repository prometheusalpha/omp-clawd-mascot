// Plays Clawd's playlists live in this terminal, in colour, at Claude's 60 ms.
// Painting goes through the omp agent's `paintRow`, so what plays here is
// byte-for-byte what the omp widget draws; only this dev script may reach into
// an agent like that.
//
//   bun mascots/clawd/play.ts               every playlist in turn, looping
//   bun mascots/clawd/play.ts turn          one playlist, looping
//   bun mascots/clawd/play.ts turn --once   play through once, then exit
//   bun mascots/clawd/play.ts --simple      the eyes-only Apple Terminal body
import { paintRow, type ThemeLike } from "../../agents/omp/ansi";
import { AUTOPLAY, FRAME_MS, SEQUENCES, type FrameSpec } from "./data";
import { paint } from "./index";
import { buildClawdFrame } from "./pose";

const PLAYLISTS: Record<string, readonly FrameSpec[]> = { idle: AUTOPLAY, working: SEQUENCES.tap, ...SEQUENCES };

const args = process.argv.slice(2);
const once = args.includes("--once");
const simple = args.includes("--simple");
const name = args.find(arg => !arg.startsWith("--"));
if (name !== undefined && !(name in PLAYLISTS)) {
	console.error(`unknown playlist ${JSON.stringify(name)}; one of: ${Object.keys(PLAYLISTS).join(", ")}`);
	process.exit(1);
}
// `working` is `tap` under its state name, so the tour skips the duplicate.
const names = name === undefined ? Object.keys(PLAYLISTS).filter(key => key !== "tap") : [name];

const truecolor = Bun.env.COLORTERM === "truecolor" || Bun.env.COLORTERM === "24bit";
/** omp's theme dims through its own palette; plain SGR dim is the terminal's equivalent. */
const theme: ThemeLike = { fg: (_color, text) => `\x1b[2m${text}\x1b[22m` };

const LINES = 4;
const restore = () => process.stdout.write("\x1b[?25h");
process.on("SIGINT", () => {
	restore();
	process.stdout.write("\n");
	process.exit(0);
});

process.stdout.write("\x1b[?25l" + "\n".repeat(LINES));
do {
	for (const current of names) {
		const specs = PLAYLISTS[current]!;
		for (const [step, spec] of specs.entries()) {
			const rows = paint(buildClawdFrame(spec, simple)).map(row => paintRow(row, theme, truecolor));
			const label = `\x1b[2m${current} ${step + 1}/${specs.length}\x1b[22m`;
			process.stdout.write(`\x1b[${LINES}A` + [label, ...rows].map(line => `\r\x1b[2K${line}\n`).join(""));
			await Bun.sleep(FRAME_MS);
		}
	}
} while (!once);
restore();
