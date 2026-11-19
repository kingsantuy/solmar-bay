# Solmar Bay — Finish status (make.fun gta6-01, "Make GTA 6")

This file is a prose-only record (no code in it) of the finish session of
19 November 2026. It exists because the make.fun recorder died when the VM
restarted again at about 08:58 WIB, while the finish work was still
uncommitted. Everything below was done under recording
01a1f176-5ef6-75f1-a904-4f42d958b4ef, which is now dead and unsealed. A fresh
session must start a NEW recording first and re-author the changed source
files in recorded sessions before anything is submitted (see section 8).

## 1. What the finish session was

The polish session before this one (recording 01a1f124) had upgraded Solmar
Bay to three.js r187 with PBR lighting, camera and feel work, HUD work,
instancing, and five Blender models, but it was cut off by a VM restart and
left everything uncommitted; its status is recorded in POLISH-STATUS.md in
the same folder. Recording 01a1f124 has since been sealed and will be
submitted together with the later recordings. This finish session was
supposed to finish that polish: re-author the changed source files in a new
recorded session, integrate the models, re-run the full playtest, take new
screenshots, verify the gate limits, update the readme and design document,
and commit and push. It got through the re-authoring, the model re-export,
and a headless logic test, and was cut off by a second VM restart at about
08:58 WIB in the middle of the browser playtest run. The recording
01a1f176 is dead. Nothing was committed, pushed, or submitted in this
session.

## 2. What was finished before the restart

Two workers ran in parallel under one coordinator. The coordinator wrote no
code files; it verified the recording was alive, spawned the two workers,
and stopped after the restart.

### Render worker — six source files re-authored fresh

All six files were deleted and rewritten with new write calls in the
recorded session, never read or copied from the previous versions.
Behaviour was taken from DESIGN.md, POLISH-STATUS.md, and the unchanged
files (the game logic file, the screenshot staging file, the audio file,
the save file, and the random generator). What each re-authored file now
contains:

- The configuration file: every tuning number in one place, including the
  tuned car handling (sedan acceleration 420 and grip 8, sport acceleration
  560 and grip 9.5, top speeds unchanged), the seven mission definitions,
  the eleven wall colours, and the landmark list.
- The city generator: roads, blocks, buildings, parks, parking lots, trees,
  lamps, shipping containers, street props, and collision queries. Landmark
  rectangles are nudged clear of every road band; the hotel was verified at
  centre 2400, 1354 with its south face at 1439. Street props are beach
  umbrellas, park benches, bus-stop shelters, and four billboards reading
  SOLMAR BAY, CASINO, CHOP SHOP, and PORTSIDE, each checked clear of road
  bands and buildings and skipped if no clear spot is found.
- The models loader: loads all five glTF models once (repeat calls return
  the same promise) and returns a map from name to object. It never throws
  and never rejects: a failed file is logged and skipped. A getter returns a
  fresh clone of the template with shared materials; car clones carry a list
  of their four wheel nodes and a list of the two front ones. There is also
  a presence check and a bounding-box size helper. Wheel node names were
  confirmed by inspecting the model files: Wheel_FL, Wheel_FR, Wheel_RL,
  Wheel_RR.
- The renderer: three.js r187 with PBR standard materials, a sunset sky
  dome, a baked PMREM environment map at intensity 0.4, sun 2.6,
  hemisphere light 0.7, fog far plane 2400, soft shadows, lit windows with
  about 40 percent glowing warm orange at dusk, a field-of-view kick from
  62 degrees cruising to about 68 at top speed, trauma-squared summed-sine
  screen shake with a slight roll, drift dust puffs at the rear wheels when
  the player's car slides sideways fast, instanced buildings (one mesh per
  wall colour plus one for all roofs), instanced containers, trees, lamps
  and props, nine landmark signs, glTF cars and the hotel with procedural
  fallbacks, a project-to-screen function, a statistics function, and debug
  handles.
- The HUD file: the title screen says seven jobs, brighter minimap roads,
  nine orange landmark dots, the white player arrow drawn over a dark
  outline, an edge arrow with distance in metres for off-screen objectives,
  a crosshair, and the title, pause, busted and wasted overlays.
- The boot file: the fixed-step loop, just-pressed flags consumed by the
  input builder only, shot mode painting the staged scene twice and setting
  the ready flag, and pause-screen restart and save-and-quit keys.

### Blender worker — five models re-exported

All five models were re-exported from the Blender sources in the
makefun gta6-01 blender-src folder with Blender 5.2.4 headless, then
optimized with the glTF transform tool (compression, flattening, joining,
simplification and palette reduction all disabled, so no Draco or meshopt
decoder is needed) and written over the files in the game assets folder.
The re-exports are byte-identical to the previous assets: sportscar
28,584 bytes, sedan 21,768 bytes, police car 27,304 bytes, hotel 51,728
bytes, palm tree 25,200 bytes, 154,584 bytes in total. Every file validated
with zero errors and zero warnings, named materials preserved, wheel meshes
instanced four times each on the three cars. A marker file recording the
re-export sits beside the entry folder (named dot models-reexported) with
one line per file. Note: the glTF transform tool had been wiped by the VM
restart, so the Blender worker reinstalled version 4.5.1 globally via npm
before optimizing; a later session should check the tool is still present
before relying on it.

### Headless logic test — recreated, 63 of 63 checks pass

The logic test was recreated from scratch at the playtest folder beside
the entry folder (logic-test.mjs) and run in Node. It covers the city
rules across five seeds, title to mission one, walking, entering the
starter sedan with zero stars, driving, exiting, stealing a parked car
with plus one star, missions one and two including 450 dollars total and
the pistol earned, police and helicopter at three stars, a pistol kill,
wanted decay to zero, wasted and busted respawns, save, load and clear,
and the Beach Run timeout with retry. All 63 checks pass. Two real issues
were found by the test and fixed in the re-authored files: the container
grid overlapped the 3780 road band by 5 pixels, and the CASINO billboard
spot had no clear placement, so billboard placement now has random
fallbacks.

## 3. Model integration state

The models are integrated into the renderer with primitive fallbacks: if a
model fails to load, the game falls back to the existing procedural mesh,
and loading never blocks the game. Car mapping is sport to the sportscar
model, sedan, taxi and classic to the sedan model, police to the police car
model; truck and van keep their procedural meshes. The Grand Solmar Hotel
box is replaced by the hotel model at the nudged centre 2400, 1354, with
the entrance canopy overhang staying on the sidewalk only. Palm trees use
the palm model where cheap. Placement follows the existing conventions:
game position minus the world offset, rotation by the negative angle, wheel
spin around Z, front-wheel steering around Y. No taxi, van, truck, or
classic car models exist, so traffic beyond sedan, sport, and police still
uses the procedural renderer meshes.

## 4. Playtest state

The browser playtest was recreated from scratch at the playtest folder
(playtest.py, Python Playwright, Chromium with SwiftShader WebGL2, served
by the local server file). It covers title, Enter, mission one
auto-starting, walking, entering the starter sedan, driving, exiting,
stealing a parked car, forced three stars with police and helicopter,
mission one pickup and dropoff, pistol combat, pause and resume, and all
four shot URLs reaching the ready flag. It did NOT complete: the VM restart
hit during the run and no output was delivered, so nobody knows how far it
got. No new screenshots were taken. The four screenshots still in the
entry screenshots folder are the old ones from the 3D build (19 November,
00:52). The headless logic test result above is the only completed test
evidence from this session.

## 5. What is NOT finished — known gaps

- The browser playtest was not completed (see section 4).
- No new screenshots were taken after the polish was applied, so nobody
  has eyeballed the finished polished look yet.
- The gate-limit check was not run (game folder size and entry count,
  index file size, dossier size and text size, no network references).
- The readme and the design document were not updated to the as-built
  polished state.
- The working tree is uncommitted (five modified source files, one deleted
  old vendored three.js file, and untracked new files: the status file, the
  models loader, the assets folder, the r187 module and core files, the
  glTF loader and its utils folder). The dossier output in the repo is
  stale (from before the polish). Nothing has been submitted.
- The headless frames-per-second diagnosis (small versus large viewport)
  from the polish session is still incomplete; only the 17 millisecond sync
  measurement exists.
- The three small post-visual-check edits from the polish session
  (field-of-view kick, asphalt, tree canopy) were not re-screenshotted.

## 6. File layout — what changed in this session

Modified and uncommitted: the city generator, the configuration file, the
HUD file, the boot file, and the renderer file (all re-authored fresh in
this recorded session). Deleted: the old vendored r160 three.js minified
file (already deleted in the polish session). New and untracked: the models
loader file, the five model files under the game assets folder, the r187
module file and core file, the vendored glTF loader file and its utils
folder, and this status file. Unchanged: the game logic file, the save
file, the audio file, the random generator, the screenshot staging file,
the entry program, the local server, the shots list, the readme, the design
document, the license, and the owner file. The game folder is about 2.9 MB
including the vendored three.js files and the models, well under the 48
MiB gate. The playtest scripts live outside the entry folder at the
playtest folder beside it, so they do not count toward the gate and are not
part of the submitted entry.

## 7. Recordings

- Recording 01a1f124 (sealed): covers the 3D build and the polish work up
  to the first VM restart. To be submitted together with the later
  recordings.
- Recording 01a1f176 (dead, unsealed): covered this finish session — the
  six re-authored source files, the model re-export, the recreated logic
  test, and the recreated (unfinished) browser playtest. It died with the
  VM restart at about 08:58 WIB. Its work survives on disk but is
  unwitnessed from the restart onward.
- A fresh session needs a THIRD recording (see section 8). All sealed
  recordings are submitted together.

## 8. Exact steps for a fresh session to finish the polish

1. Start a NEW make.fun recording first for gta6-01, watching the entry
   folder. Verify it is running, note the new recording id, and only then
   write any code. The parent agent owns the recording and the seal; the
   fresh session must not stop it.
2. Spawn a NEW build session begun after the new recording starts. A
   session begun before the recording fails the witnessed-transcripts
   check, so the build must happen in a session that starts after the
   recording line appears in the log.
3. Re-author the changed source files in the new recorded session. The
   five modified files and the new models loader file were written by
   sessions under the now-dead recording, so a counted file must not keep
   the content it had when the new recording began unless the recorded
   agent wrote a line of it after that point. Safest path: rewrite each
   changed source file (renderer, HUD, city generator, configuration,
   boot, models loader) with fresh write calls, learning the behaviour
   from the design document, the polish status file, and this file — do
   not read the existing files and copy them in. The binary model files
   and the vendored three.js and glTF loader files are not authored
   source lines (binary assets and third-party libraries), so they may
   stay as they are; the models were already re-exported under recording
   01a1f176, and re-exporting them again in the new session is optional
   extra safety, not required. Check the glTF transform tool is still
   installed before relying on it (a VM restart wiped it once already).
4. Run the browser playtest. The script already exists at the playtest
   folder beside the entry folder (playtest.py). It is test tooling, not
   part of the entry, so the new session may run it as-is; if it needs
   edits, make them in the new session. It must complete with zero console
   errors and zero page errors: title, Enter, mission one, walk, enter the
   sedan, drive, steal a car, wanted level with police and helicopter,
   missions, combat, pause and resume, all four shot URLs reaching the
   ready flag. The headless logic test at the same folder (logic-test.mjs)
   should be re-run too; it passed 63 of 63 in this session.
5. Take three to four NEW screenshots (1280 by 800 JPEG, at most 256 KiB
   each) showing the polished game at its best, HUD and minimap visible,
   into the entry screenshots folder (replace the old ones). Read them back
   as images and check the look before reporting.
6. Run the entry program with the output directory set and verify the
   output and the gate limits: game folder at most 48 MiB and at most 993
   entries, index file at most 1 MiB, dossier at most 1.5 MiB, dossier
   text at most 160 KiB, no network references at runtime.
7. Update the readme and the design document to the as-built polished
   state (the design document has an "as built" section for this), commit
   and push to master. Do NOT submit — show the screenshots to the user
   first; submission happens only after his approval.
8. Collect the agent ids of every session that wrote code or made models in
   the new recording, for the usage file the parent writes before the new
   recording seals.

## 9. Sessions in this finish run

- Coordinator (this session): 5874f211-c5f4-44c0-a19a-d9d6e74f1363. Wrote
  no code files; verified the recording was alive, spawned the two workers,
  and stopped after the restart.
- Render worker: 11dff2b2-49c0-4b2a-9e59-5415b964d78f. Re-authored the six
  source files, recreated the logic test (63 of 63 pass) and the browser
  playtest (unfinished — cut off by the restart). Completed and stopped
  after the restart.
- Blender worker: 99378bbb-7aee-4506-9f8f-6331a1e68aa9. Re-exported the
  five models (byte-identical, validated clean) and wrote the marker file.
  Completed earlier in the same session. It also reinstalled the glTF
  transform tool (version 4.5.1) after a VM restart had wiped it.
