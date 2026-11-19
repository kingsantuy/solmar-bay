# Solmar Bay — Polish status (make.fun gta6-01, "Make GTA 6")

This file is a prose-only record (no code in it) of the polish session of
19 November 2026. It exists because the make.fun recorder died when the VM
restarted at about 08:36 WIB, while the polish work was still uncommitted.
Everything below was done under recording
01a1f124-30e3-74c0-a1e9-91a39b07469f, which is now dead and unsealed. A fresh
session must start a NEW recording first and re-author the changed source
files in recorded sessions before anything is submitted (see section 11).

## 1. What the polish session was

The 3D version of Solmar Bay (commit 85b3f35) was a working three.js game,
but the user judged it not good enough against the leaderboard leaders
(HALCYON KEYS 3D, COSTA SOLIS): the look was low-poly and blocky and the
feel was plain. New game-dev skills and Blender had just been installed for
this polish. The polish had two parallel workers under one coordinator: a
render worker (lighting, camera, feel, HUD, performance, three.js upgrade)
and a Blender worker (real 3D models). Neither worker committed, pushed, or
submitted anything. The coordinator integrated nothing yet — integration,
final playtest, screenshots, and the commit are all still to do.

Skills read before use (all in the home custom-skills folder): the router,
threejs-scene-setup, threejs-materials-lighting, threejs-gltf-loading,
game-feel, game-ui-ux, camera-systems, level-design,
performance-optimization, audio-design skills for the render work; and
blender-core, blender-hardsurface-modeling, blender-pbr-materials,
blender-texturing, blender-export-pipelines, blender-game-optimization,
blender-environment-kits, blender-lighting-lookdev for the models. Tools:
Blender 5.2.4 LTS at the home blender-5.2 folder (headless, no GPU) and
gltf-transform 4.5.1 on the command line.

## 2. three.js r160 to r187 — done and verified working

The old vendored three.js r160 single minified file was deleted. The official
npm three version 0.187.0 build was vendored instead, as two files: a small
module file (658,900 bytes) that re-exports from a larger core file
(1,474,799 bytes). Version r187 ships no single-file minified build, so both
files are needed; the core file is self-contained and no import-map change
was required. The renderer source file now imports the new module file.
One API rename was needed: the soft-shadow setting changed name because
r182 made PCF shadows soft already (the old name now only logs a warning).
No other r160 to r187 breakage hit the code — this was verified by running
the game, not just by reading migration notes. The game folder grew from
about 796 KB to about 2.9 MB, still far under the 48 MiB gate limit.

## 3. Lighting, materials and atmosphere — done

Every Lambert material became a standard PBR material with roughness and
metalness values: car paint is fairly smooth and somewhat metallic, glass
cabins are very smooth and more metallic, the sea has a sheen, asphalt and
trees are rough. A sunset sky dome was added (a vertical gradient texture on
a backside sphere with fog disabled), replacing the previous flat fog-colour
sky. Cheap image-based lighting was added by baking a PMREM environment map
from a tiny primitive gradient scene, with the scene environment intensity
set to 0.4 — no HDR file and no addon. The sun was brightened from 2.2 to
2.6, the hemisphere sky light dimmed from 0.9 to 0.7, and the fog far plane
moved from 2100 to 2400. Buildings got a lit-windows emissive map so about
40 percent of windows glow warm orange at dusk (deterministic per building);
lamp heads and the lighthouse lamp are more emissive. Sparks and muzzle
flashes are now unlit so they glow at dusk; smoke stays lit. After a visual
check, the asphalt was lightened and the tree canopy was lightened. The
sunset look is kept but richer.

## 4. Camera and feel — done

The field of view now kicks with speed: 62 degrees cruising, up to about 68
at top speed in a car (the kick was cut from plus 10 to plus 6 after a visual
check, so the staged cover shot keeps the car large in frame). The screen
shake was rewritten following the game-feel skill: trauma squared times
summed sines, plus a slight roll, riding on top of the exponential smooth
follow (the old code used per-frame random numbers, which buzzed). The trauma
value still comes from the logic layer (the camera shake value in the game
state, untouched). Renderer-local drift dust was added: dust puffs appear at
the rear wheels when the player's car slides sideways fast (velocity versus
heading) — visual only, no logic-layer edit. Driving feel was tuned in the
configuration file only: acceleration up about 10 percent (sedan 380 to 420,
sport 520 to 560) and grip up slightly (sedan 7.5 to 8, sport 9 to 9.5); top
speeds are unchanged so the timed Beach Run mission stays fair.

## 5. HUD and level dressing — done

A factual error was fixed: the title screen said "Work five jobs" and now
says "seven jobs". The minimap has brighter roads, orange dots for all nine
landmarks, and the white player arrow is now drawn over a dark outline so it
reads on any ground. The edge arrow was implemented (it was promised in the
design document but never existed): when the mission or taxi objective is
off-screen, an arrow sits on the screen edge pointing at it with the distance
in metres (one game unit equals 0.05 metres, the same scale as the speed
readout). This needed a project-to-screen function added to the renderer and
wired through the boot file into the HUD creator. District dressing was added
in the city generator: beach umbrellas (about six to ten), park benches (two
per park), eight bus-stop shelters, and four billboards reading SOLMAR BAY,
CASINO, CHOP SHOP, and PORTSIDE — all decorative, no collision, each checked
clear of road bands and buildings (skipped if no clear spot). The renderer
draws them instanced (umbrellas use per-instance colours); billboards are
individual meshes with canvas-texture faces. Landmark signs were extended
from two to nine: MARINA CASINO, CHOP SHOP, SOLMAR GENERAL, HIDEOUT,
PORTSIDE DOCKS, MARINA PIER, and LIGHTHOUSE were added (the lighthouse sign
sits above the tower at its nudged position).

## 6. Performance — done, with one unfinished measurement

Buildings are now one instanced mesh per wall colour (eleven colours, seed
one) plus one instanced mesh for all roofs, replacing about 222 individual
meshes. Shipping containers are instanced per colour too. Measured headless
through a new statistics function: 216 draw calls while driving and 261 in
the cover shot, about 43 to 44 thousand triangles, versus about 430 calls
estimated before instancing. The renderer sync step itself averages about 17
milliseconds with shadows on. Headless SwiftShader still runs at about one
frame per second — but the 17 millisecond sync time shows that is the
software rasterizer and present path, not game code. The small-versus-large
viewport comparison to confirm this was cut off by the VM restart and is
unfinished. Debug handles for the renderer and scene were also added to the
renderer export (used for profiling).

## 7. Blender models and the loader — done, not yet integrated

Five models were built in Blender with Python scripts (the entrant's own
work, no downloads), exported as binary glTF, optimized, and load-tested in
the browser:

- Sportscar: 28,584 bytes, 916 triangles. Red wedge body (extruded profile
  with bevel), glass canopy, spoiler, emissive head and tail lights, four
  separate wheel nodes.
- Sedan: 21,768 bytes, 796 triangles. Three-box blue sedan, same
  construction as the sportscar.
- Police car: 27,304 bytes, 844 triangles. Navy sedan with a white roof and
  a red and blue emissive light bar.
- Grand Solmar Hotel: 51,728 bytes, 924 triangles. Footprint 240 by 170,
  height 149 (the city generator gives it twelve floors at height 146 plus a
  gold cap), ribbon windows, gold trim, crown, rooftop pool, entrance canopy
  facing south.
- Palm tree: 25,200 bytes, 408 triangles. Leaning trunk, seven tapered
  folded-arch fronds, three coconuts.

Total for the assets folder is 154,584 bytes. All five validated clean with
the glTF validator (exit zero, no errors found) and the inspector (no
required extensions, named materials preserved). The optimizer ran with
compression, flattening, joining, simplification, and palette reduction all
disabled — so no Draco or meshopt decoder is needed — and it instanced the
shared wheel meshes. The Blender source files live outside the repo in the
makefun gta6-01 blender-src folder, so they do not count toward the 48 MiB
game gate.

The loader is a new file, game source models.js. Its main function loads
all five models once (repeat calls return the same promise) and returns a
map from name to a three.js object. It never throws and never rejects: a
failed file is logged and skipped. A getter returns a fresh clone of the
template (materials shared); for cars the clone carries a list of its four
wheel nodes and a list of the two front ones. There are also a presence check
and a bounding-box size helper, plus exported lists of model names and
files. Conventions for whoever integrates it: one unit equals one game unit;
every model faces positive X with its origin at ground centre, so placing it
at the game position minus the world offset and rotating it by the negative
angle works as-is. Wheel nodes have their origin at the axle centre with the
axle along local Z, so the existing renderer convention works: spin the
wheel around Z, steer the front wheels around Y. All meshes cast shadows.

The glTF loader itself was vendored: the loader file (r187), plus the buffer
geometry utilities and skeleton utilities files it needs, all downloaded
from three version 0.187.0, with their bare three imports patched to the
vendored build and their relative utility imports patched to the local utils
folder. No other imports.

Two mid-task adaptations are recorded here because they matter for the next
session. First, while the Blender worker was working, the render worker
upgraded three.js from r160 to r187; the first harness run caught a missing
file error, so the loader was re-vendored for r187 (which additionally needs
the skeleton utilities) and the models file was updated to import the new
module file. The game title screen still loads with zero console or page
errors on the r187 build. Second, two visual fixes came from reading the
test screenshots: the sedan paint was deepened (it first rendered teal under
the warm sun) and the hotel gold metallic value was lowered to 0.35 after
metals went black with no environment map; the palm fronds were rebuilt as
tapered folded arches after the first pass rendered as flat planks.

Caveats from the Blender worker: the hotel entrance canopy overhangs about
17 units past the hotel's south face. The worker computed the nudged hotel
position (centre at 2400, 1354; south face at y 1439; the road band starts at
1440), so the overhang sits over the sidewalk only and the columns stand on
the sidewalk — it looks like a porte-cochere, not a bug. Confirm this on
placement. No taxi, van, truck, or classic car models were built — only the
five listed above, so traffic beyond sedan, sport, and police still uses the
procedural renderer meshes.

## 8. File layout — what changed in this session

Modified, uncommitted: the city generator (56 lines added: street props),
the configuration file (car handling tuning), the HUD file (about 102 lines:
edge arrow, minimap landmarks, title fix), the boot file (one line: wiring
the project-to-screen function into the HUD), the renderer file (about 419
lines added and 92 removed: r187 import, PBR materials, sky dome,
environment map, lighting, camera shake and field-of-view kick, dust,
instancing, props rendering, landmark signs, statistics function, debug
handles). Deleted: the old vendored r160 three.js minified file. New and
untracked: the r187 module file (658,900 bytes) and core file (1,474,799
bytes), the vendored glTF loader file (119,871 bytes) and its utils folder
(buffer geometry utilities plus skeleton utilities), the new models loader
file (4,784 bytes), and the five model files under the game assets folder
(154,584 bytes total). Unchanged: the game logic file, the save file, the
audio file, the random generator, the screenshot staging file, the entry
program, the local server, the shots list, the readme, the design document,
the license, and the owner file. The game folder totals about 2.6 MB, well
under the 48 MiB gate. The dossier output in the repo is stale (from before
the polish) — a fresh session must re-run the entry program.

## 9. What was verified before the restart

Render worker, baseline on r160 before any change — full scripted playtest:
title to Enter, mission one auto-starts, walk, press E to enter the starter
sedan (zero stars), drive to speed 230, exit, steal a car (plus one star,
after fixing the test script's own bug: it had re-entered the player's own
sedan, which correctly costs no star), forced three stars, police spawned
with the helicopter active, mission one pickup and dropoff (150 dollars,
mission two starts), pistol combat fires (shots fired count one), Escape
pauses and Enter resumes, all four shot URLs set the ready flag. Zero
console errors, zero page errors. That playtest script lived in the temporary
folder and was wiped by the restart.

Render worker, after the r187 swap: smoke test (title, play, cover shot
ready), zero errors. After the lighting and camera changes: smoke test
again, zero errors; frames were visually checked (dusk-purple sky gradient,
glowing windows, red sportscar with police and helicopter reading clearly in
the cover shot). Three tweaks followed from that look (field-of-view kick cut
from plus 10 to plus 6, asphalt lightened, tree canopy lightened) and were
not re-screenshotted. After instancing, props, and HUD changes: the profile
run loaded the title, drove, and rendered the cover shot to ready with zero
console or page errors, which exercises the new code paths — but the full
scripted playtest was not re-run on the final code. Headless city check in
Node: the city generator runs clean for seeds one to three with the new
props (seed one: 111 buildings, 9 containers, 374 trees, 73 lamps, 6
umbrellas, 16 benches, 8 bus stops, 4 billboards).

Blender worker: all five models rendered in headless Chromium and read back
as images (sportscar, sedan, police, hotel, palm, plus all five in a row at
correct relative scale). The loader API probe passed (sportscar returns four
wheels plus two fronts, spin and steer rotations apply, two clones have
independent wheel nodes, asking for an unknown model returns null, repeated
loads return the same map, zero console or page errors).

## 10. What is NOT finished — known gaps

- The models are not integrated: the renderer does not import the models
  loader yet, so the game still shows the old procedural box cars and
  buildings.
- The full scripted playtest was not re-run on the final polished code
  (missions, stealing, wanted level with helicopter, combat, all four shot
  URLs, edge-arrow behaviour). The playtest script must be recreated — the
  temporary folder was wiped by the restart.
- Nobody has eyeballed the finished polished look yet: no new screenshots
  were taken after all polish was applied.
- The headless frames-per-second diagnosis (small versus large viewport) is
  incomplete; only the 17 millisecond sync measurement exists.
- The three small post-visual-check edits (field-of-view kick, asphalt,
  tree canopy) were not re-screenshotted.
- The working tree is uncommitted. The dossier output is stale. Nothing has
  been submitted.

## 11. Exact steps for a fresh session to finish the polish

1. Start a NEW make.fun recording first (the old one, id
   01a1f124-30e3-74c0-a1e9-91a39b07469f, is dead — the VM restart at about
   08:36 WIB killed the recorder; do not trust it). Verify it is running,
   note the new recording id, and only then write any code. The parent
   agent owns the recording and the seal; the fresh session must not stop
   it.
2. Spawn a NEW build session begun after the new recording starts. A
   session begun before the recording fails the witnessed-transcripts
   check, so the build must happen in a session that starts after the
   recording line appears in the log.
3. Re-author the changed source files in the new recorded session. The
   files listed in section 8 as modified or new were written by sessions
   under the dead recording, so a counted file must not keep the content it
   had when the new recording began unless the recorded agent wrote a line
   of it after that point. Safest path: rewrite each changed source file
   (renderer, HUD, city generator, configuration, boot, models loader) with
   fresh write calls, learning the behaviour from the design document and
   this status file — do not read the existing files and copy them in.
   The binary model files and the vendored three.js and glTF loader files
   are not authored source lines (binary assets and third-party libraries),
   so they may stay; to be extra safe, re-export the five models from the
   Blender sources in the new session (Blender re-export is quick) so the
   assets also have a recorded provenance.
4. Integrate the models into the renderer: import the loader from the
   models file, load the models at boot (asynchronous, never block the game
   on a load failure), replace the procedural box cars with the glTF meshes
   (sport model uses the sportscar, sedan, taxi and classic use the sedan,
   police uses the police car; truck and van keep their procedural meshes),
   replace the Grand Solmar Hotel box building with the hotel model placed
   at the nudged centre (2400, 1354) and confirm the canopy overhang stays
   on the sidewalk, and replace the instanced palm trees with the palm
   model where cheap (or keep the primitive palms if instancing the model
   proves costly — decide by profiling). Keep primitive fallbacks: if a
   model fails to load, fall back to the existing procedural mesh. Keep the
   existing placement conventions (game position minus the world offset,
   rotation by the negative angle, wheel spin around Z, steer around Y).
5. Recreate the full playtest script (the temporary folder was wiped) and
   run it in Playwright Chromium: title, Enter, mission one, walk, enter
   the sedan, drive, steal a car, wanted level with police and helicopter,
   missions, combat, pause and resume, all four shot URLs reaching the
   ready flag. Zero console errors and zero page errors required. Re-run
   the headless logic test too if it can be recreated.
6. Take three to four NEW screenshots (1280 by 800 JPEG, at most 256 KiB
   each) showing the polished game at its best, HUD and minimap visible,
   into the entry screenshots folder (replace the old ones). Read them back
   as images and check the look before reporting.
7. Run the entry program with the output directory set and verify the
   output and the gate limits: game folder at most 48 MiB and at most 993
   entries, index file at most 1 MiB, dossier at most 1.5 MiB, dossier text
   at most 160 KiB, no network references at runtime.
8. Update the readme and the design document to the as-built polished
   state (the design document has an "as built" section for this), commit
   and push to master. Do NOT submit — show the screenshots to the user
   first; submission happens only after his approval.
9. Collect the agent ids of every session that wrote code or made models in
   the new recording, for the usage file the parent writes before the new
   recording seals.

## 12. Sessions in this polish run

- Coordinator (this session): a7002921-df67-4e0f-938e-d38cf4cb5902. Wrote
  no code files; verified the recording was alive, spawned the two workers,
  verified the Blender worker's output on disk, and sent the stop message
  to the render worker.
- Render worker: adb38348-3191-4da3-8266-165ddd554cea. Wrote the three.js
  upgrade, lighting, materials, camera, feel, HUD, and performance changes
  listed in sections 2 to 6. Completed and stopped after the restart.
- Blender worker: 3863481a-e9fe-4c07-9390-894a540a1e35. Built the five
  models, the loader file, and the vendored glTF loader files listed in
  section 7. Completed earlier in the same session.
