// personal-coach-kit tracker. Plain JS, no build step, no backend.
// Reads data/program.json, data/meals.json, data/profile.json; keeps your log in localStorage.
'use strict';

const I18N = {
  en: {
    today: 'Today', week: 'Week', food: 'Food', progress: 'Progress', more: 'More',
    weekN: 'Week', of: 'of', workouts: 'Workouts', thisWeek: 'This week', weight: 'Weight',
    restDay: 'Rest day', warmup: 'Warm-up', cooldown: 'Cool-down', sets: 'sets', rest: 'rest',
    reps: 'reps', kg: 'kg', last: 'Last time', showHow: 'Show me how', swap: 'Swap',
    finish: 'Finish workout', finished: 'Workout done', undo: 'Undo', mood: 'How was it?',
    moods: ['Hard', 'OK', 'Good', 'Great'], restTimer: 'Rest', nextSet: 'next: set',
    startInterval: 'Start interval timer', round: 'Round', work: 'Work', getReady: 'Get ready',
    pause: 'Pause', resume: 'Resume', stop: 'Stop', skip: 'Skip', done: 'Done',
    programOver: 'Program complete. Generate the next block with: node coach.mjs generate',
    beforeStart: 'Program starts on', phase: 'Phase', progression: 'Progression rule',
    targets: 'Daily targets', protein: 'protein', water: 'water', menu: 'Menu', shopping: 'Shopping list',
    total: 'Total', left: 'left to buy', supplements: 'Supplements', rules: 'Rules', weekLabel: 'Week',
    options: 'Swap for', original: 'back to plan', min: 'min', trip: 'Trip', dayTotal: 'Day total', where: 'where',
    auto: 'auto', addEntry: 'Add measurement', date: 'Date', fat: 'Fat %', waist: 'Waist cm', add: 'Add',
    history: 'Workout history', noHistory: 'No workouts logged yet.', startDate: 'Program start date',
    backup: 'Backup', exportBtn: 'Export JSON', importBtn: 'Import JSON', reset: 'Reset all data',
    resetQ: 'Delete all your logs on this device?', imported: 'Imported.', safety: 'Safety',
    about: 'Your data lives only in this browser. Export a backup now and then.', demo: 'Demo profile with sample data.',
    dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], noData: 'No program yet. Run: node coach.mjs init'
  },
  ru: {
    today: 'Сегодня', week: 'Неделя', food: 'Питание', progress: 'Прогресс', more: 'Ещё',
    weekN: 'Неделя', of: 'из', workouts: 'Тренировок', thisWeek: 'На неделе', weight: 'Вес',
    restDay: 'День отдыха', warmup: 'Разминка', cooldown: 'Заминка', sets: 'подх.', rest: 'отдых',
    reps: 'повт', kg: 'кг', last: 'В прошлый раз', showHow: 'Как делать', swap: 'Замена',
    finish: 'Завершить тренировку', finished: 'Тренировка сделана', undo: 'Отменить', mood: 'Как прошло?',
    moods: ['Тяжело', 'Норм', 'Хорошо', 'Отлично'], restTimer: 'Отдых', nextSet: 'дальше: подход',
    startInterval: 'Запустить интервальный таймер', round: 'Раунд', work: 'Работа', getReady: 'Готовься',
    pause: 'Пауза', resume: 'Дальше', stop: 'Стоп', skip: 'Пропустить', done: 'Готово',
    programOver: 'Программа пройдена. Следующий блок: node coach.mjs generate',
    beforeStart: 'Программа начнётся', phase: 'Фаза', progression: 'Правило прогрессии',
    targets: 'Цели на день', protein: 'белок', water: 'вода', menu: 'Меню', shopping: 'Список покупок',
    total: 'Итого', left: 'осталось купить', supplements: 'Добавки', rules: 'Правила', weekLabel: 'Неделя',
    options: 'Заменить на', original: 'вернуть как в плане', min: 'мин', trip: 'Поход', dayTotal: 'За день', where: 'где',
    auto: 'авто', addEntry: 'Добавить замер', date: 'Дата', fat: 'Жир %', waist: 'Талия, см', add: 'Добавить',
    history: 'История тренировок', noHistory: 'Пока нет записанных тренировок.', startDate: 'Дата старта программы',
    backup: 'Резервная копия', exportBtn: 'Скачать JSON', importBtn: 'Загрузить JSON', reset: 'Стереть все данные',
    resetQ: 'Удалить все записи на этом устройстве?', imported: 'Загружено.', safety: 'Безопасность',
    about: 'Данные хранятся только в этом браузере. Иногда делайте резервную копию.', demo: 'Демо-профиль с примером данных.',
    dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], noData: 'Программы пока нет. Запустите: node coach.mjs init'
  }
};

let P = null, M = null, PROFILE = {}, SEED = null, S = null, KEY = 'pck';
let lang = 'en';
const t = k => (I18N[lang] || I18N.en)[k] ?? I18N.en[k] ?? k;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- dates (local time, YYYY-MM-DD) ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const todayIso = () => iso(new Date());
const dow = s => ((parse(s).getDay() + 6) % 7) + 1; // 1 = Monday
const mondayOf = s => addDays(s, 1 - dow(s));
const fmtDate = s => parse(s).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// ---------- state ----------
function blankState() { return { v: 1, start: mondayOf(todayIso()), logs: {}, body: [], shop: {}, pick: {}, foodWeek: null, theme: null, lang: null }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v) return Object.assign(blankState(), s); } catch (e) {}
  return null;
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function logOf(date, create) {
  if (!S.logs[date] && create) S.logs[date] = { sets: {}, done: false };
  return S.logs[date];
}

const weekOf = date => Math.floor(diff(S.start, date) / 7) + 1;
const dayPlan = date => P.days.find(d => d.dow === dow(date)) || { rest: true, name: t('restDay') };
const phaseOf = w => (P.phases || []).find(p => w >= p.from && w <= p.to);
const trainingDows = () => P.days.filter(d => !d.rest).map(d => d.dow);
const numLoad = s => { const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*kg/i); return m ? m[1].replace(',', '.') : ''; };

function prevSets(date, name) {
  const dates = Object.keys(S.logs).filter(d => d < date).sort().reverse();
  for (const d of dates) {
    const plan = dayPlan(d);
    const i = (plan.exercises || []).findIndex(e => e.name === name);
    const sets = i >= 0 && S.logs[d].sets[i];
    if (sets && sets.some(x => x && x.done)) return { date: d, sets };
  }
  return null;
}

// ---------- demo data ----------
function demoState() {
  const s = blankState();
  const today = todayIso();
  s.start = addDays(mondayOf(today), -21); // week 4 today
  const rnd = (i, k) => ((i * 7919 + k * 104729) % 97) / 97;
  for (let d = s.start; d < today; d = addDays(d, 1)) {
    const plan = P.days.find(x => x.dow === dow(d));
    if (!plan || plan.rest) continue;
    const w = Math.floor(diff(s.start, d) / 7);
    if (w === 1 && dow(d) === 4) continue; // one missed session looks honest
    const log = { sets: {}, done: true, mood: 1 + Math.floor(rnd(diff(s.start, d), 3) * 3) };
    plan.exercises.forEach((e, i) => {
      if (e.type === 'interval') { log.sets[i] = [{ done: true }]; return; }
      const lo = parseInt(e.reps) || 10;
      const kg = numLoad(e.load);
      log.sets[i] = Array.from({ length: e.sets }, (_, k) => ({ done: true, reps: String(lo + Math.min(w, 3) - (k > 1 ? 1 : 0)), kg: kg }));
    });
    s.logs[d] = log;
  }
  const plan = P.days.find(x => x.dow === dow(today));
  if (plan && !plan.rest) {
    const e = plan.exercises[0];
    s.logs[today] = { sets: { 0: [{ done: true, reps: String((parseInt(e.reps) || 10) + 3), kg: numLoad(e.load) }, { done: true, reps: String((parseInt(e.reps) || 10) + 2), kg: numLoad(e.load) }] }, done: false };
  }
  const w0 = PROFILE.weight_kg || 84, f0 = PROFILE.body_fat_pct || 24;
  [0, 0.6, 1.1, 1.6].forEach((dw, i) => s.body.push({ date: addDays(s.start, i * 7 - 1), weight: +(w0 - dw).toFixed(1), fat: +(f0 - dw * 0.7).toFixed(1), waist: 94 - Math.round(dw * 1.2) }));
  s.body = s.body.filter(b => b.date <= today);
  s.shop = { [M.weeks[Math.floor(diff(s.start, today) / 7) % M.weeks.length].name]: { 0: true, 3: true, 7: true, 9: true } };
  return s;
}

// ---------- audio ----------
let actx = null;
function beep(freq = 880, ms = 150) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.25, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + ms / 1000);
    o.start(); o.stop(actx.currentTime + ms / 1000);
  } catch (e) {}
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ---------- rest timer ----------
let rest = { end: 0, id: null, label: '' };
function startRest(sec, label) {
  if (!sec) return;
  rest.end = Date.now() + sec * 1000; rest.label = label;
  $('#timer').classList.remove('hidden');
  clearInterval(rest.id); rest.id = setInterval(tickRest, 250); tickRest();
}
function tickRest() {
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  $('#timerLabel').textContent = rest.label;
  $('#timerTime').textContent = `${Math.floor(Math.max(left, 0) / 60)}:${pad(Math.max(left, 0) % 60)}`;
  if (left <= 3 && left > 0 && left !== rest.lastBeep) { rest.lastBeep = left; beep(660, 90); }
  if (left <= 0) { beep(990, 400); buzz([200, 100, 200]); stopRest(); }
}
function stopRest() { clearInterval(rest.id); $('#timer').classList.add('hidden'); }
document.querySelectorAll('#timer [data-t]').forEach(b => b.onclick = () => {
  const v = b.dataset.t;
  if (v === 'skip') return stopRest();
  rest.end += (v === '+15' ? 15 : -15) * 1000; tickRest();
});

// ---------- interval timer ----------
let iv = null;
function startInterval(ex, onDone) {
  const steps = [{ phase: 'ready', sec: 5 }];
  for (let r = 1; r <= ex.rounds; r++) {
    steps.push({ phase: 'work', sec: ex.work, r });
    if (r < ex.rounds && ex.rest) steps.push({ phase: 'rest', sec: ex.rest, r });
  }
  iv = { steps, i: 0, end: Date.now() + steps[0].sec * 1000, paused: 0, ex, onDone };
  $('#interval').classList.remove('hidden');
  iv.id = setInterval(tickInterval, 200); tickInterval();
}
function tickInterval() {
  if (!iv || iv.paused) return;
  let left = Math.ceil((iv.end - Date.now()) / 1000);
  if (left <= 0) {
    iv.i++;
    if (iv.i >= iv.steps.length) { beep(990, 600); buzz([300, 100, 300]); const cb = iv.onDone; stopInterval(); cb && cb(); return; }
    iv.end = Date.now() + iv.steps[iv.i].sec * 1000; left = iv.steps[iv.i].sec;
    beep(iv.steps[iv.i].phase === 'work' ? 990 : 520, 350); buzz(200);
  } else if (left <= 3 && left !== iv.lastBeep) { iv.lastBeep = left; beep(660, 80); }
  const st = iv.steps[iv.i];
  const el = $('#interval');
  el.classList.toggle('work', st.phase === 'work'); el.classList.toggle('rest', st.phase === 'rest');
  $('#ivRound').textContent = st.r ? `${t('round')} ${st.r} / ${iv.ex.rounds}` : iv.ex.name;
  $('#ivPhase').textContent = st.phase === 'work' ? t('work') : st.phase === 'rest' ? t('rest') : t('getReady');
  $('#ivTime').textContent = left;
}
function stopInterval() { if (iv) clearInterval(iv.id); iv = null; $('#interval').classList.add('hidden'); }
$('#ivStop').onclick = stopInterval;
$('#ivPause').onclick = () => {
  if (!iv) return;
  if (iv.paused) { iv.end = Date.now() + iv.paused; iv.paused = 0; $('#ivPause').textContent = t('pause'); }
  else { iv.paused = Math.max(iv.end - Date.now(), 1); $('#ivPause').textContent = t('resume'); }
};

// ---------- header and stats ----------
function renderHead() {
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = S.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  $('#langBtn').textContent = lang.toUpperCase();
  $('#title').textContent = PROFILE.name ? `${PROFILE.name} · ${P.title}` : P.title;
  document.title = P.title;
  const w = weekOf(todayIso()), ph = phaseOf(w);
  $('#subtitle').textContent = w < 1 ? `${t('beforeStart')} ${fmtDate(S.start)}` : w > P.weeks ? t('programOver') : `${t('weekN')} ${w} ${t('of')} ${P.weeks}${ph ? ' · ' + ph.name : ''}${SEED && SEED.demo ? ' · ' + t('demo') : ''}`;

  const done = Object.values(S.logs).filter(l => l.done).length;
  const ws = mondayOf(todayIso());
  let wk = 0; for (let i = 0; i < 7; i++) { const l = S.logs[addDays(ws, i)]; if (l && l.done) wk++; }
  const b = [...S.body].sort((a, c) => a.date < c.date ? -1 : 1);
  const dw = b.length > 1 ? (b[b.length - 1].weight - b[0].weight) : null;
  $('#stats').innerHTML = [
    [`${Math.min(Math.max(w, 0), P.weeks)}/${P.weeks}`, t('weekN')],
    [done, t('workouts')],
    [`${wk}/${trainingDows().length}`, t('thisWeek')],
    [dw === null ? (b.length ? b[0].weight : '–') : `${dw > 0 ? '+' : ''}${dw.toFixed(1)}`, `${t('weight')}${dw === null ? '' : ', ' + t('kg')}`]
  ].map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');

  const tabs = ['today', 'week', 'food', 'progress', 'more'];
  const cur = route().tab;
  $('#tabs').innerHTML = tabs.map(k => `<button class="tab ${cur === k ? 'active' : ''}" data-tab="${k}">${t(k)}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { location.hash = b.dataset.tab; });
}

function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('day=')) return { tab: 'today', date: h.slice(4) };
  return { tab: ['week', 'food', 'progress', 'more'].includes(h) ? h : 'today', date: todayIso() };
}

// ---------- day view ----------
function renderDay(date) {
  const plan = dayPlan(date), w = weekOf(date), ph = phaseOf(w);
  const log = logOf(date);
  let h = `<div class="card"><div class="weeknav"><button data-go="-1">‹</button><div style="text-align:center"><b>${esc(fmtDate(date))}</b><div class="muted">${t('weekN')} ${w}</div></div><button data-go="1">›</button></div>`;
  if (ph) h += `<span class="phase">${esc(ph.name)}</span> `;
  h += `<h2>${esc(plan.name)}</h2>`;
  if (plan.focus) h += `<div class="muted">${esc(plan.focus)}</div>`;
  if (plan.rest) { h += `<p class="muted" style="margin-top:8px">${esc(plan.note || t('restDay'))}</p></div>`; return h; }
  if (log && log.done) h += `<div class="done-banner" style="margin-top:10px">${t('finished')}</div>`;
  if (plan.warmup && plan.warmup.length) h += `<details style="margin-top:10px"><summary>${t('warmup')}</summary><ul class="plain">${plan.warmup.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
  h += `</div><div class="card">`;
  plan.exercises.forEach((e, i) => {
    const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + ' exercise form')}`;
    if (e.type === 'interval') {
      const ok = log && log.sets[i] && log.sets[i][0] && log.sets[i][0].done;
      h += `<div class="ex"><div class="ex-head"><span class="ex-name">${esc(e.name)}</span><span class="ex-meta">${e.rounds} × ${e.work}s / ${e.rest}s</span></div>
        <div class="ex-how">${esc(e.how)} <a href="${yt}" target="_blank" rel="noopener">${t('showHow')}</a></div>
        <div class="row"><button class="btn" data-iv="${i}">${t('startInterval')}</button><button class="chk ${ok ? 'on' : ''}" data-ivdone="${i}">✓</button></div></div>`;
      return;
    }
    const prev = prevSets(date, e.name);
    const cur = (log && log.sets[i]) || [];
    h += `<div class="ex"><div class="ex-head"><span class="ex-name">${esc(e.name)}</span><span class="ex-meta">${e.sets} × ${esc(e.reps)}${e.load ? ' · ' + esc(e.load) : ''}${e.rest ? ' · ' + e.rest + 's' : ''}</span></div>
      <div class="ex-how">${esc(e.how)}${e.tempo ? ` Tempo ${esc(e.tempo)}.` : ''}${e.swap ? ` ${t('swap')}: ${esc(e.swap)}.` : ''} <a href="${yt}" target="_blank" rel="noopener">${t('showHow')}</a></div>`;
    if (prev) h += `<div class="prev">${t('last')} (${esc(fmtDate(prev.date))}): ${prev.sets.filter(x => x && x.done).map(x => `${x.reps || '?'}${x.kg ? '×' + x.kg : ''}`).join(', ')}</div>`;
    h += `<div class="sets">`;
    for (let k = 0; k < e.sets; k++) {
      const c = cur[k] || {}, p = prev && prev.sets[k];
      h += `<div class="set"><span class="n">${k + 1}</span>
        <input inputmode="numeric" data-ex="${i}" data-k="${k}" data-f="reps" placeholder="${esc((p && p.reps) || e.reps)} ${t('reps')}" value="${esc(c.reps || '')}">
        <input inputmode="decimal" data-ex="${i}" data-k="${k}" data-f="kg" placeholder="${esc((p && p.kg) || numLoad(e.load) || '–')} ${t('kg')}" value="${esc(c.kg || '')}">
        <button class="chk ${c.done ? 'on' : ''}" data-ex="${i}" data-k="${k}" data-done="1">✓</button></div>`;
    }
    h += `</div></div>`;
  });
  h += `</div>`;
  if (plan.cooldown && plan.cooldown.length) h += `<div class="card"><details><summary>${t('cooldown')}</summary><ul class="plain">${plan.cooldown.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details></div>`;
  h += `<div class="card">`;
  if (log && log.done) h += `<div class="muted">${t('mood')}</div><div class="moods">${t('moods').map((m, i) => `<button data-mood="${i}" class="${log.mood === i ? 'on' : ''}">${esc(m)}</button>`).join('')}</div><button class="btn ghost wide" data-finish="0">${t('undo')}</button>`;
  else h += `<button class="btn wide" data-finish="1">${t('finish')}</button>`;
  h += `</div>`;
  return h;
}

function bindDay(date) {
  const plan = dayPlan(date);
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = 'day=' + addDays(date, +b.dataset.go); });
  document.querySelectorAll('input[data-ex]').forEach(inp => inp.onchange = () => {
    const log = logOf(date, true), i = inp.dataset.ex, k = +inp.dataset.k;
    log.sets[i] = log.sets[i] || []; log.sets[i][k] = log.sets[i][k] || {};
    log.sets[i][k][inp.dataset.f] = inp.value.trim(); save();
  });
  document.querySelectorAll('button[data-done]').forEach(b => b.onclick = () => {
    const log = logOf(date, true), i = b.dataset.ex, k = +b.dataset.k, e = plan.exercises[i];
    log.sets[i] = log.sets[i] || []; const s = log.sets[i][k] = log.sets[i][k] || {};
    const row = b.closest('.set');
    row.querySelectorAll('input').forEach(inp => { if (!inp.value) { const v = inp.placeholder.split(' ')[0].replace('–', ''); inp.value = inp.dataset.f === 'reps' ? String(parseInt(v) || '') : v; } s[inp.dataset.f] = inp.value; });
    s.done = !s.done; save();
    b.classList.toggle('on', s.done);
    if (s.done) startRest(e.rest, k + 1 < e.sets ? `${t('restTimer')} · ${t('nextSet')} ${k + 2}` : `${t('restTimer')} · ${(plan.exercises[+i + 1] || {}).name || t('done')}`);
    renderHead();
  });
  document.querySelectorAll('[data-iv]').forEach(b => b.onclick = () => {
    const i = b.dataset.iv;
    startInterval(plan.exercises[i], () => { const log = logOf(date, true); log.sets[i] = [{ done: true }]; save(); render(); });
  });
  document.querySelectorAll('[data-ivdone]').forEach(b => b.onclick = () => {
    const log = logOf(date, true), i = b.dataset.ivdone, on = !(log.sets[i] && log.sets[i][0] && log.sets[i][0].done);
    log.sets[i] = [{ done: on }]; save(); render();
  });
  document.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => {
    const log = logOf(date, true); log.done = b.dataset.finish === '1'; if (log.done) { beep(990, 200); setTimeout(() => beep(1320, 300), 220); } save(); render();
  });
  document.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { logOf(date, true).mood = +b.dataset.mood; save(); render(); });
}

// ---------- week view ----------
let weekShown = null;
function renderWeek() {
  const today = todayIso();
  if (weekShown === null) weekShown = Math.min(Math.max(weekOf(today), 1), P.weeks);
  const ws = addDays(S.start, (weekShown - 1) * 7), ph = phaseOf(weekShown);
  let h = `<div class="card"><div class="weeknav"><button data-w="-1">‹</button><b>${t('weekLabel')} ${weekShown} / ${P.weeks}</b><button data-w="1">›</button></div><div class="week">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), plan = dayPlan(d), l = S.logs[d];
    h += `<button class="wd ${d === today ? 'today' : ''} ${l && l.done ? 'done' : ''} ${plan.rest ? 'rest' : ''}" data-day="${d}"><span>${t('dayNames')[i]}</span><b>${parse(d).getDate()}</b><div class="dname">${esc(plan.name)}</div></button>`;
  }
  h += `</div></div>`;
  if (ph) h += `<div class="card"><span class="phase">${t('phase')}: ${esc(ph.name)}</span><p class="muted">${esc(ph.note)}</p></div>`;
  h += `<div class="card"><h2>${esc(P.title)}</h2><p class="muted">${esc(P.summary)}</p><h3>${t('progression')}</h3><p class="muted">${esc(P.progression)}</p>`;
  if (P.safety && P.safety.length) h += `<h3>${t('safety')}</h3><ul class="plain">${P.safety.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  h += `</div>`;
  return h;
}
function bindWeek() {
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { weekShown = Math.min(Math.max(weekShown + +b.dataset.w, 1), P.weeks); render(); });
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { location.hash = 'day=' + b.dataset.day; });
}

// ---------- food view ----------
// Meal plan: each week has a pool of recipes per slot and 7 days that pick one recipe per slot.
// Any meal can be swapped for another recipe of the same slot (same shopping list). Old "menus" files are converted.
function normMeals(m) {
  for (const w of m.weeks) {
    if (w.recipes) continue;
    w.recipes = []; w.days = [];
    w.menus.forEach((mn, i) => w.days.push({ name: mn.name, meals: mn.meals.map((x, k) => { const id = `m${i}-${k}`; w.recipes.push({ ...x, id }); return id; }) }));
  }
  return m;
}
let dayShown = null;
function foodWeekIdx() {
  if (S.foodWeek !== null && S.foodWeek !== undefined) return S.foodWeek;
  return (Math.max(weekOf(todayIso()), 1) - 1) % M.weeks.length;
}
const todayFoodIdx = W => W.days.length === 7 && W.days[0].dow ? dow(todayIso()) - 1 : Math.max(diff(S.start, todayIso()), 0) % W.days.length;
const pickKey = (W, di, k) => `${W.name}:${di}:${k}`;
function dayMeals(W, di) {
  const byId = Object.fromEntries(W.recipes.map(r => [r.id, r]));
  return W.days[di].meals.map((id, k) => { const chosen = (S.pick || {})[pickKey(W, di, k)]; return { k, plan: byId[id], r: byId[chosen] || byId[id] }; }).filter(x => x.r);
}
function slotTime(slot) { const s = (M.slots || []).find(x => x.name === slot); return s && s.time; }
function renderFood() {
  const wi = foodWeekIdx(), W = M.weeks[wi], cur = M.currency || '';
  if (dayShown === null || dayShown >= W.days.length) dayShown = todayFoodIdx(W);
  const tg = M.targets || {};
  let h = `<div class="card"><h2>${t('targets')}</h2><div class="muted">${tg.kcal} kcal · ${tg.protein} g ${t('protein')} · F ${tg.fat} g · C ${tg.carbs} g · ${t('water')} ${tg.water_l} L</div></div>`;
  h += `<div class="card"><div class="weeknav"><div class="seg">${M.weeks.map((x, i) => `<button data-fw="${i}" class="${i === wi ? 'on' : ''}">${t('weekLabel')} ${esc(x.name)}</button>`).join('')}<button data-fw="auto" class="${S.foodWeek === null ? 'on' : ''}">${t('auto')}</button></div></div>`;
  const dname = (d, i) => d.dow ? t('dayNames')[d.dow - 1] : (d.name || i + 1);
  h += `<div class="seg wrap" style="margin-bottom:8px">${W.days.map((d, i) => `<button data-fday="${i}" class="${i === dayShown ? 'on' : ''}">${esc(dname(d, i))}</button>`).join('')}</div>`;
  const meals = dayMeals(W, dayShown);
  const sum = key => meals.reduce((a, x) => a + (x.r[key] || 0), 0);
  h += `<div class="muted">${t('dayTotal')}: ${sum('kcal')} / ${tg.kcal} kcal</div><div class="bar"><i style="width:${Math.min(100, sum('kcal') / tg.kcal * 100)}%"></i></div>`;
  h += `<div class="muted">${sum('protein')} / ${tg.protein} g ${t('protein')}</div><div class="bar"><i style="width:${Math.min(100, sum('protein') / tg.protein * 100)}%;background:var(--green)"></i></div>`;
  meals.forEach(({ k, plan, r }) => {
    const time = slotTime(r.slot), steps = Array.isArray(r.how) ? r.how : (r.how ? [r.how] : []);
    const others = W.recipes.filter(x => x.slot === r.slot && x.id !== r.id);
    const macro = `${r.kcal} kcal · ${r.protein} g${r.fat !== undefined ? ` · F ${r.fat} · C ${r.carbs}` : ''}`;
    h += `<div class="meal"><div class="slot">${esc(r.slot)}${time ? ' · ' + esc(time) : ''}${r.prep_min ? ` · ${r.prep_min} ${t('min')}` : ''}</div>
      <div class="meal-head"><b>${esc(r.title)}</b><span class="macro">${macro}</span></div>
      <div class="muted">${r.items.map(esc).join(', ')}</div>
      ${steps.length ? `<details><summary class="muted">${t('showHow')}</summary><ol class="steps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
      ${others.length ? `<div class="alts"><span class="muted">${t('options')}:</span> ${others.map(o => `<button class="chip" data-alt="${esc(o.id)}" data-k="${k}">${esc(o.title)} <small>${o.kcal}</small></button>`).join(' ')}${r.id !== plan.id ? ` <button class="chip ghost" data-alt="" data-k="${k}">${t('original')}</button>` : ''}</div>` : ''}</div>`;
  });
  h += `</div>`;
  const got = S.shop[W.name] || {};
  const total = W.shopping.reduce((a, x) => a + x.price * (x.qty || 1), 0);
  const left = W.shopping.reduce((a, x, i) => a + (got[i] ? 0 : x.price * (x.qty || 1)), 0);
  h += `<div class="card"><h2>${t('shopping')} · ${esc(M.store)}</h2><div class="muted">${t('total')} ${cur}${total.toFixed(2)} · ${t('left')} ${cur}${left.toFixed(2)}</div>`;
  const trips = [...new Set(W.shopping.map(x => x.trip || 1))].sort();
  for (const tr of trips) {
    if (trips.length > 1) { const sd = (M.shop_days || [])[tr - 1]; h += `<h3 class="trip">${t('trip')} ${tr}${sd ? ' · ' + t('dayNames')[sd - 1] : ''}</h3>`; }
    let sec = null;
    W.shopping.map((x, i) => ({ ...x, i })).filter(x => (x.trip || 1) === tr).sort((a, b) => (a.section || '').localeCompare(b.section || '') || a.i - b.i).forEach(x => {
      if (x.section !== sec) { sec = x.section; h += `<div class="section-t">${esc(sec || '')}</div>`; }
      h += `<label class="shop ${got[x.i] ? 'got' : ''}"><input type="checkbox" data-shop="${x.i}" ${got[x.i] ? 'checked' : ''}><span>${esc(x.item)}${x.qty > 1 ? ' × ' + x.qty : ''}${x.note ? `<small class="muted"> · ${esc(x.note)}</small>` : ''}</span><span class="price">${cur}${(x.price * (x.qty || 1)).toFixed(2)}</span></label>`;
    });
  }
  h += `</div>`;
  if (M.supplements && M.supplements.length) h += `<div class="card"><h2>${t('supplements')}</h2><ul class="plain">${M.supplements.map(s => `<li><b>${esc(s.name)}</b> ${esc(s.dose)}, ${esc(s.when)}</li>`).join('')}</ul></div>`;
  if (M.rules && M.rules.length) h += `<div class="card"><h2>${t('rules')}</h2><ul class="plain">${M.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  return h;
}
function bindFood() {
  document.querySelectorAll('[data-fw]').forEach(b => b.onclick = () => { S.foodWeek = b.dataset.fw === 'auto' ? null : +b.dataset.fw; dayShown = null; save(); render(); });
  document.querySelectorAll('[data-fday]').forEach(b => b.onclick = () => { dayShown = +b.dataset.fday; render(); });
  document.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => {
    const W = M.weeks[foodWeekIdx()], key = pickKey(W, dayShown, +b.dataset.k);
    S.pick = S.pick || {}; if (b.dataset.alt) S.pick[key] = b.dataset.alt; else delete S.pick[key]; save(); render();
  });
  document.querySelectorAll('[data-shop]').forEach(c => c.onchange = () => {
    const W = M.weeks[foodWeekIdx()]; S.shop[W.name] = S.shop[W.name] || {}; S.shop[W.name][c.dataset.shop] = c.checked; save(); render();
  });
}

// ---------- progress view ----------
function chart(rows) {
  const pts = rows.filter(r => r.weight);
  if (pts.length < 2) return '';
  const W = 360, H = 170, px = 22, py = 22;
  const xs = pts.map(r => parse(r.date).getTime()), ys = pts.map(r => r.weight);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) - 0.5, y1 = Math.max(...ys) + 0.5;
  const X = v => px + (v - x0) / (x1 - x0 || 1) * (W - px * 2), Y = v => H - py - (v - y0) / (y1 - y0 || 1) * (H - py * 2);
  const line = pts.map((r, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(r.weight).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((r, i) => `<circle cx="${X(xs[i])}" cy="${Y(r.weight)}" r="4" fill="var(--accent)"/><text x="${X(xs[i])}" y="${Y(r.weight) - 10}" text-anchor="middle" font-size="11" fill="var(--text2)">${r.weight}</text>`).join('')}
  </svg>`;
}
function renderProgress() {
  const rows = [...S.body].sort((a, b) => a.date < b.date ? -1 : 1);
  let h = `<div class="card"><h2>${t('addEntry')}</h2><div class="form" style="margin-top:8px">
    <input type="date" id="bDate" value="${todayIso()}"><input id="bW" inputmode="decimal" placeholder="${t('weight')}, ${t('kg')}"><input id="bF" inputmode="decimal" placeholder="${t('fat')}">
    <input id="bWaist" inputmode="decimal" placeholder="${t('waist')}"><span></span><button class="btn" id="bAdd">${t('add')}</button></div>
    ${chart(rows)}`;
  if (rows.length) h += `<table class="log"><tr><th>${t('date')}</th><th>${t('weight')}</th><th>${t('fat')}</th><th>${t('waist')}</th><th></th></tr>${rows.slice().reverse().map(r => `<tr><td>${esc(fmtDate(r.date))}</td><td>${r.weight ?? ''}</td><td>${r.fat ?? ''}</td><td>${r.waist ?? ''}</td><td><button class="x" data-del="${r.date}">×</button></td></tr>`).join('')}</table>`;
  h += `</div><div class="card"><h2>${t('history')}</h2>`;
  const done = Object.keys(S.logs).filter(d => S.logs[d].done).sort().reverse();
  if (!done.length) h += `<p class="muted">${t('noHistory')}</p>`;
  else h += `<table class="log">${done.map(d => {
    const l = S.logs[d], plan = dayPlan(d);
    const n = Object.values(l.sets).flat().filter(x => x && x.done).length;
    return `<tr><td><a href="#day=${d}">${esc(fmtDate(d))}</a></td><td>${esc(plan.name)}</td><td>${n} ${t('sets')}</td><td>${l.mood !== undefined ? esc(t('moods')[l.mood]) : ''}</td></tr>`;
  }).join('')}</table>`;
  h += `</div>`;
  return h;
}
function bindProgress() {
  $('#bAdd').onclick = () => {
    const num = id => { const v = parseFloat($(id).value.replace(',', '.')); return isNaN(v) ? undefined : v; };
    const r = { date: $('#bDate').value || todayIso(), weight: num('#bW'), fat: num('#bF'), waist: num('#bWaist') };
    if (!r.weight && !r.fat && !r.waist) return;
    S.body = S.body.filter(x => x.date !== r.date).concat(r); save(); render();
  };
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.body = S.body.filter(x => x.date !== b.dataset.del); save(); render(); });
}

// ---------- more view ----------
function renderMore() {
  return `<div class="card"><h2>${t('startDate')}</h2><input type="date" id="startIn" value="${S.start}" class="pill" style="margin-top:8px;padding:10px"></div>
  <div class="card"><h2>${t('backup')}</h2><p class="muted">${t('about')}</p><div class="row" style="margin-top:10px">
    <button class="btn" id="expBtn">${t('exportBtn')}</button><label class="btn ghost">${t('importBtn')}<input type="file" id="impIn" accept="application/json" hidden></label>
    <button class="btn ghost" id="resetBtn">${t('reset')}</button></div></div>`;
}
function bindMore() {
  $('#startIn').onchange = e => { if (e.target.value) { S.start = mondayOf(e.target.value); save(); weekShown = null; render(); } };
  $('#expBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = `coach-backup-${todayIso()}.json`; a.click();
  };
  $('#impIn').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const s = JSON.parse(await f.text()); if (!s.v) throw 0; S = Object.assign(blankState(), s); save(); alert(t('imported')); render(); } catch (err) { alert('Invalid file'); }
  };
  $('#resetBtn').onclick = () => { if (confirm(t('resetQ'))) { localStorage.removeItem(KEY); S = blankState(); save(); render(); } };
}

// ---------- render ----------
function render() {
  renderHead();
  const r = route();
  const views = {
    today: [() => renderDay(r.date), () => bindDay(r.date)],
    week: [renderWeek, bindWeek], food: [renderFood, bindFood],
    progress: [renderProgress, bindProgress], more: [renderMore, bindMore]
  };
  const [html, bind] = views[r.tab];
  $('#view').innerHTML = html(); bind();
}

async function getJSON(url, optional) {
  try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { if (optional) return null; throw e; }
}

async function init() {
  try {
    [P, M, PROFILE, SEED] = await Promise.all([getJSON('data/program.json'), getJSON('data/meals.json'), getJSON('data/profile.json', true), getJSON('data/seed.json', true)]);
  } catch (e) {
    $('#view').innerHTML = `<div class="card"><p>${t('noData')}</p></div>`; return;
  }
  PROFILE = PROFILE || {};
  normMeals(M);
  KEY = 'pck:' + (P.title || 'program') + (SEED && SEED.demo ? ':demo' : '');
  S = load() || (SEED && SEED.demo ? demoState() : blankState()); save();
  lang = S.lang || PROFILE.language || (navigator.language || 'en').slice(0, 2);
  if (!I18N[lang]) lang = 'en';
  $('#langBtn').onclick = () => { const ks = Object.keys(I18N); lang = ks[(ks.indexOf(lang) + 1) % ks.length]; S.lang = lang; save(); render(); };
  $('#themeBtn').onclick = () => { S.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; save(); render(); };
  window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
  render();
}
init();
