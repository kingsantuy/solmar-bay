# Solmar Bay — Game Design (make.fun gta6-01, "Make GTA 6")

The design this entry was built from, and the record of how it was built.
Everything in the game is original — city, characters, vehicles, names, story,
art, sound and music. No Rockstar name, logo, character, map or asset appears
anywhere. No third-party library is vendored: the renderer is raw WebGL2
written for this entry, and the only 3D assets are ten original Blender
models made for it.

## 1. Concept

Solmar Bay is a 3D open-world crime game rendered with raw WebGL2, played
offline in a desktop browser from static files, with keyboard and mouse. A
third-person chase camera follows the player behind the car and over the
shoulder on foot. The player is Rook (Marco "Rook" Reyes), a driver-for-hire
new to a sun-soaked coastal city, who works eight story jobs for the local
crew while the police, traffic and crowds go about their day. The judge
weighs completeness above all: a city explored on foot and by car, traffic
and pedestrians, cars to steal, a wanted level with police who respond,
missions and a story, combat, a HUD with a minimap, a start screen and a
save, plus polish (sound, effects, menus). The top 10 finalists are actually
played in desktop Chrome, so playability is not optional — the simulation
runs on a 2D plane (x east, y south, 4800 by 3600) and the raw WebGL
renderer maps it to 3D space (x - 2400, height, y - 1800), so the tested
game logic and the 3D presentation stay in sync.

## 2. The city

The world is 4800 by 3600. A road grid crosses it: vertical roads at
x 420, 980, 1540, 2100, 2660, 3220, 3780 and 4340, horizontal roads at y 420,
980, 1540, 2100, 2660 and 3220. Roads are 116 wide with a 26-pixel sidewalk
on each side and a dashed yellow centre line. The west edge is coast:
deep sea west of x 110, sand from x 110 to 300, then the city. Districts,
named on the HUD when the player enters them: Solmar Beach (the west strip),
Marina (south, below y 3050), Portside (south-east, x above 3400 and y above
3050), The Hills (north-east, x above 4000 and y below 900), Old Town (east,
x above 3400), Downtown (the centre, x 1800–3400 and y 1200–2400), and
Solmar Bay for everything else.

Blocks between roads hold buildings, parks or parking lots: roughly one block
in eight is a park (green with trees), about one in thirteen a parking lot
(paved with marked bays), the rest one to four buildings each. Downtown
buildings are taller (up to nine floors, twelve for the hotel) and denser;
elsewhere one to four floors. In 3D each building is a box with a procedural
canvas window texture, tinted from a warm palette (terracotta, mauve, teal,
ochre, plum, brick, olive). Ten original Blender models are used where they
exist (two apartment blocks, the Grand Solmar Hotel, two palm variants, the
police helicopter, sedan, sportscar, police car and taxi van); other
buildings use the procedural box with the window texture. Palm trees line
the beach roads; lamps line the streets. The marina has a wooden pier at
the south edge; the port has stacked shipping containers in four colours; a
striped red-and-white lighthouse stands on the north coast. Golden-hour
lighting: a warm low sun, hemisphere sky light, warm distance fog, a sky
dome gradient with a sun disc and glow, and emissive lit windows at dusk.

Fixed landmarks the story points at: Grand Solmar Hotel at (2400, 1500);
Marina Casino at (2100, 3050); Chop Shop at (3900, 1500); Solmar General
hospital at (2660, 980); Police HQ at (2100, 2100); the Hideout at (4350,
300); the Lighthouse at (600, 350); Marina Pier at (2350, 3350); Portside
Docks at (3900, 3350). The player starts on foot near the marina at (2350,
3180), with a parked sedan waiting nearby at (2440, 3240) so driving starts
in the first minute.

One rule the generator enforces: no building or container ever blocks a road.
The design coordinates of several landmarks fall on a road or an intersection,
so each landmark rect is nudged clear of every road band (road plus sidewalk
plus a margin) before it is planted; the mission targets keep the design
coordinates, which sit on open road beside the nudged building, and step
completion measures distance to the building's edge when the target is inside
one. The port containers sit in the block east of the coast road and south of
the marina road, never on a road.

## 3. Systems

### On foot
Walk speed 175, run 265 with Shift. WASD or arrows move; the player faces
the walk direction, or the mouse aim point while armed. E enters a nearby
car (within 70). F punches (12 damage, 0.38 s between punches, 34 reach).
Keys 1–5 switch weapons once owned; Q opens the weapon wheel. The player
is a red-shirted low-poly figure in a crowd, with a held gun mesh shown
when a gun is equipped (scaled per weapon: pistol 1, SMG 1.3, shotgun 1.55,
rifle 1.85).

### Driving
Arcade car physics on a velocity vector: forward acceleration and braking, a
steering rate that grows with speed, lateral grip, and a handbrake (Space)
that drops grip so the car drifts. Each model has its own top speed,
acceleration and grip: Sedan 430, Taxi 410, Sport 560, Truck 330, Van 380,
Police 500, Classic 400. Cars take damage from wall and car impacts. The
chase camera follows behind the car (120 units back, 35 up) with a smooth
lag plus a small shake on hard impacts; on foot it sits 75 back, 28 up.
Field of view kicks from 62 degrees cruising to about 68 at top speed.

### Stealing cars
Pressing E near a parked car takes it (a crime: plus one wanted star).
Pressing E near a traffic car pulls its driver out — the driver becomes a
fleeing pedestrian — and the car becomes the player's (also plus one star).
Police cars cannot be stolen. Exiting a car (E again) leaves it parked where
it stands. The starter sedan by the marina is the player's own, so taking it
costs no star.

### Traffic
Sixteen traffic cars (sedans, taxis, vans, classics, a truck) drive the road
grid in the correct lanes for right-hand traffic: on a vertical road the
southbound lane sits 28 left of the road centre and the northbound 28 right;
on a horizontal road eastbound is 28 below centre and westbound 28 above.
Each car follows one road at 120–210, slows for the car ahead in its lane,
and at intersections turns onto the crossing road about a third of the time.
Traffic wraps around the world edges so the streets never empty. Nine parked
cars wait along road edges for stealing, kept clear of the starter sedan and
the Hot Wheels sportscar so no two cars spawn overlapped.

### Pedestrians
Twenty-six civilians stroll the sidewalks between random nearby points. They
flee from gunfire, from speeding cars, and from the scene of a crime. Cops are
dark-uniformed pedestrians who appear once the wanted level reaches two stars;
they run the player down on foot and hold him to bust him. A waiting taxi
client shows a gold dollar sign above their head.

### Wanted level and police
Wanted runs from 0 to 5 stars. Crimes add stars: stealing a car or knocking
out or shooting a pedestrian adds one; shooting a cop adds two. Quiet time
cools the heat: after 20 seconds without a crime and with no police nearby,
one star fades every 14 seconds. The police answer with patrol cars — one
plus half the wanted level, up to five — spawning on a road 650–850 from the
player every 2.5 seconds while the count is short, sirens wailing, steering
toward the player and ramming. Patrols that lose the player drive off once
the heat is gone and despawn beyond 1100. From three stars the police also
shoot at the player (from cars within 520 and from foot cops within 320,
about one shot per 1.1 seconds, deliberately inaccurate), and a police
helicopter joins the chase, circling overhead with a searchlight cone. From
four stars, roadblocks appear (up to two, each four police cars parked
across the road). A foot cop who holds the player for 1.6 seconds busts
him; at zero health the player is wasted. Both wake the player up at the
station (Police HQ) or the hospital (Solmar General) with full health, no
wanted level, and $100 lighter.

### Missions and story
Eight story jobs, in order, each with a briefing, a pay, and steps that point
at a pulsing yellow waypoint ring and beam on the map, the minimap and an edge
arrow with distance:

1. First Fare ($150): pick up a client at the marina pier, then drive them to
   the Grand Solmar Hotel.
2. Hot Wheels ($300): steal the red sportscar parked in the beach lot and
   deliver it to the Chop Shop in Old Town. The pistol is earned here.
3. Beach Run ($400): collect a package at the port, then deliver it to a house
   in the Hills within 100 seconds.
4. The Drop ($550): pick up a drop at the marina and reach the lighthouse on
   the north coast while two patrol cars circle the coast road.
5. Bay Heist ($900): walk into the Marina Casino, grab the cash, then escape
   to the hideout in the Hills — the hideout only counts once the wanted level
   is back to zero.
6. Night Shift ($650): drive the casino boss from the Marina Casino to the
   Lighthouse, then to the Hideout, starting at 2 wanted stars.
7. The Big One ($1500): steal the gold truck at Portside Docks, lose a
   4-star wanted level with the helicopter active, then deliver it to the
   Chop Shop.
8. Golden Hour ($2000): meet the crew at the Marina Casino, survive a
   scripted 5-star manhunt until the wanted level returns to zero, then
   deliver to the Hideout.

Finishing a mission pays out, plays a jingle, saves the game and opens the
next job; failing (only the timed delivery can fail, by running out of time)
leaves the job open to retry. After the eighth job the story is complete and
the city is free roam. Taxi fares are the side job: when no mission is active,
a fare ($25–$70) appears every 30–45 seconds — drive to the waiting client,
take them aboard, drive to their destination for cash. Fare clients and
destinations are both placed on roads so they are always reachable.

### Combat and weapons
Five weapons on the wheel (Q, or keys 1–5): Fists (12 damage, 0.38 s),
Pistol (26 damage, 0.24 s), SMG ($800, 18 damage, 0.09 s), Shotgun ($1500,
40 damage, 0.7 s), Rifle ($3000, 60 damage, 0.9 s, locked until respect
400). Bullets travel 640/s toward the mouse ground point, with a muzzle
flash and a danger pulse that scatters nearby pedestrians. Police bullets do
9 damage. Player health is 100 and regenerates 4 per second after 8 seconds
without committing a crime. Getting hit shakes the screen and flashes red;
below 30 health a red vignette closes in.

### Respect, garage and dispatch
Respect starts at 0, +100 per mission, +15 per taxi fare; level is points
divided by 200, and the rifle unlocks at 400 respect. The garage at the
Chop Shop (G when parked there) sells Repair ($100), Respray ($250),
Engine ($800 per level, up to 2, +40 top speed each) and Armour ($1200 per
level, up to 2, +50 max health each). The dispatch panel lists the nearest
police units first (up to five) with callsigns (GULL-11, CORAL-25, REEF-18,
TAC-45, AIR-1), distance in metres and status (RAMMING, FIRING, SPOTLIGHT,
ROADBLOCK, PATROL). Dialogue shows the crew boss Mara's briefing with a
portrait whenever a mission is active.

### HUD and minimap
A DOM overlay. Top left: money in green, respect rank and bar, a health bar,
an armour bar, five wanted stars (gold filled, grey empty), and the current
district name, plus the dispatch list when wanted. Top right: a 190 by 142
minimap canvas showing sea, sand, roads, the mission target as a yellow
diamond, cars as grey dots, police as red dots, the helicopter as a red H,
and the player as a white arrow; below it a five-slot weapon strip. Bottom
left: the current mission title, stage (for example STAGE 1/2), objective,
next step and IN SIGHT indicator. Bottom right: speed in km/h, car model
and condition (PRISTINE, DENTED, SMOKING, WRECKED) while driving, the radio
station while driving, or the weapon and the "E — enter car" hint on foot.
Centre top: toast messages (crimes, pickups, payouts) that fade after six
seconds. A big district name flashes when entering a new district. An edge
arrow with a distance in metres points at off-screen objectives. A
crosshair follows the mouse while a gun is out. The weapon wheel (Q) shows
all five weapons with prices and lock state; the garage menu (G) shows the
four tunes with prices.

### Screens
Title screen: a sunset gradient over sea and sand, the SOLMAR BAY title, the
story line, the full control list, and "Press Enter to start" (or "Continue"
with jobs done and money carried when a save exists). Pause (Esc or P) offers
resume, restart and save-and-quit; Enter resumes from pause. Busted and
Wasted screens explain what happened and return to play on Enter.

### Save
Local storage under the key solmar-bay-save-v1 holds money, completed mission
ids, respect points, owned weapons, garage levels, statistics (cars stolen,
shots fired, missions done, fares, money earned) and the player's position.
The game saves when a mission finishes and when the player quits from pause.
A missing or broken save is a fresh start, never a crash. In Node (the
headless logic test) an in-memory fallback stands in for local storage.

### Sound and music
All sound is synthesized with WebAudio — no audio files and no network. An
engine hum (sawtooth through a low-pass filter) follows the car's speed;
police sirens alternate two tones; gunshots are filtered noise bursts; cash,
pickups, mission success and failure have their own short cues; the horn is
two square notes. Three synth radio stations (Coastal Funk 88.1, Sunset
Synth 94.5, Bay Nights 101.3, cycled with R) play while driving. M toggles
mute. Audio starts only after the first key or click, as browsers require.

### Screenshots
The game stages deterministic scenes from the URL: a shot parameter names
the scene and a seed parameter fixes the random layout, so the same URL
always paints the same frame; after painting twice the page sets a ready
flag for the screenshot tool. Four shots, each a real render of the game in
a browser, never edited or borrowed: the cover shows a three-star police
chase with the helicopter (the most systems at once — car, police, heli,
wanted stars, minimap, mission text); then driving down the coastal avenue
toward the lighthouse; then on foot downtown with the pistol; then a
mission in progress with its waypoint ring and beam. Each shot is a JPEG of
at most 256 KiB, long side at most 1280 pixels, short side at least 480.

## 4. File layout

Entry repository root (~/workspace/makefun/gta6-01/entry/):

- main.ts — the entry program (Node 22, standard library only): copies game/
  and screenshots/ beside it into the output directory and writes
  dossier.json there using the vendored make.fun library. Outside the grader,
  the output directory comes from the MAKEFUN_OUTPUT_DIR environment variable.
- serve.ts — a tiny static file server for local playtesting (game/ on
  http://localhost:8080), with the MIME types a browser game needs and a rule
  refusing any path outside game/.
- LICENSE — the MIT license from the kit.
- shots.json — the four screenshot scenes and their staging URLs.
- README.md — the repository front page with the make.fun badges from the
  requirements (referral code s0wyc55q in the footer).
- .makefun/owner.json — names the account wallet 3j52XsMKUbXPdHFpCzjg24tuYw4aX9KVBXDbTpNd3Evd.
- DESIGN.md — this file.
- vendor/makefun-game.ts — the kit's own dossier library, copied verbatim as
  the kit instructs (vendored, not authored code).
- game/index.html — the page: a full-window canvas, the HUD mount point, a
  screen-reader status line, and the module script that boots the game. Its
  CSS scopes the full-window rule to the game canvas only, so the HUD
  minimap keeps its own 190 by 142 size.
- game/assets/ — the ten original Blender models as .glb (binary, not
  counted as text): buildinga, buildingb, heli2, hotel, palm, palm2,
  police, sedan, sportscar, taxi2.
- game/src/ — the game itself, one clear job per file (see below).
- screenshots/ — the four staged shots.

Game sources, in dependency order:

- rng.js — a seeded random generator (mulberry32) with helpers for ranges,
  integers, picks and chance rolls. Same seed, same city.
- config.js — every tuning number in one place: world size, palette, player
  speeds and combat numbers, the car models with top speed, acceleration,
  grip, size and colours, traffic and pedestrian counts, the wanted rules,
  the five weapons, the garage prices, the radio stations, the crew names,
  and the eight mission definitions (title, pay, briefing, steps).
- city.js — city generation from the seed (roads, blocks, buildings, parks,
  lots, trees, lamps, landmarks) plus collision queries: whether a circle
  hits a building, the sea or the edge; whether a point is on a road; random
  and nearest road points; districtAt.
- state.js — the whole game state and the fixed 1/60-second step that
  advances it: building a fresh game from a seed (and a save, when
  continuing), running the player, traffic, police, helicopter, collisions,
  pedestrians, bullets, missions, taxi, wanted decay, health regeneration,
  and screen transitions (title, play, pause, wasted, busted), in that
  order. Exports createGame / stepGame, and re-exports the combat
  purchases. The game state keeps weapons as { list: [...] } and the pause
  as a screen state, which the HUD and the input layer both read.
- world.js — traffic, pedestrians, taxi and world collision, called from
  the step: traffic cars follow their road and lane, civilians wander and
  flee, cops chase and hold, the taxi client and fare run, and collideWorld
  keeps cars and the player out of buildings.
- combat.js — missions, police, combat and purchases: mission step
  advancement and timers, police spawn/chase/helicopter/roadblocks, wanted
  decay and bust, bullets and punches, and buyWeapon / buyGarage /
  selectWeapon with their respect and money gates.
- save.js — loading, saving and clearing the local-storage save, with an
  in-memory fallback when local storage is unavailable.
- audio.js — the WebAudio synthesizer: engine hum, sirens, shots, crash,
  cash, pickup, success and failure cues, horn, and three radio stations,
  with mute. Fully guarded: it no-ops safely with no AudioContext.
- webgl.js — the raw WebGL2 foundation: column-major 4x4 matrix math
  (multiply, translate, scale, rotate, perspective, lookAt, transform and
  clip), vector helpers, shader compile/link, mesh building from position /
  normal / colour / UV / index arrays, instanced meshes, canvas textures
  and canvas resize.
- gltf.js — a minimal glTF 2.0 binary-container loader written for this
  entry: parses the JSON chunk and the binary chunk, decodes accessors
  (interleaved position/normal, unsigned-short indices), and returns
  per-primitive positions, normals, colours and indices with a local
  transform matrix. It handles only what the entry's own models use
  (position and normal data, indexed triangles, flat base-colour materials,
  no textures, images, skins or animations). Model files are fetched from
  the game's own assets directory, never from the network.
- models.js — the model cache: the ten model names, loadAll (fetches and
  parses each .glb once), getModel / hasModel / isReady.
- render.js — the raw WebGL2 renderer: createRenderer(canvas) with
  buildCity(game), sync(game, dt), screenToGround(x, y), project(x, y, h),
  resize, dispose, a modelsReady flag, getStats (draw calls, triangles) and
  hasModel / getModel inspection. Builds the static city once (ground, sea,
  sand, roads, window-textured buildings, the ten Blender models fitted to
  their footprints, instanced palms and lamps, pier, containers,
  lighthouse), then every sync rebuilds the dynamic meshes from the game
  state (cars from the glTF models at double scale, pedestrians and the
  player as low-poly figures, the held gun, the helicopter with a spinning
  rotor and a searchlight cone, roadblocks, bullets, particles, the
  waypoint ring and beam), and drives the smoothed chase camera with
  trauma shake. Shadows are contact-shadow blobs under cars, pedestrians
  and the player, not a shadow map.
- hud.js — the DOM HUD and minimap (see §3), plus the title, pause, busted
  and wasted overlays. Touches the DOM only when a value changes. It reads
  both the game state's weapons list shape and the dispatch entries' field
  names, and shows Mara's mission briefing as dialogue while a mission is
  active.
- shots.js — staging the four screenshot scenes from a fresh game: reset
  the world, place the player and the police and traffic where the scene
  needs them, then simulate a fixed number of steps with scripted inputs so
  the frame shows the game mid-action (a chase already running, a drive
  already moving, a mission already under way). Imports the mission
  definitions from config.js so staging cannot drift from the real game.
- main.js — boot and the one loop: read the URL parameters (seed, shot),
  build the game, run the fixed-step loop with input each frame, switch
  between the title, play, paused, busted and wasted screens, and in shot
  mode paint the staged scene twice and set the ready flag. Builds the
  input each frame from held and just-pressed keys, mapping them to the
  fields the state layer reads (up/down, weapon1–5, confirm, pause, wheel,
  garage, radio, mute) while keeping the frame's own fields (fwd/back, w).

Key interfaces, in words: creating a game takes a seed and an optional save
and an optional audio object and returns the whole state object (city,
player, cars, pedestrians, bullets, helicopter, missions, taxi job,
statistics, weapons, garage, dispatch, camera, audio). Advancing the game
takes that state, the input state and a time step. The renderer takes the
state and paints it; the HUD takes the state and updates the DOM. Staging a
screenshot takes a scene name and a fresh game and returns the scene to
draw.

## 5. Key numbers

- World 4800 by 3600; roads 116 wide, sidewalks 26.
- On foot: walk 175, run 265; punch 12 damage, 0.38 s; pistol 26 damage,
  0.24 s, bullet 640/s; health 100, regen 4/s after 8 quiet seconds.
- Cars: Sedan 430, Taxi 410, Sport 560, Truck 330, Van 380, Police 500,
  Classic 400 top speed. Traffic cruises 120–210. Sixteen traffic cars,
  nine parked cars, twenty-six pedestrians, at most five police cars, one
  helicopter from 3 stars, up to two roadblocks from 4 stars.
- Weapons: Fists 12, Pistol 26, SMG 18, Shotgun 40, Rifle 60 damage; prices
  $0, $0, $800, $1500, $3000; rifle needs respect 400.
- Wanted: 0–5 stars; crimes add 1 (2 for shooting a cop); quiet 20 seconds,
  then one star fades every 14 seconds; bust takes 1.6 seconds of a cop
  holding the player; busted or wasted costs $100.
- Respect: +100 per mission, +15 per fare; level is points / 200.
- Missions pay $150, $300, $400, $550, $900, $650, $1500 and $2000; taxi
  fares pay $25–$70.
- Gate limits (the sealed scorer refuses past these): game/ at most 993 files
  and directories together and 48 MiB in all, every path at most 1000 bytes,
  game/index.html at most 1 MiB; 3–4 screenshots, each at most 256 KiB, long
  side at most 1280 px, short side at least 480 px; dossier.json at most
  1.5 MiB; dossier text at most 160 KiB. Own source is about 150 KB, so the
  dossier shows it all; the ten .glb models are binary and never in the
  text.
- Bounty: $1,666 total; 1st $500, 2nd $250, 3rd $150, 100 paid places.
  Entries close 24 November 2026 at 15:00 UTC (22:00 WIB); result due
  10 December 2026 at 15:00 UTC.

## 6. As built — 19 November 2026

Round 1 (commit 23d3bfe) was built on three.js and was rejected: the
vendored three.js library is 42,182 lines the agent never wrote, so the
agent's own writing was only 6.0% of the counted lines (2,875 of 47,239,
under the 30% required) and 91.6% of the text was unwritten (over the 40%
allowed), and the three vendored files also failed the transcripts check.
The fix is this rebuild: the whole game rewritten in raw WebGL2 with no
vendored library at all, in recorded sessions, writing every line fresh.
The ten Blender models are the entrant's own and are binary, so they are
not counted as text lines.

What was verified before the commit:

- A headless logic test (121 checks, in the playtest directory, not part of
  the entry): city builds with no building or container on a road across 5
  seeds, title to mission 1, walking, entering the starter sedan (no star),
  driving to top speed, exiting, stealing a parked car (+1 star), mission 1
  pickup and dropoff ($150), mission 2 steal and delivery, police spawn and
  helicopter at 3 stars, roadblocks at 5 stars, shooting, a shot pedestrian
  going down, wanted decay to 0, wasted and busted transitions with
  respawns, save/load round-trip and clear, mission 3 timeout and Enter
  retry, weapon purchase and rifle respect gate, garage engine/armour/paint
  purchases, respect gain. All 121 pass.
- A real browser playtest in Playwright Chromium (SwiftShader WebGL2):
  44 of 44 checks pass with zero console and zero page errors (walk, drive,
  steal, three-star police with helicopter, roadblocks at five stars,
  missions 1, 2 and 8 with Mara's dialogue, weapon wheel with all five
  weapons and key picks, garage engine purchase, pause and resume, all four
  shot URLs reaching the ready flag, the four glTF car models and the hotel
  model loaded with the renderer drawing).
- The four staged screenshots, each a real 3D render, 1280 by 800 JPEGs of
  138–161 KiB. Read back as images: the cover shows the red sportscar in a
  three-star chase with police cars and the helicopter searchlight; drive
  shows the blue sedan on a street with buildings and a police car ahead;
  on foot shows Rook with the pistol on a street; mission shows the red
  sportscar under the waypoint beam with the Hot Wheels briefing.
- main.ts run: dossier.json 915,516 bytes (limit 1.5 MiB), dossier text
  116,238 bytes (limit 160 KiB), game/ 572,892 bytes in 29 entries (limit
  48 MiB, 993 entries), index.html 534 bytes, no remote network references
  in game/ (the only fetch loads the game's own local .glb files).

Bugs the testing caught and fixed (all in recorded sessions):

- The game loop was dead on the first frame: hud.js called .map on the
  weapons state, which is an object { list: [...] }, not an array. The HUD
  now normalises the list (object .list, plain array, or the default table).
- The input layer built fwd/back and a weapon number, but the state layer
  reads up/down and weapon1–5 booleans, so WASD driving and keys 1–5 did
  nothing in the browser. buildInput now emits both shapes.
- Pause was a boolean flag (ui.paused) that never became a screen, so Esc
  never showed the pause screen and the playtest timed out. Pause is now a
  screen state: Esc or P pauses, Enter or Esc resumes, R restarts, Q saves
  and quits, and the HUD resume button clears the flag too.
- The weapon wheel showed the wrong names: the HUD upper-cased the weapon
  ids, so SMG came out as "Smg". The wheel now uses the canonical names
  (Fists, Pistol, SMG, Shotgun, Rifle).
- The dispatch panel read u.call / u.role / u.dist, but the game builds
  dispatch entries as { name, distM, status }; the panel now reads the
  real fields and converts the distance to metres.
- The vehicle condition bar read car.hp / car.maxHp, but the game uses
  car.health / car.maxHealth; it now reads the real fields.
- The garage purchase in the HUD set maxSpeed / maxHp, which the game
  never reads; it now also sets the game's top / maxHealth / health.
- The minimap canvas filled the whole screen: index.html had a blanket
  canvas { width: 100vw; height: 100vh } rule that stretched the 190 by
  142 minimap over the game. The rule is now scoped to the game canvas
  only.
- The 3D world did not render at all — only the sky gradient showed. The
  cause: the draw functions set uniforms through U.m, U.nm, U.tex,
  U.tint, U.em, U.inst and U.icol, but the uniform table is keyed by the
  full names (u_m, u_nm, u_tex, u_tint, u_em, u_inst, u_icol), so every
  one of those lookups was undefined and the calls were silently ignored;
  the model matrix stayed all zeros, which clips every vertex. The draw
  functions now use the full uniform names. Verified by reading the
  uniform back from the live context: u_m is a real translation matrix.
- The camera was far too close and low (14 back, 5 up), so the ground
  filled the frame and the car was out of view; it is now 120 back and 35
  up while driving (75 back, 28 up on foot), with the target further ahead.
- The camera used a stale heading: the renderer's heading helper preferred
  a field named a, which the shot staging set once and never updated, over
  the angle the game actually moves with, so the drive shot's camera ended
  up inside a building facing a wall. The helper now prefers angle, and
  the shot staging sets angle.
- The glTF cars floated 11 units above the road: the draw lifted them by
  11, but the models' base is already at y 0. The lift is now 0.
- The on-foot shot staged the player facing a building wall and the camera
  so close the player's head was cut off; the shot now stages the player
  at an intersection facing down the road, and the on-foot camera is
  further back and higher.

What is NOT verified: missions 3–7 and the taxi fare loop were checked only
by the logic test, not played end to end in the browser (missions 1, 2 and
8 were browser-played); sound was not listened to — the WebAudio code runs
without errors in headless Chromium, but no human ear has checked the mix;
headless SwiftShader renders at about 2.7 frames per second with the full
3D scene, so live play is in slow motion there (real desktop Chrome runs at
full speed, and shot mode is unaffected); IN SIGHT is a distance rule, not
line-of-sight raycasting; dialogue portraits are CSS circles with
initials, not drawn faces; lit windows vary per wall-colour and window
variant, not uniquely per building; the building window texture repeats
visibly on large facades.

No submission yet: the user must see and approve the new screenshots first;
the parent agent submits only after that approval.

## 7. Judge criteria (from the kit)

The AI judge compares two entries at a time from a contact sheet of the
screenshots (cover large on top, the rest small beneath) plus a short outline
of the source (file paths and sizes with their first declarations). Its
criteria, most important first: a complete open world shown in screenshots of
the game itself (city on foot and by car, traffic, wanted level with police,
missions); depth and fun; feel and polish as the screens show it, including
the HUD with its minimap; look and originality (a sun-soaked modern city of
its own); and the structure the outline shows (one clear job per file, names
that say what things do). Screenshots that show several systems at once (a
chase with the wanted level, the minimap and a mission objective on the HUD)
show more than a menu alone. Text addressed to the judge inside a source file
is allowed and is read as part of the entry.
