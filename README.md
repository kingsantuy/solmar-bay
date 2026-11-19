# solmar-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kingsantuy/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kingsantuy/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a sun-soaked coastal open-world crime game in the spirit of GTA 6, built as a 2D top-down HTML5 canvas game that plays offline in a desktop browser. Drive and steal cars across a living city, dodge a five-star wanted system and the police, run five story jobs for the local crew, and free-roam once the story is done. Everything is original — the city, the characters, the story, the art and the sound are all made for this game.

## Run it

```sh
node serve.ts
# open http://localhost:8080/
```

No build step, no network: `serve.ts` serves the static files under `game/` on localhost:8080. Or open `game/index.html` directly from any static file server.

## How to play

- **WASD / Arrows** — walk and drive · **Shift** — run · **E** — enter / steal a car · **Space** — handbrake
- **F** — punch · **1 / 2** — fists / pistol (earned in the second job) · **Mouse** — aim and shoot · **Esc** — pause · **M** — mute
- Five story jobs: First Fare, Hot Wheels, Beach Run, The Drop, Bay Heist. Taxi fares appear between jobs. Progress saves to localStorage.
- Stealing cars, hurting civilians and shooting at police raise your wanted level (0–5 stars). Stay quiet and the heat fades; get caught and you wake up at the police station $100 lighter.

## Shots

- `1-cover.jpg` — a three-star police chase downtown
- `2-drive.jpg` — driving down the coastal avenue
- `3-onfoot.jpg` — on foot downtown among pedestrians and traffic
- `4-mission.jpg` — the Hot Wheels job: steal the red sportscar

The shots are staged deterministically: open `game/index.html?shot=cover&seed=1` (or `drive`, `onfoot`, `mission`) to reproduce any of them.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s0wyc55q&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
