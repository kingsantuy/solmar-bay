# Solmar Bay — Game Design (make.fun gta6-01, "Make GTA 6")

The design this entry was built from, and the record of how it was built.
Everything in the game is original — city, characters, vehicles, names, story,
art, sound and music. No Rockstar name, logo, character, map or asset appears
anywhere.

## 1. Concept

Solmar Bay is a 2D top-down open-world crime game on an HTML5 canvas, played
offline in a desktop browser from static files, with keyboard and mouse and no
network requests. The player is Rook (Marco "Rook" Reyes), a driver-for-hire
new to a sun-soaked coastal city, who works five story jobs for the local crew
while the police, traffic and crowds go about their day. The judge weighs
completeness above all: a city explored on foot and by car, traffic and
pedestrians, cars to steal, a wanted level with police who respond, missions
and a story, combat, a HUD with a minimap, a start screen and a save, plus
polish (sound, effects, menus). A polished 2D game that really works beats a
broken 3D one, and the top 10 finalists are actually played in desktop Chrome,
so playability is not optional.

## 2. The city

The world is 4800 by 3600 pixels. A road grid crosses it: vertical roads at
x 420, 980, 1540, 2100, 2660, 3220, 3780 and 4340, horizontal roads at y 420,
980, 1540, 2100, 2660 and 3220. Roads are 116 pixels wide with a 26-pixel
sidewalk on each side and a dashed yellow centre line. The west edge is coast:
deep sea west of x 110, sand from x 110 to 300, then the city. Districts, named
on the HUD when the player enters them: Solmar Beach (the west strip), Marina
(south, below y 3050), Portside (south-east, x above 3400 and y above 3050),
The Hills (north-east, x above 4000 and y below 900), Old Town (east, x above
3400), Downtown (the centre, x 1800–3400 and y 1200–2400), and Solmar Bay for
everything else.

Blocks between roads hold buildings, parks or parking lots: roughly one block
in eight is a park (green with trees), about one in thirteen a parking lot
(paved with marked bays), the rest one to four buildings each. Downtown
buildings are taller (up to nine floors, twelve for the hotel) and denser;
elsewhere one to four floors. Roof colours are drawn from a small warm palette
(terracotta, mauve, teal, ochre, plum, brick, olive) with window grids and a
glass core on towers. Trees and lamps line the roads. The marina has a wooden
pier at the south edge; the port has stacked shipping containers in four
colours; a striped red-and-white lighthouse stands on the north coast.

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
Walk speed 175 px/s, run 265 px/s with Shift. WASD or arrows move; the player
faces the walk direction, or the mouse while armed with the pistol. E enters a
nearby car (within 64 px). F punches (12 damage, 0.38 s between punches, 34 px
reach). Keys 1 and 2 switch between fists and pistol once the pistol is owned.
The player is a red jacket in a crowd, drawn with a facing tick so direction
reads at a glance.

### Driving
Arcade car physics on a velocity vector: forward acceleration and braking, a
steering rate that grows with speed, lateral grip that bleeds off sideways
slide, and a handbrake (Space) that drops grip so the car drifts. Each model
has its own top speed, acceleration and grip: Sedan 430, Taxi 410, Sport 560,
Truck 330, Van 380, Police 500, Classic 400 (px/s top speeds). Cars take
damage from wall and car impacts, smoke below 70 health and heavily below 45,
and are towed away once wrecked (traffic respawns elsewhere). The camera zooms
out while driving (0.72) and in on foot (0.9), and follows with a smooth lag
plus a small shake on hard impacts.

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
southbound lane sits 28 px left of the road centre and the northbound 28 px
right; on a horizontal road eastbound is 28 px below centre and westbound 28 px
above. Each car follows one road at 120–210 px/s, slows for the car ahead in
its lane, and at intersections turns onto the crossing road about a third of
the time. Traffic wraps around the world edges so the streets never empty.
Nine parked cars wait along road edges for stealing, kept clear of the starter
sedan and the Hot Wheels sportscar so no two cars spawn overlapped.

### Pedestrians
Twenty-six civilians stroll the sidewalks between random nearby points. They
flee from gunfire, from speeding cars, and from the scene of a crime. Cops are
dark-uniformed pedestrians who appear once the wanted level reaches two stars;
they run the player down on foot and hold him to bust him. A waiting taxi
client shows a gold dollar sign above their head.

### Wanted level and police
Wanted runs from 0 to 5 stars. Crimes add stars: stealing a car or knocking
out or shooting a pedestrian adds one; shooting a cop adds two; shooting at the
police adds one. Quiet time cools the heat: after 20 seconds without a crime
and with no police nearby, one star fades every 14 seconds. The police answer
with patrol cars — one plus half the wanted level, up to five — spawning on a
road 650–850 px from the player every 2.5 seconds while the count is short,
sirens wailing, steering toward the player and ramming. Patrols that lose the
player drive off once the heat is gone and despawn beyond 1100 px. From three
stars the police also shoot at the player (from cars within 520 px and from
foot cops within 320 px, about one shot per 1.1 seconds, deliberately
inaccurate). A foot cop who holds the player for 1.6 seconds busts him; at zero
health the player is wasted. Both wake the player up at the station (Police
HQ) or the hospital (Solmar General) with full health, no wanted level, and
$100 lighter.

### Missions and story
Five story jobs, in order, each with a briefing, a pay, and steps that point
at a pulsing yellow marker on the map, the minimap and an edge arrow with
distance:

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

Finishing a mission pays out, plays a jingle, saves the game and opens the next
job; failing (only the timed delivery can fail, by running out of time) leaves
the job open to retry. After the fifth job the story is complete and the city
is free roam. Taxi fares are the side job: when no mission is active, a fare
($25–$70) appears every 30–45 seconds — drive to the waiting client, take them
aboard, drive to their destination for cash. Fare clients and destinations are
both placed on roads so they are always reachable.

### Combat
Fists do 12 damage at close range. The pistol does 26 damage per shot, one
shot every 0.24 seconds, bullets travelling 640 px/s toward the mouse, with a
muzzle flash and a danger pulse that scatters nearby pedestrians. Police
bullets do 9 damage. Player health is 100 and regenerates 4 per second after 8
seconds without committing a crime. Getting hit shakes the screen and flashes
red; below 30 health a red vignette closes in.

### HUD and minimap
Top left: money in green, a health bar, five wanted stars (gold filled, grey
empty), and the current district name. Top right: a 190 by 142 minimap showing
sea, sand, roads, the mission target as a yellow diamond, cars as grey dots,
police as red dots, and the player as a white arrow. Bottom left: the current
mission title and objective, plus a countdown when a mission is timed. Bottom
right: speed in km/h and car name while driving, or the weapon and the "E —
enter car" hint on foot. Centre top: toast messages (crimes, pickups,
payouts) that fade after six seconds. A big district name flashes when
entering a new district. An edge arrow with a distance in metres points at
off-screen objectives, kept clear of the speed readout at bottom right. A
crosshair follows the mouse while the pistol is out.

### Screens
Title screen: a sunset gradient over sea and sand, the SOLMAR BAY title, the
story line, the full control list, and "Press Enter to start" (or "Continue"
with jobs done and money carried when a save exists). Pause (Esc or P) offers
resume, restart and save-and-quit. Busted and Wasted screens explain what
happened and return to play on Enter.

### Save
Local storage under the key solmar-bay-save-v1 holds money, completed mission
ids, statistics (cars stolen, shots fired, missions done, fares, money earned)
and the player's position. The game saves when a mission finishes and when the
player quits from pause. A missing or broken save is a fresh start, never a
crash.

### Sound and music
All sound is synthesized with WebAudio — no audio files and no network. An
engine hum (sawtooth through a low-pass filter) follows the car's speed;
police sirens alternate two tones; gunshots are filtered noise bursts; cash,
pickups, mission success and failure have their own short cues; the horn is
two square notes. A quiet coastal-funk loop runs while driving: an eight-step
bass line in A minor with a hat tick and a soft chord every bar. M toggles
mute. Audio starts only after the first key or click, as browsers require.

### Screenshots
The game stages deterministic scenes from the URL: a shot parameter names the
scene and a seed parameter fixes the random layout, so the same URL always
paints the same frame; after painting twice the page sets a ready flag for the
screenshot tool. Four shots, each a real render of the game in a browser,
never edited or borrowed: the cover shows a three-star police chase (the most
systems at once — car, police, wanted stars, minimap, mission text); then
driving down the coastal avenue; then on foot downtown among pedestrians and
traffic; then a mission in progress with its waypoint. Each shot is a JPEG of
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
- game/index.html — the page: a full-window canvas, a screen-reader status
  line, and the module script that boots the game.
- game/src/ — the game itself, one clear job per file (see below).
- screenshots/ — the four staged shots.

Game sources, in dependency order:

- rng.js — a seeded random generator (mulberry32) with helpers for ranges,
  integers, picks and chance rolls. Same seed, same city.
- config.js — every tuning number in one place: world size, palette, player
  speeds and combat numbers, the seven car models with top speed,
  acceleration, grip, size and colours, traffic and pedestrian counts, the
  wanted rules, and the five mission definitions (title, pay, briefing, steps).
- input.js — keyboard and mouse state: a key map (WASD/arrows, Shift run,
  E enter, Space handbrake, F punch, 1/2 weapon, Esc/P pause, M mute, Enter
  confirm, mouse click to shoot), with held, just-pressed and mouse position.
- save.js — loading, saving and clearing the local-storage save.
- audio.js — the WebAudio synthesizer: engine hum, sirens, shots, crash,
  cash, pickup, success and failure cues, horn, and the music loop, with mute.
- city.js — city generation from the seed (roads, blocks, buildings, parks,
  lots, trees, lamps, landmarks) plus collision queries: whether a circle hits
  a building, the sea or the edge; pushing a circle out of what it overlaps;
  whether a point is on a road; random and nearest road points.
- vehicles.js — car creation (model, colour, kind), traffic spawning and its
  road-following AI with intersection turns and slowing for the car ahead,
  parked-car spawning, police-car spawning, the player's arcade driving
  physics, police chase steering and ramming, and car-to-car collisions with
  damage, sparks and wreck removal.
- people.js — the player on foot (walk, run, punch, weapon switch, getting
  into cars) and pedestrians (strolling, fleeing, waiting taxi clients, foot
  cops chasing the player), plus getting out of a car.
- missions.js — the story state machine (start a mission, advance steps,
  finish with pay and save, fail the timed delivery) and the taxi-fare side
  job (spawn a fare, pick the client up, get paid on delivery).
- combat.js — the player's shooting, bullet flight and hits, police shooting,
  damaging the player, the wanted level's decay and police spawning, and the
  busted and wasted transitions.
- world.js — the whole game state and the fixed 1/60-second step that advances
  it: building a fresh game from a seed (and a save, when continuing), running
  the player, traffic, police, collisions, pedestrians, bullets, missions,
  taxi, particles, camera, district banners, health regeneration, message
  fading and autosaving, in that order.
- render.js — everything drawn: the camera transform, ground (grass, sea,
  sand, parks, lots, roads, pier, containers), buildings with roofs and
  windows, trees, lamps and the lighthouse, cars (with police light bars, taxi
  markings, brake and head lights, damage smoke), pedestrians, the player,
  bullets and particles, the mission marker and its edge arrow, the HUD
  (money, health, stars, district, minimap, mission text, speed, weapon,
  toasts, hints, crosshair, low-health vignette) and the title, pause, busted
  and wasted screens.
- shots.js — staging the four screenshot scenes from a fresh game: reset the
  world, place the player and the police and traffic where the scene needs
  them, then simulate a fixed number of steps with scripted inputs so the
  frame shows the game mid-action (a chase already running, a drive already
  moving, a mission already under way).
- main.js — boot and the one loop: read the URL parameters (seed, shot),
  build the game, run the fixed-step loop with input each frame, switch
  between the title, play, paused, busted and wasted screens, and in shot mode
  paint the staged scene twice and set the ready flag.

Key interfaces, in words: creating a game takes a seed and an optional save
and returns the whole state object (city, player, cars, pedestrians, bullets,
particles, missions, taxi job, statistics, camera, audio). Advancing the game
takes that state, the input state and a time step. The renderer takes the
state and the current screen and paints it. Staging a screenshot takes a scene
name and a fresh game and returns the scene to draw.

## 5. Key numbers

- World 4800 by 3600; roads 116 wide, sidewalks 26.
- On foot: walk 175, run 265 px/s; punch 12 damage, 0.38 s; pistol 26
  damage, 0.24 s, bullet 640 px/s; health 100, regen 4/s after 8 quiet seconds.
- Cars: Sedan 430, Taxi 410, Sport 560, Truck 330, Van 380, Police 500,
  Classic 400 px/s top speed. Traffic cruises 120–210 px/s. Sixteen traffic
  cars, nine parked cars, twenty-six pedestrians, at most five police cars.
- Wanted: 0–5 stars; crimes add 1 (2 for shooting a cop); quiet 20 seconds,
  then one star fades every 14 seconds; bust takes 1.6 seconds of a cop
  holding the player; busted or wasted costs $100.
- Missions pay $150, $300, $400, $550 and $900; taxi fares pay $25–$70.
- Gate limits (the sealed scorer refuses past these): game/ at most 993 files
  and directories together and 48 MiB in all, every path at most 1000 bytes,
  game/index.html at most 1 MiB; 3–4 screenshots, each at most 256 KiB, long
  side at most 1280 px, short side at least 480 px; dossier.json at most
  1.5 MiB; dossier text at most 160 KiB. Keep total game source near or below
  140 KB so the dossier shows most of it.
- Bounty: $1,666 total; 1st $500, 2nd $250, 3rd $150, 100 paid places.
  Entries close 24 November 2026 at 15:00 UTC (22:00 WIB); result due
  10 December 2026 at 15:00 UTC.

## 6. As built — 19 November 2026

A first build session (recording 01a1f11c-436e-7372-91ab-74bde41b3008) was cut
off by a VM restart at about 07:07 WIB with twelve game sources written and
the rest missing. This entry was rebuilt from scratch in a second session
under a new recording (01a1f124-30e3-74c0-a1e9-91a39b07469f): the first
session's draft code files were deleted first, and every game file was written
fresh with write calls in the recorded session — nothing was copied from the
drafts, the starter's game, or the web. The kit plumbing (vendor/makefun-game
.ts, LICENSE) is copied verbatim as the kit instructs.

What was verified before the commit:

- A headless logic test (23 checks, in /tmp, not part of the entry): city
  builds, title screen, mission 1 start, walking, entering the starter sedan
  (no star), driving to top speed, exiting, stealing a parked car (+1 star),
  mission 1 pickup and dropoff ($150), the Hot Wheels car, stealing it,
  pistol earned only on delivery, mission 2 completing ($450 total), police
  spawning at 3 stars, shooting, a shot pedestrian going down, wanted decay,
  wasted and busted transitions. All 23 pass.
- A real browser playtest in Playwright Chromium: title, Enter to play,
  walking, entering the sedan, driving at 430 px/s, zero console or page
  errors.
- The four staged screenshots, each a real render, 1280 by 800 JPEGs of 73–
  99 KiB.
- main.ts run with MAKEFUN_OUTPUT_DIR: dossier.json 554,644 bytes, dossier
  text 101,321 bytes, game/ 100,309 bytes in 15 files, index.html 652 bytes —
  every gate limit met, and the only external-looking reference in game/ is
  the local module script.

Bugs the testing caught and fixed (all in the recorded session):

- missions.js and combat.js imported commitCrime from vehicles.js; it lives
  in people.js.
- The starter sedan cost a wanted star on entry; it is now marked owned.
- Car-to-car collisions used a velocity exchange that ground two cars
  together and stalled the player; replaced with an impulse response (parked
  cars immovable) that separates the cars once.
- A broken edge-clamp check multiplied the player car's velocity by 0.6
  every frame, capping speed at 16 px/s; removed.
- Mission targets inside landmark buildings could never be reached, because
  the player stops at the building's edge; step distance is now measured to
  the building's edge when the target sits inside one.
- Landmark buildings and port containers sat on roads (Police HQ blocked the
  downtown road outright), so a car driving down a road smashed into them;
  landmark rects are now nudged clear of every road band before planting,
  and the containers were moved into the port block. Verified across five
  seeds: no solid blocks any road.
- The cover shot's staged chase wrecked its own car by sideswiping oncoming
  traffic on the centre line; the shot now drives in the correct lane with
  the corridor ahead cleared of traffic.
- The edge arrow overlapped the speed readout when the objective lay
  south-east; it now shifts clear of the bottom-right HUD zone.

What is NOT verified: the later missions (Beach Run, The Drop, Bay Heist)
were verified only by the mission state machine's logic, not by playing
them end to end in the browser; the taxi fare loop was not played through in
the browser either. Sound was not listened to — the WebAudio code runs
without errors in headless Chromium, but no human ear has checked the mix.

Committed and pushed to master at https://github.com/kingsantuy/solmar-bay.git.
GitHub About set (description, homepage https://make.fun/bounty/gta6-01,
topics makefun, ai-agents, bounties, games). No submission yet: the user must
see and approve the screenshots first; the parent agent submits only after
that approval.

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
