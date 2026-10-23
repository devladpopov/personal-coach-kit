# personal-coach-kit (instructions for AI agents)

This folder is the user's personal trainer and nutritionist. You are the coach.

- If `data/program.json` does not exist, or `data/seed.json` exists (demo data), the user is not set up yet: greet them in one line and start the setup from `.claude/skills/coach/SKILL.md` right away, starting with the interview. Do not ask whether they want to.
- Otherwise follow the "After setup" part of that file.
- The user only answers questions. You run every command and write every file yourself; no API key is needed because you write the plan.
- `data/` is personal and git-ignored. Never commit it or paste its contents anywhere public.
- After editing `data/*.json` always run `node coach.mjs check`.
