# personal-coach-kit

**Your own AI personal trainer and nutritionist in about 15 minutes.** Answer a short questionnaire, let any AI (Claude, ChatGPT, Gemini or a local model) write your training program and a meal plan from the store you actually shop at, then train with a tracker that has rest timers, interval timers, a shopping list and progress charts. Optional Telegram bot reminds you, checks in and jokes in the personality you pick.

[Русская версия](README.ru.md) · **[Live demo](https://personal-coach-kit.pages.dev)** (fictional profile) · [Демо на русском](https://personal-coach-kit.pages.dev/ru/)

![Tracker: today's workout, meal plan with shopping list, progress](docs/screenshot.png)

## Easiest: hand it to your AI agent

If you use Claude Code (or another agent that can run commands: Codex, Cursor, Claude Cowork), paste this and just answer the questions:

```
Clone https://github.com/devladpopov/personal-coach-kit into a folder personal-coach in my home folder (if there is no git, download the zip), go into it and follow .claude/skills/coach/SKILL.md: be my personal trainer and nutritionist.
```

The agent checks Node.js, interviews you, writes the program and the meal plan itself (no API key), validates them, opens the tracker and gives you a link for your phone. Publishing the site and the Telegram bot are offered as optional steps. Later, come back to the same folder and say "this exercise hurts", "here are my measurements" or "make the next block": the agent keeps coaching.

## Install and run (one command)

```bash
git clone https://github.com/devladpopov/personal-coach-kit && cd personal-coach-kit && node coach.mjs init
```

Needs only Node.js 18+. No `npm install`, no dependencies, no database, no account.

Then:

```bash
node coach.mjs generate   # your AI writes data/program.json and data/meals.json
node coach.mjs serve      # open http://localhost:8080
```

Want to look around first? `node coach.mjs demo && node coach.mjs serve` loads the fictional demo profile.

## What you get

```
Questionnaire  goals, body stats, days and minutes, equipment, injuries,
               food likes and allergies, your store and weekly budget
Program        7-day split for N weeks, phases, progression rule,
               technique cues, swaps for injuries, warm-up and cool-down
Meal plan      calorie and protein targets, A/B weeks x 3 daily menus,
               shopping list for your store with prices, supplements
Tracker        log reps and weight per set, "last time" hints,
               auto rest timer with beeps, full-screen interval timer,
               week view, shopping checklist, weight/fat/waist chart,
               EN/RU, dark/light, works offline-ish on a phone
Telegram bot   morning plan + menu, reminder before training,
               evening "did you train?", Saturday shopping list,
               Sunday weigh-in, /done /skip /weight /stats /pause
```

## Plug in your AI

The whole brain is one file: [`prompts/coach.md`](prompts/coach.md). Edit it to change how the coach thinks. `generate` sends it together with your `data/profile.json` to whichever provider you configure in `.env` (copy `.env.example`):

```
Provider        .env                         Default model
Claude          ANTHROPIC_API_KEY=...        claude-sonnet-5
ChatGPT         OPENAI_API_KEY=...           gpt-5
Gemini          GEMINI_API_KEY=...           gemini-2.5-flash
Local (Ollama)  COACH_PROVIDER=ollama        qwen2.5:14b
Any OpenAI-compatible endpoint (OpenRouter, LM Studio, vLLM): OPENAI_BASE_URL
Override the model: COACH_MODEL=...   or   --model ...
```

No API key at all? Run `node coach.mjs prompt`, paste `data/prompt.txt` into any chat window, save the answer to a file and run `node coach.mjs import answer.txt`. The answer is validated (7 days, sets and reps, menus, shopping list) and you get a clear list of problems if the model got something wrong. `generate` asks the model to fix its own mistakes once automatically.

Using Claude Code? Open the repo and say "be my coach": the bundled skill (`.claude/skills/coach`) interviews you and writes the files itself, no key needed. Edited the files by hand? `node coach.mjs check` validates them.

## Put it online

```bash
node coach.mjs build                                         # static site in dist/
npx wrangler pages deploy dist --project-name my-coach       # Cloudflare Pages, free
```

`dist/` is plain HTML, CSS, JS and JSON, so GitHub Pages, Netlify, Vercel or any shared hosting works too. The build publishes only your first name and language from the questionnaire, never your weight, injuries or diet. If you want the page private, put it behind Cloudflare Access (free for small teams) or your host's password protection.

Your log (sets, weights, measurements, shopping ticks) is stored in the browser's localStorage. Use **More → Export JSON** for backups or to move to another phone.

## Telegram bot (optional)

1. Create a bot with [@BotFather](https://t.me/BotFather), put `BOT_TOKEN` into `.env`.
2. Optionally set `ALLOWED_USERS=your_username` (otherwise the first person to send `/start` becomes the owner) and `TRACKER_URL` (your deployed site, adds an "Open tracker" button).
3. `node coach.mjs phrases` makes your AI write the bot's messages in your coach's personality (the default phrases are in `bot/phrases.en.json` and `bot/phrases.ru.json`).
4. `node coach.mjs bot`. It uses long polling, so it runs on a laptop, a Raspberry Pi or a $4 VPS without a public address. Keep it alive with `pm2 start coach.mjs -- bot` or a systemd unit.

Set `START_DATE` to the tracker start date so the bot counts the same weeks. Reminder times come from `schedule` in your profile and your timezone.

## Files

```
coach.mjs              CLI: init, generate, prompt, import, phrases, demo, serve, build, bot
prompts/coach.md       the coach's brain: method, safety rules, JSON format
prompts/bot-phrases.md personality of the Telegram bot
app/                   the tracker (index.html, app.js, style.css), no build step
bot/bot.mjs            Telegram bot, no dependencies
examples/demo*/        fictional demo profiles (EN and RU)
data/                  YOUR files, git-ignored: profile, program, meals, phrases
```

## Where this comes from

I built a tracker like this for myself in May 2026 and have trained with it every week since: six program versions, measurements from smart scales, temporary plans for the weeks when life got in the way. Then I set up the same kit for a second person in one day: program, meal plan from the nearest Lidl, tracker and a bot with a sense of humour. This repo is that kit with everything personal moved into data files, so anyone can repeat it.

## Important

This is not medical advice. AI-written plans can be wrong. Start lighter than you think, stop on sharp pain, and talk to a doctor first if you have a heart condition, high blood pressure, are pregnant, have or had an eating disorder, or any serious condition. The prompt tells the model to flag these, but it is not a substitute for a professional.

## License

MIT
