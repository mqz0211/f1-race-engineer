# Apex — F1 Race Engineer

A standalone browser-based Formula 1 race engineer simulator. It is designed as a pit-wall interface rather than a racing game: you communicate with a calm, concise race engineer, monitor a simulated race, and make strategy calls.

> **Simulation notice:** This project is an independent fan-made prototype. It is not affiliated with Formula 1, the FIA, any racing team, or any circuit. All telemetry and circuit graphics in the starter build are illustrative, not live or official data.

## Current MVP

- Pit-wall dashboard with lap, position, interval, fuel, weather, and tyre information.
- Simulated race controls: advance a lap, cycle weather, and deploy/end a Safety Car.
- Engineer radio log with quick commands and typed driver messages.
- Push-to-talk speech recognition when supported by the browser.
- Spoken engineer responses using browser speech synthesis, preferring an English (United Kingdom) voice.
- Local response engine so the prototype works without an API key.
- Optional server endpoint integration for an LLM-powered engineer.

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

## Connecting an AI engineer

The starter includes a local response engine. To use an LLM, create a server-side endpoint and set its URL in a local `.env` file:

```env
VITE_ENGINEER_API_URL=https://your-server.example/api/engineer
```

The browser sends a JSON POST request:

```json
{
  "message": "How are the tyres?",
  "raceState": {
    "lap": 18,
    "totalLaps": 52,
    "position": 7
  }
}
```

The endpoint should return:

```json
{ "reply": "Tyre life is in a reasonable window. Keep looking after the rear traction." }
```

The example race state above is abbreviated; the app sends the complete current state.

**Security:** Do not put OpenAI, Anthropic, or other provider API keys in `VITE_*` variables or frontend code. Keep provider credentials on your server, validate incoming requests there, and return only the engineer's reply to the browser.

## Browser voice support

Microphone recognition depends on browser support and microphone permission. The text radio remains available as a fallback. Spoken output uses installed system voices; the app requests `en-GB` and selects a British English voice when one is available.

## Project structure

```
src/
  lib/race-engine.ts  Simulated race state and local engineer responses
  App.tsx             Dashboard, radio controls, and voice interface
  index.css           Responsive pit-wall visual system
  main.tsx            React entry point
```

## Roadmap

- Server-side LLM adapter with a strict race-engineer system prompt.
- Persistent driver profile, team identity, circuit and session setup.
- More race scenarios: qualifying, changing weather, traffic, damage, penalties, and pit windows.
- Better radio audio processing and configurable voice settings.
- Unit-tested strategy model and scenario editor.

## Licence

No licence has been added yet. All rights remain with the respective authors.
