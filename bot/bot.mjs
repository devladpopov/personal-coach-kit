// Optional Telegram coach bot. Node 18+, no dependencies, long polling (no server or webhook needed).
// Reads data/profile.json, data/program.json, data/meals.json and the phrases file.
// Env: BOT_TOKEN (from @BotFather), ALLOWED_USERS (Telegram usernames or ids, comma separated;
// empty = the first person who sends /start becomes the owner), TRACKER_URL (your deployed site, optional).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
if (fs.existsSync(path.join(ROOT, '.env'))) {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('BOT_TOKEN is not set (.env or environment). Create a bot with @BotFather.'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}/`;
const TRACKER = process.env.TRACKER_URL || '';
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const PROFILE = read('profile.json'), PROGRAM = read('program.json'), MEALS = read('meals.json');
const LANG = PROFILE.language === 'ru' ? 'ru' : 'en';
const phrasesFile = fs.existsSync(path.join(DATA, 'phrases.json')) ? path.join(DATA, 'phrases.json') : path.join(ROOT, 'bot', `phrases.${LANG}.json`);
const PH = JSON.parse(fs.readFileSync(phrasesFile, 'utf8'));
const TZ = PROFILE.timezone || 'UTC';
const SCHED = Object.assign({ wake: '07:00', workout: '18:30', sleep: '23:00' }, PROFILE.schedule);
const ALLOWED = (process.env.ALLOWED_USERS || '').toLowerCase().split(',').map(s => s.trim().replace(/^@/, '')).filter(Boolean);

// ---------- storage ----------
const DB_FILE = path.join(DATA, 'bot-state.json');
let db = { offset: 0, chats: [], sent: {}, done: {}, skipped: {}, weights: [], pauseUntil: null, start: null, lastPick: {} };
try { Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) {}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));

// ---------- time in the user's timezone ----------
function now() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1 };
}
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const utc = s => { const [a, b, c] = s.split('-').map(Number); return Date.UTC(a, b - 1, c); };
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const addDays = (s, n) => new Date(utc(s) + n * 86400000).toISOString().slice(0, 10);
if (!db.start) { const n = now(); db.start = addDays(n.date, 1 - n.dow); saveDb(); }
const weekNo = d => Math.floor(daysBetween(db.start, d) / 7) + 1;
const planFor = dow => PROGRAM.days.find(d => d.dow === dow) || { rest: true, name: 'Rest' };
function menuFor(date) {
  const W = MEALS.weeks[(Math.max(weekNo(date), 1) - 1) % MEALS.weeks.length];
  return { week: W, menu: W.menus[Math.max(daysBetween(db.start, date), 0) % W.menus.length] };
}
function streak(today) {
  let n = 0;
  for (let d = addDays(today, -1), i = 0; i < 120; i++, d = addDays(d, -1)) {
    const dw = ((new Date(utc(d)).getUTCDay() + 6) % 7) + 1;
    if (planFor(dw).rest) continue;
    if (db.done[d]) n++; else break;
  }
  return n + (db.done[today] ? 1 : 0);
}

// ---------- texts ----------
function pick(key) {
  const arr = PH[key] || ['']; let i, tries = 0;
  do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === db.lastPick[key] && ++tries < 5);
  db.lastPick[key] = i; return arr[i];
}
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
function vars(date) {
  const n = now(), plan = planFor(n.dow);
  return { name: PROFILE.name || '', workout: plan.name, week: weekNo(date), weeks: PROGRAM.weeks, streak: streak(date), kcal: MEALS.targets.kcal, protein: MEALS.targets.protein, time: SCHED.workout };
}
const L = LANG === 'ru'
  ? { today: 'Сегодня', menu: 'Меню', done: 'Сделал', skip: 'Сегодня пропускаю', open: 'Открыть трекер', week: 'неделя', streak: 'серия', paused: 'Пауза до', help: 'Команды: /today /food /shop /done /skip /weight 82.4 /stats /pause 3 /resume', saved: 'Записал', rest: 'Отдых', total: 'Итого' }
  : { today: 'Today', menu: 'Menu', done: 'Done', skip: 'Skipping today', open: 'Open tracker', week: 'week', streak: 'streak', paused: 'Paused until', help: 'Commands: /today /food /shop /done /skip /weight 82.4 /stats /pause 3 /resume', saved: 'Saved', rest: 'Rest', total: 'Total' };

function todayText(date) {
  const n = now(), plan = planFor(n.dow);
  if (plan.rest) return `${L.today}: ${plan.name}. ${plan.note || ''}`;
  return `${L.today}: ${plan.name} (${plan.focus || ''})\n` + plan.exercises.map(e => e.type === 'interval' ? `• ${e.name}: ${e.rounds} × ${e.work}/${e.rest}s` : `• ${e.name}: ${e.sets}×${e.reps}${e.load ? ', ' + e.load : ''}`).join('\n');
}
function foodText(date) {
  const { week, menu } = menuFor(date);
  return `${L.menu} (${week.name}, ${menu.name}):\n` + menu.meals.map(m => `• ${m.slot}: ${m.title} (${m.kcal} kcal, ${m.protein} g)`).join('\n');
}
function shopText(date) {
  const { week } = menuFor(date), c = MEALS.currency || '';
  const total = week.shopping.reduce((a, x) => a + x.price * (x.qty || 1), 0);
  return `${MEALS.store}, ${week.name}:\n` + week.shopping.map(x => `• ${x.item}${x.qty > 1 ? ' × ' + x.qty : ''}`).join('\n') + `\n${L.total}: ${c}${total.toFixed(2)}`;
}

// ---------- telegram ----------
async function tg(method, body) {
  try {
    const r = await fetch(API + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch (e) { console.error(method, e.message); return {}; }
}
const kbTracker = TRACKER ? { inline_keyboard: [[{ text: L.open, url: TRACKER }]] } : undefined;
const kbCheck = { inline_keyboard: [[{ text: L.done, callback_data: 'done' }, { text: L.skip, callback_data: 'skip' }]] };
async function sendAll(text, kb) { for (const id of db.chats) await tg('sendMessage', { chat_id: id, text, reply_markup: kb }); }

// ---------- schedule ----------
// Each slot fires once per day inside a 30-minute window, so a restart does not spam.
const SLOTS = [
  { key: 'morning', at: () => toMin(SCHED.wake) + 15, when: () => true, text: d => fill(pick(planFor(now().dow).rest ? 'morning_rest' : 'morning_train'), vars(d)) + '\n\n' + foodText(d), kb: () => kbTracker },
  { key: 'workout', at: () => toMin(SCHED.workout) - 30, when: d => !planFor(now().dow).rest && !db.done[d], text: d => fill(pick('workout'), vars(d)) + '\n\n' + todayText(d), kb: () => kbTracker },
  { key: 'check', at: () => toMin(SCHED.workout) + 150, when: d => !planFor(now().dow).rest && !db.done[d] && !db.skipped[d], text: d => fill(pick('check'), vars(d)), kb: () => kbCheck },
  { key: 'shop', at: () => toMin(SCHED.wake) + 120, when: () => now().dow === 6, text: d => fill(pick('shop'), vars(d)) + '\n\n' + shopText(addDays(d, 2)), kb: () => undefined },
  { key: 'weigh', at: () => toMin(SCHED.wake) + 5, when: () => now().dow === 7, text: d => fill(pick('weigh'), vars(d)), kb: () => undefined }
];
async function tick() {
  const n = now();
  if (db.pauseUntil && n.date <= db.pauseUntil) return;
  for (const s of SLOTS) {
    const id = `${n.date}:${s.key}`, at = s.at();
    if (db.sent[id] || n.min < at || n.min > at + 30 || !s.when(n.date)) continue;
    db.sent[id] = 1; saveDb();
    await sendAll(s.text(n.date), s.kb());
  }
  for (const k of Object.keys(db.sent)) if (k.slice(0, 10) < addDays(n.date, -7)) delete db.sent[k];
}

// ---------- incoming ----------
const allowed = u => !ALLOWED.length ? (!db.chats.length || db.owner === u.id) : (ALLOWED.includes(String(u.id)) || ALLOWED.includes((u.username || '').toLowerCase()));
async function markDone(chat, date) { db.done[date] = 1; delete db.skipped[date]; saveDb(); await tg('sendMessage', { chat_id: chat, text: fill(pick('done'), vars(date)) }); }
async function markSkip(chat, date) { db.skipped[date] = 1; saveDb(); await tg('sendMessage', { chat_id: chat, text: fill(pick('skipped'), vars(date)) }); }

async function onMessage(m) {
  if (!m.text || !m.from) return;
  if (!allowed(m.from)) return tg('sendMessage', { chat_id: m.chat.id, text: 'Private coach bot.' });
  const d = now().date, [cmd, arg] = m.text.trim().split(/\s+/);
  const reply = (text, kb) => tg('sendMessage', { chat_id: m.chat.id, text, reply_markup: kb });
  switch (cmd.split('@')[0]) {
    case '/start':
      if (!db.chats.includes(m.chat.id)) db.chats.push(m.chat.id);
      if (!ALLOWED.length && !db.owner) db.owner = m.from.id;
      saveDb(); return reply(fill(pick('hello'), vars(d)) + '\n\n' + L.help, kbTracker);
    case '/today': return reply(todayText(d), kbTracker);
    case '/food': return reply(foodText(d));
    case '/shop': return reply(shopText(d));
    case '/done': return markDone(m.chat.id, d);
    case '/skip': return markSkip(m.chat.id, d);
    case '/weight': {
      const w = parseFloat(String(arg || '').replace(',', '.'));
      if (!(w > 20 && w < 400)) return reply('/weight 82.4');
      db.weights = db.weights.filter(x => x.date !== d).concat({ date: d, weight: w }); saveDb();
      const first = db.weights[0].weight, delta = w - first;
      return reply(`${L.saved}: ${w} kg (${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg)`);
    }
    case '/stats': {
      const total = Object.keys(db.done).length;
      return reply(`${L.week} ${weekNo(d)}/${PROGRAM.weeks}\n${L.done}: ${total}\n${L.streak}: ${streak(d)}${db.weights.length ? `\n${db.weights[db.weights.length - 1].weight} kg` : ''}`);
    }
    case '/pause': { const n = Math.min(Math.max(parseInt(arg) || 1, 1), 30); db.pauseUntil = addDays(d, n - 1); saveDb(); return reply(`${L.paused} ${db.pauseUntil}`); }
    case '/resume': db.pauseUntil = null; saveDb(); return reply('OK');
    default: return reply(L.help);
  }
}
async function onCallback(q) {
  if (!allowed(q.from)) return;
  const d = now().date;
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  if (q.data === 'done') await markDone(q.message.chat.id, d);
  if (q.data === 'skip') await markSkip(q.message.chat.id, d);
}

async function poll() {
  for (;;) {
    const r = await tg('getUpdates', { offset: db.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
    for (const u of r.result || []) {
      db.offset = u.update_id + 1; saveDb();
      try { if (u.message) await onMessage(u.message); if (u.callback_query) await onCallback(u.callback_query); } catch (e) { console.error(e); }
    }
    if (!r.ok) await new Promise(res => setTimeout(res, 5000));
  }
}

const me = await tg('getMe', {});
if (!me.ok) { console.error('Telegram rejected BOT_TOKEN:', me.description); process.exit(1); }
console.log(`@${me.result.username} is running. Timezone ${TZ}. Send /start to the bot.`);
setInterval(() => tick().catch(e => console.error(e)), 60000); tick();
poll();
