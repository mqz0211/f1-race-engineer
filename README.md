# Apex — F1 Race Engineer

A standalone browser-based Formula 1 race engineer simulator. You sit on the pit wall and make the calls; the simulated driver is on track and responds over team radio.

The main experience is a radio conversation supported by a compact race situation: position, gap to the car ahead, tyre condition, and pit window. Beginners can choose suggested calls or write their own.

> **Simulation notice:** This is an independent fan-made prototype. It is not affiliated with Formula 1, the FIA, any racing team, or any circuit. Race situations and telemetry are illustrative, simulated data rather than live or official data.

## Current MVP

- Role-reversed radio: you are the race engineer; the simulated driver replies.
- Beginner-friendly suggested calls for tyre management, pit stops, pace, and asking for more information.
- Freeform typed radio messages.
- Push-to-talk speech recognition where supported by the browser.
- Spoken driver replies using browser speech synthesis, preferring an English (United Kingdom) voice.
- Radio transmission sound effects with an option to disable them.
- Local scenario engine that works without an API key.
- Race state that updates after each radio instruction.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

To verify a production build:

```bash
npm run build
npm run preview
```

## How the simulation works

The current prototype uses a local rule-based scenario engine. It recognises common race-engineering instructions and generates contextual driver radio replies. It is not connected to a hosted language model yet.

A future AI driver can be added through a server-side endpoint. Keep provider credentials on the server; never expose model API keys in frontend code or `VITE_*` browser variables.

## Browser voice support

Microphone recognition depends on browser support and microphone permission. Typed radio remains available as a fallback. Spoken output uses installed system voices; the app requests `en-GB` and selects a British English voice when one is available.

## Project structure

```
src/
  lib/race-engine.ts  Simulated race state and driver response logic
  App.tsx             Radio-first race engineer interface and voice controls
  index.css           Responsive pit-wall visual system
  main.tsx            React entry point
```

## Roadmap

- Server-side AI driver adapter with a consistent driver personality and race memory.
- More scenarios: traffic, damage, penalties, changing weather, Safety Cars, and pit windows.
- More detailed strategy outcomes and race progression.
- Better radio audio processing and configurable voice settings.
- Unit-tested scenario and strategy model.

## Licence

No licence has been added yet. All rights remain with the respective authors.
