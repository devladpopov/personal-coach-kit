#!/usr/bin/env node
// personal-coach-kit CLI. Node 18+, no dependencies.
//   node coach.mjs init        questionnaire -> data/profile.json
//   node coach.mjs generate    profile + prompts/coach.md -> your AI -> data/program.json, data/meals.json
//   node coach.mjs prompt      write the full prompt to data/prompt.txt (paste it into any chat)
//   node coach.mjs import F    take the AI answer saved in file F and split it into data/*.json
//   node coach.mjs check       validate data/profile.json, data/program.json, data/meals.json (after you or an agent edit them)
//   node coach.mjs demo        load the fictional demo profile into data/
//   node coach.mjs serve       open the tracker on http://localhost:8080
//   node coach.mjs build       static site in dist/ (Cloudflare Pages, GitHub Pages, any hosting)
//   node coach.mjs phrases     ask your AI for bot messages in your coach's personality -> data/phrases.json
//   node coach.mjs bot         run the optional Telegram bot
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import os from 'node:os';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const p = (...a) => path.join(ROOT, ...a);
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const die = m => { console.error('\n' + m); process.exit(1); };

// .env without dependencies
if (fs.existsSync(p('.env'))) {
  for (const line of fs.readFileSync(p('.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------- init: questionnaire ----------------
const Q = {
  en: [
    ['name', 'What should the coach call you?'],
    ['sex', 'Sex (male / female)'],
    ['age', 'Age', 'num'],
    ['height_cm', 'Height, cm', 'num'],
    ['weight_kg', 'Weight, kg', 'num'],
    ['body_fat_pct', 'Body fat % if you know it (Enter to skip)', 'num?'],
    ['goal', 'Your goal in your own words (e.g. "lose 6 kg of fat, see abs by summer")'],
    ['goal_type', 'Goal type: fat_loss / recomp / muscle / strength / health', null, 'recomp'],
    ['experience', 'Training experience (e.g. "never", "gym 2 years ago")'],
    ['training_days', 'Training days, Monday = 1 (e.g. 1,3,5) or just a number of days', 'days', '1,3,5'],
    ['session_minutes', 'Minutes per session', 'num', '45'],
    ['equipment', 'Equipment you have, comma separated (e.g. dumbbells 2-20 kg, pull-up bar, gym membership)', 'list'],
    ['injuries', 'Injuries, pain, limitations (Enter if none)', null, ''],
    ['activity', 'Daily activity (desk job, steps, sports)'],
    ['diet', 'Food preferences and dislikes (vegetarian, no fish, ...)', null, 'eats everything'],
    ['allergies', 'Allergies or intolerances (Enter if none)', null, ''],
    ['meals_per_day', 'Meals per day', 'num', '4'],
    ['store', 'The store you actually shop at (e.g. Lidl, Tesco, Walmart, Pyaterochka)'],
    ['budget_week', 'Food budget per week (number)', 'num'],
    ['currency', 'Currency symbol', null, '£'],
    ['wake', 'Wake-up time (HH:MM)', null, '07:00'],
    ['workout', 'Usual workout time (HH:MM)', null, '18:30'],
    ['sleep', 'Bedtime (HH:MM)', null, '23:00'],
    ['coach_tone', 'Coach personality (e.g. "strict drill sergeant", "kind and funny")', null, 'friendly, a little sarcastic, never shaming'],
    ['weeks', 'Program length in weeks', 'num', '8']
  ],
  ru: [
    ['name', 'Как к вам обращаться?'],
    ['sex', 'Пол (male / female)'],
    ['age', 'Возраст', 'num'],
    ['height_cm', 'Рост, см', 'num'],
    ['weight_kg', 'Вес, кг', 'num'],
    ['body_fat_pct', 'Процент жира, если знаете (Enter, чтобы пропустить)', 'num?'],
    ['goal', 'Цель своими словами (например, «минус 6 кг жира, пресс к лету»)'],
    ['goal_type', 'Тип цели: fat_loss / recomp / muscle / strength / health', null, 'recomp'],
    ['experience', 'Опыт тренировок (например, «никогда», «ходил в зал 2 года назад»)'],
    ['training_days', 'Дни тренировок, понедельник = 1 (например, 1,3,5) или просто число дней', 'days', '1,3,5'],
    ['session_minutes', 'Минут на тренировку', 'num', '45'],
    ['equipment', 'Инвентарь через запятую (гантели 2-20 кг, турник, абонемент в зал)', 'list'],
    ['injuries', 'Травмы, боли, ограничения (Enter, если нет)', null, ''],
    ['activity', 'Активность в течение дня (сидячая работа, шаги, спорт)'],
    ['diet', 'Предпочтения в еде (вегетарианец, не ем рыбу, ...)', null, 'ем всё'],
    ['allergies', 'Аллергии и непереносимости (Enter, если нет)', null, ''],
    ['meals_per_day', 'Приёмов пищи в день', 'num', '4'],
    ['store', 'Магазин, где вы реально покупаете продукты (Пятёрочка, ВкусВилл, Lidl, ...)'],
    ['budget_week', 'Бюджет на еду в неделю (число)', 'num'],
    ['currency', 'Символ валюты', null, '₽'],
    ['wake', 'Во сколько встаёте (ЧЧ:ММ)', null, '07:00'],
    ['workout', 'Обычное время тренировки (ЧЧ:ММ)', null, '18:30'],
    ['sleep', 'Во сколько ложитесь (ЧЧ:ММ)', null, '23:00'],
    ['coach_tone', 'Характер тренера (например, «строгий сержант», «добрый и с юмором»)', null, 'дружелюбный, с лёгким сарказмом, без унижений'],
    ['weeks', 'Длина программы в неделях', 'num', '8']
  ]
};

async function init() {
  // Piped answers (node coach.mjs init < answers.txt) are read up front: readline drops lines that arrive before a question.
  let rl;
  if (process.stdin.isTTY) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  else {
    const lines = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    rl = { question: async q => { const a = lines.length ? lines.shift() : ''; process.stdout.write(q + a + '\n'); return a; }, close() {} };
  }
  const file = path.join(DATA, 'profile.json');
  if (fs.existsSync(file)) {
    const a = (await rl.question('data/profile.json exists. Overwrite? (y/N) ')).trim().toLowerCase();
    if (a !== 'y' && a !== 'д') { rl.close(); return; }
  }
  let language = (await rl.question('Language / Язык (en, ru) [en]: ')).trim().toLowerCase() || 'en';
  if (!Q[language]) language = 'en';
  const prof = { language };
  for (const [key, q, kind, def] of Q[language]) {
    let v;
    for (;;) {
      v = (await rl.question(`${q}${def !== undefined && def !== '' ? ` [${def}]` : ''}: `)).trim();
      if (!v && def !== undefined) v = def;
      if (kind === 'num?' && !v) { v = null; break; }
      if ((kind === 'num' || kind === 'num?') && isNaN(parseFloat(v.replace(',', '.')))) { console.log('  -> number please'); continue; }
      if (!v && def === undefined) { console.log('  -> required'); continue; }
      break;
    }
    if (kind === 'num' || kind === 'num?') v = v === null ? null : parseFloat(String(v).replace(',', '.'));
    if (kind === 'list') v = v.split(',').map(s => s.trim()).filter(Boolean);
    if (kind === 'days') {
      const n = v.split(/[ ,]+/).map(Number).filter(x => x >= 1 && x <= 7);
      v = n.length === 1 && !v.includes(',') ? { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] }[n[0]] : n;
    }
    prof[key] = v;
  }
  rl.close();
  prof.schedule = { wake: prof.wake, workout: prof.workout, sleep: prof.sleep };
  prof.program = { weeks: prof.weeks };
  delete prof.wake; delete prof.workout; delete prof.sleep; delete prof.weeks;
  prof.units = 'metric';
  prof.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  writeJSON(file, prof);
  console.log(`\nSaved ${path.relative(ROOT, file)}.\nNext: node coach.mjs generate   (or: node coach.mjs prompt, to paste it into any chat)`);
}

// ---------------- prompt + AI providers ----------------
function buildPrompt() {
  const f = path.join(DATA, 'profile.json');
  if (!fs.existsSync(f)) die('No data/profile.json. Run: node coach.mjs init');
  return fs.readFileSync(p('prompts', 'coach.md'), 'utf8') + '\n```json\n' + fs.readFileSync(f, 'utf8') + '\n```\n';
}

const PROVIDERS = {
  anthropic: {
    key: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-5',
    async call(prompt, model) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] })
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error || j));
      return j.content.filter(c => c.type === 'text').map(c => c.text).join('');
    }
  },
  openai: {
    key: 'OPENAI_API_KEY', model: 'gpt-5',
    async call(prompt, model) {
      const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error || j));
      return j.choices[0].message.content;
    }
  },
  gemini: {
    key: 'GEMINI_API_KEY', model: 'gemini-2.5-flash',
    async call(prompt, model) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16000 } })
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error || j));
      return j.candidates[0].content.parts.map(x => x.text).join('');
    }
  },
  ollama: {
    key: null, model: 'qwen2.5:14b',
    async call(prompt, model) {
      const r = await fetch((process.env.OLLAMA_HOST || 'http://localhost:11434') + '/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, format: 'json', options: { num_ctx: 16384 } })
      });
      const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j));
      return j.message.content;
    }
  }
};

function pickProvider(args) {
  const name = args.provider || process.env.COACH_PROVIDER || Object.keys(PROVIDERS).find(k => PROVIDERS[k].key && process.env[PROVIDERS[k].key]);
  if (!name) die('No AI key found. Put one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY into .env,\nor use a local model: COACH_PROVIDER=ollama,\nor do it by hand: node coach.mjs prompt  ->  paste into any chat  ->  node coach.mjs import answer.txt');
  const pr = PROVIDERS[name]; if (!pr) die('Unknown provider ' + name + '. Use: ' + Object.keys(PROVIDERS).join(', '));
  if (pr.key && !process.env[pr.key]) die(`${pr.key} is not set`);
  return { name, pr, model: args.model || process.env.COACH_MODEL || pr.model };
}

// ---------------- parse + validate ----------------
function extractJSON(text) {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('no JSON object in the answer');
  return JSON.parse(s.slice(a, b + 1));
}

function validate(o) {
  const e = [];
  const pr = o.program, ml = o.meals;
  if (!pr) e.push('missing "program"');
  if (!ml) e.push('missing "meals"');
  if (pr) {
    if (!Array.isArray(pr.days) || pr.days.length !== 7) e.push('program.days must have 7 entries');
    else pr.days.forEach((d, i) => {
      if (d.dow !== i + 1) e.push(`program.days[${i}].dow must be ${i + 1}`);
      if (!d.rest) {
        if (!Array.isArray(d.exercises) || !d.exercises.length) e.push(`program.days[${i}] has no exercises`);
        else d.exercises.forEach((x, k) => {
          if (!x.name) e.push(`days[${i}].exercises[${k}] has no name`);
          if (x.type === 'interval') { if (!(x.work > 0 && x.rounds > 0)) e.push(`days[${i}].exercises[${k}] interval needs work and rounds`); }
          else if (!(x.sets > 0) || !x.reps) e.push(`days[${i}].exercises[${k}] needs sets and reps`);
        });
      }
    });
    if (!(pr.weeks > 0)) e.push('program.weeks must be a number');
  }
  if (ml) {
    if (!ml.targets || !ml.targets.kcal) e.push('meals.targets.kcal missing');
    if (!Array.isArray(ml.weeks) || !ml.weeks.length) e.push('meals.weeks is empty');
    else ml.weeks.forEach((w, i) => {
      if (!Array.isArray(w.menus) || !w.menus.length) e.push(`meals.weeks[${i}].menus is empty`);
      if (!Array.isArray(w.shopping)) e.push(`meals.weeks[${i}].shopping missing`);
    });
  }
  return e;
}

function saveResult(o) {
  writeJSON(path.join(DATA, 'program.json'), o.program);
  writeJSON(path.join(DATA, 'meals.json'), o.meals);
  const seed = path.join(DATA, 'seed.json'); if (fs.existsSync(seed)) fs.unlinkSync(seed);
  const prof = fs.existsSync(path.join(DATA, 'profile.json')) ? readJSON(path.join(DATA, 'profile.json')) : {};
  for (const w of o.meals.weeks) {
    const total = w.shopping.reduce((a, x) => a + (+x.price || 0) * (x.qty || 1), 0);
    if (prof.budget_week && total > prof.budget_week * 1.1) console.log(`Note: week ${w.name} shopping is ${total.toFixed(2)}, over your budget of ${prof.budget_week}. Run generate again or ask for cheaper swaps.`);
  }
  console.log(`Saved data/program.json (${o.program.title}) and data/meals.json (${o.meals.targets.kcal} kcal).\nNext: node coach.mjs serve`);
}

async function generate(args) {
  const prompt = buildPrompt();
  const { name, pr, model } = pickProvider(args);
  console.log(`Asking ${name} (${model}). This takes 1-3 minutes...`);
  let text = await pr.call(prompt, model);
  for (let attempt = 0; ; attempt++) {
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(path.join(DATA, 'last-answer.txt'), text);
    let o, errs;
    try { o = extractJSON(text); errs = validate(o); } catch (err) { errs = ['invalid JSON: ' + err.message]; }
    if (!errs.length) return saveResult(o);
    if (attempt >= 1) die('The answer did not pass validation:\n- ' + errs.join('\n- ') + '\nRaw answer: data/last-answer.txt');
    console.log('Fixing the answer: ' + errs.slice(0, 5).join('; '));
    text = await pr.call(prompt + '\n\nYour previous answer had these problems:\n- ' + errs.join('\n- ') + '\nReturn the corrected full JSON only.', model);
  }
}

async function phrases(args) {
  const prompt = buildPrompt().replace(fs.readFileSync(p('prompts', 'coach.md'), 'utf8'), fs.readFileSync(p('prompts', 'bot-phrases.md'), 'utf8'));
  const { name, pr, model } = pickProvider(args);
  console.log(`Asking ${name} (${model}) for bot phrases...`);
  const o = extractJSON(await pr.call(prompt, model));
  for (const k of ['hello', 'morning_train', 'morning_rest', 'workout', 'check', 'done', 'skipped', 'shop', 'weigh']) if (!Array.isArray(o[k]) || !o[k].length) die(`Answer has no "${k}" list, try again`);
  writeJSON(path.join(DATA, 'phrases.json'), o);
  console.log('Saved data/phrases.json. The bot will use it on the next start.');
}

// Validate the files in data/ in place: used by AI agents that write program.json and meals.json themselves.
const PROFILE_KEYS = ['language', 'name', 'sex', 'age', 'height_cm', 'weight_kg', 'goal', 'training_days', 'session_minutes', 'equipment', 'store', 'budget_week', 'currency'];
function check() {
  const f = n => path.join(DATA, n);
  const errs = [];
  if (!fs.existsSync(f('profile.json'))) errs.push('data/profile.json is missing');
  else {
    const prof = readJSON(f('profile.json'));
    for (const k of PROFILE_KEYS) if (prof[k] === undefined || prof[k] === '') errs.push(`profile.${k} is missing`);
    if (!prof.schedule || !prof.schedule.workout) errs.push('profile.schedule.workout is missing');
    if (!prof.program || !(prof.program.weeks > 0)) errs.push('profile.program.weeks is missing');
  }
  const o = {};
  for (const k of ['program', 'meals']) {
    if (!fs.existsSync(f(k + '.json'))) { errs.push(`data/${k}.json is missing`); continue; }
    try { o[k] = readJSON(f(k + '.json')); } catch (e) { errs.push(`data/${k}.json is not valid JSON: ${e.message}`); }
  }
  if (o.program && o.meals) errs.push(...validate(o));
  if (fs.existsSync(f('phrases.json'))) {
    try { const ph = readJSON(f('phrases.json')); for (const k of ['hello', 'morning_train', 'morning_rest', 'workout', 'check', 'done', 'skipped', 'shop', 'weigh']) if (!Array.isArray(ph[k]) || !ph[k].length) errs.push(`phrases.${k} must be a non-empty list`); }
    catch (e) { errs.push('data/phrases.json is not valid JSON: ' + e.message); }
  }
  if (errs.length) die('Problems:\n- ' + errs.join('\n- '));
  if (fs.existsSync(f('seed.json'))) console.log('Note: data/seed.json switches on demo data in the tracker. Delete it for a real profile.');
  const prof = readJSON(f('profile.json'));
  const train = o.program.days.filter(d => !d.rest).length;
  console.log(`OK: ${o.program.title}, ${o.program.weeks} weeks, ${train} training days; ${o.meals.targets.kcal} kcal, ${o.meals.targets.protein} g protein.`);
  for (const w of o.meals.weeks) {
    const total = w.shopping.reduce((a, x) => a + (+x.price || 0) * (x.qty || 1), 0);
    console.log(`Week ${w.name} shopping: ${total.toFixed(2)} ${prof.currency || ''}${prof.budget_week && total > prof.budget_week * 1.1 ? `  OVER BUDGET (${prof.budget_week})` : ''}`);
  }
}

function importAnswer(file) {
  if (!file) die('Usage: node coach.mjs import answer.txt');
  const o = extractJSON(fs.readFileSync(file, 'utf8'));
  const errs = validate(o);
  if (errs.length) die('Problems:\n- ' + errs.join('\n- ') + '\nAsk the AI to fix them and import again.');
  saveResult(o);
}

// ---------------- demo / serve / build ----------------
function demo(args) {
  const src = p('examples', args.ru ? 'demo-ru' : 'demo');
  for (const f of ['profile.json', 'program.json', 'meals.json']) fs.copyFileSync(path.join(src, f), path.join(DATA, f));
  writeJSON(path.join(DATA, 'seed.json'), { demo: true });
  console.log('Demo profile loaded into data/. Run: node coach.mjs serve');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve(args) {
  const port = +(args.port || process.env.PORT || 8080);
  http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const base = u.startsWith('/data/') ? ROOT : p('app');
    const f = path.normalize(path.join(base, u));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    if (u === '/data/profile.json') { res.writeHead(200, { 'content-type': MIME['.json'] }); return res.end(JSON.stringify(publicProfile(readJSON(f), fs.existsSync(path.join(DATA, 'seed.json'))))); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  }).listen(port, () => {
    console.log(`Tracker: http://localhost:${port}`);
    // Same Wi-Fi: open one of these on the phone while this computer is on.
    for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`Phone on the same Wi-Fi: http://${a.address}:${port}`);
  });
}

// The site is public: publish only what the page needs, never the full questionnaire.
function publicProfile(prof, isDemo) {
  const o = { name: prof.name, language: prof.language };
  if (isDemo) Object.assign(o, { weight_kg: prof.weight_kg, body_fat_pct: prof.body_fat_pct });
  return o;
}

function build(args) {
  const out = p(args.out || 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  for (const f of fs.readdirSync(p('app'))) fs.copyFileSync(p('app', f), path.join(out, f));
  const isDemo = fs.existsSync(path.join(DATA, 'seed.json'));
  for (const f of ['program.json', 'meals.json']) {
    if (!fs.existsSync(path.join(DATA, f))) die(`data/${f} is missing. Run: node coach.mjs generate (or: node coach.mjs demo)`);
    fs.copyFileSync(path.join(DATA, f), path.join(out, 'data', f));
  }
  if (fs.existsSync(path.join(DATA, 'profile.json'))) writeJSON(path.join(out, 'data', 'profile.json'), publicProfile(readJSON(path.join(DATA, 'profile.json')), isDemo));
  if (isDemo) fs.copyFileSync(path.join(DATA, 'seed.json'), path.join(out, 'data', 'seed.json'));
  console.log(`Built ${path.relative(ROOT, out)}/. Deploy it anywhere, for example:\n  npx wrangler pages deploy ${path.relative(ROOT, out)} --project-name my-coach`);
}

function bot() {
  const c = spawn(process.execPath, [p('bot', 'bot.mjs')], { stdio: 'inherit' });
  c.on('exit', code => process.exit(code ?? 0));
}

// ---------------- main ----------------
const [cmd, ...rest] = process.argv.slice(2);
const args = {}; const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); args[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; }
  else pos.push(rest[i]);
}
fs.mkdirSync(DATA, { recursive: true });
const cmds = {
  init, generate: () => generate(args), phrases: () => phrases(args), import: () => importAnswer(pos[0]), check, demo: () => demo(args),
  prompt: () => { const f = path.join(DATA, 'prompt.txt'); fs.writeFileSync(f, buildPrompt()); console.log(`Prompt saved to ${path.relative(ROOT, f)}. Paste it into Claude, ChatGPT, Gemini or a local model, save the answer to a file and run: node coach.mjs import <file>`); },
  serve: () => serve(args), build: () => build(args), bot
};
if (!cmds[cmd]) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 1 : 0);
}
Promise.resolve(cmds[cmd]()).catch(e => die(e.message));
