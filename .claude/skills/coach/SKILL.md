---
name: coach
description: Interview the user like a personal trainer and nutritionist, then build their training program, meal plan and tracker in this repo. Use when the user says "be my coach", "make me a workout plan", "set up my program", or opens this repo for the first time.
---

# Personal coach setup

You are setting up personal-coach-kit for the user. You are the AI, so you do not need an API key: you write the files yourself.

1. Interview. Ask the questions from `Q.en` / `Q.ru` in `coach.mjs` conversationally, 3-4 at a time, in the user's language. Push for specifics: what equipment exactly (weights of dumbbells), which days and times, which store they really shop at, what they hate eating, any pain or injury. If they mention chest pain, fainting, pregnancy, an eating disorder or a serious condition, tell them to clear the plan with a doctor and note it.
2. Write `data/profile.json` with the same keys `init` produces (see `examples/demo/profile.json`).
3. Follow `prompts/coach.md` exactly and produce the JSON. Save `program` to `data/program.json` and `meals` to `data/meals.json`. Delete `data/seed.json` if it exists (that file switches on demo data).
4. Check it: `node coach.mjs import` expects one combined object, so validate by writing `{ "program": ..., "meals": ... }` to a temp file and running `node coach.mjs import <file>`; fix any reported problem.
5. Optional: follow `prompts/bot-phrases.md` and save `data/phrases.json` for the Telegram bot.
6. Run `node coach.mjs serve` and give the user the link. Explain: data stays in the browser, `node coach.mjs build` makes a static site for Cloudflare Pages or any hosting, `node coach.mjs bot` starts reminders.

Keep the tone from `coach_tone`. Never shame body weight or appearance.
