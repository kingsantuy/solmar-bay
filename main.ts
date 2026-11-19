// Solmar Bay — the entry program for make.fun gta6-01 ("Make GTA 6").
// It hands the game in: copies game/ and screenshots/ beside it into the
// output directory and writes dossier.json there with buildDossier from
// the kit's vendored library. Node 22, standard library only; no build,
// no install, no network.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(gameDir)) throw new Error('game/ is missing from the repository');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing from the repository');

  mkdirSync(outDir, { recursive: true });
  // Start clean so a stale file from an earlier run cannot leak in.
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    rmSync(join(outDir, name), { recursive: true, force: true });
  }
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Solmar Bay handed in: ${outDir} (${dossier.length} bytes of dossier)`);
}

main();
