# Coach bot phrases prompt

Write reminder messages for a personal Telegram coach bot. The person's questionnaire (`profile.json`) is below. Use `coach_tone` as the bot's personality and `language` as the language. Use details from the profile (goal, habits, city, job, the store) to make the jokes personal, but never mock body weight or appearance, and never shame.

Return ONE JSON object and nothing else, with these keys. Every value is an array of short messages (1-2 sentences each):

- `hello` (2): first message after /start
- `morning_train` (8): morning of a training day
- `morning_rest` (5): morning of a rest day
- `workout` (6): 30 minutes before training
- `check` (4): evening question "did you train?"
- `done` (6): reaction to a finished workout
- `skipped` (4): reaction to a skipped workout, supportive
- `shop` (3): Saturday shopping reminder
- `weigh` (3): Sunday weigh-in reminder, must mention the command `/weight 82.4`

Placeholders you can use, they are replaced by the bot: `{name}`, `{workout}` (today's session name), `{time}` (workout time), `{week}`, `{weeks}`, `{streak}`, `{kcal}`, `{protein}`.

## Profile

