# solmar-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kingsantuy/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kingsantuy/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a sun-soaked coastal open-world crime game in the spirit of GTA 6, built as a 3D game with three.js r187 (vendored under `game/vendor/`, no network) and a third-person chase camera, playing offline in a desktop browser. Drive and steal cars across a living 3D city, dodge a five-star wanted system with police cars and a helicopter, run seven story jobs for the local crew, and free-roam once the story is done. The look is PBR sunset lighting with a sky dome, glowing windows and shadows, and five original 3D models made in Blender (sportscar, sedan, police car, Grand Solmar Hotel, palm tree) loaded as glTF with procedural fallbacks. Everything is original — the city, the characters, the story, the art and the sound are all made for this game.

## Run it

```sh
node serve.ts
# open http://localhost:8080/
```

No build step, no network: `serve.ts` serves the static files under `game/` on localhost:8080. Or open `game/index.html` directly from any static file server.

## How to play

- **WASD / Arrows** — walk and drive · **Shift** — run · **E** — enter / steal a car · **Space** — handbrake
- **F** — punch · **1 / 2** — fists / pistol (earned in the second job) · **Mouse** — aim and shoot · **Esc** — pause · **M** — mute · **R** — radio station
- Seven story jobs: First Fare, Hot Wheels, Beach Run, The Drop, Bay Heist, Night Shift, The Big One. Taxi fares appear between jobs. Progress saves to localStorage.
- Stealing cars, hurting civilians and shooting at police raise your wanted level (0–5 stars). Stay quiet and the heat fades; get caught and you wake up at the police station $100 lighter.

## Shots

- `1-cover.jpg` — a three-star police chase downtown, helicopter overhead
- `2-drive.jpg` — driving down the coastal avenue toward the lighthouse
- `3-onfoot.jpg` — on foot downtown among pedestrians and traffic
- `4-mission.jpg` — the Hot Wheels job: the waypoint ring at the Chop Shop

The shots are staged deterministically: open `game/index.html?shot=cover&seed=1` (or `drive`, `onfoot`, `mission`) to reproduce any of them.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s0wyc55q&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
