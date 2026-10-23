// Optional headless browser (Playwright + Chromium) so the AI can read real prices from store websites.
// Installed on demand into .browser/ by `node coach.mjs browser-setup`, never needed for anything else.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

export function setupBrowser(root) {
  const dir = path.join(root, '.browser');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, 'package.json'))) fs.writeFileSync(path.join(dir, 'package.json'), '{"private":true}\n');
  // npm next to the running node works even when npm is not on PATH
  const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npm = fs.existsSync(cli) ? [process.execPath, [cli]] : ['npm', []];
  const run = (c, a) => { console.log('> ' + a.join(' ')); const r = spawnSync(c, a, { cwd: dir, stdio: 'inherit', shell: c === 'npm' && process.platform === 'win32' }); if (r.status) throw new Error('install failed, see the output above'); };
  run(npm[0], [...npm[1], 'install', 'playwright@1', '--no-audit', '--no-fund']);
  run(process.execPath, [path.join(dir, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium']);
  console.log('\nBrowser ready. Try: node coach.mjs prices --store "Lidl" --items "chicken breast, oats"');
}

async function launch(root) {
  let pw;
  try { pw = createRequire(path.join(root, '.browser', 'package.json'))('playwright'); }
  catch { throw new Error('No browser yet. Run once: node coach.mjs browser-setup  (about 150 MB, 1-2 minutes)'); }
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'en-GB', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
  return { browser, page: await ctx.newPage() };
}

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  // accept cookie banners so the content is visible
  for (const t of ['Accept all', 'Accept', 'Allow all', 'Agree', 'Принять', 'Согласен', 'Alle akzeptieren', 'Tout accepter', 'OK'])
    if (await page.getByRole('button', { name: t, exact: true }).first().click({ timeout: 700 }).then(() => true, () => false)) break;
  return (await page.evaluate(() => document.body.innerText)).split('\n').map(s => s.trim()).filter(Boolean);
}

async function search(page, q) {
  const grab = async (url, sel) => {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); return await page.$$eval(sel, as => as.map(a => ({ title: a.innerText, href: a.href }))); }
    catch { return []; }
  };
  let links = await grab('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), 'a.result__a');
  if (!links.length) links = await grab('https://www.bing.com/search?q=' + encodeURIComponent(q), 'li.b_algo h2 a');
  // unwrap redirect links: DuckDuckGo ?uddg=, Bing /ck/a?u=a1<base64url>
  return links.map(l => {
    try {
      const u = new URL(l.href);
      if (u.searchParams.get('uddg')) return { ...l, href: u.searchParams.get('uddg') };
      const b = u.hostname.endsWith('bing.com') && u.searchParams.get('u');
      if (b) return { ...l, href: Buffer.from(b.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString() };
    } catch {}
    return l;
  }).filter(l => /^https?:/.test(l.href) && !/(duckduckgo|bing)\.com/.test(new URL(l.href).hostname));
}

async function siteSearch(page, home, item) {
  await open(page, home);
  const box = page.locator('input[type=search], input[name=q], input[name=query], input[name=search], input[name=text], input[placeholder*="earch" i], input[placeholder*="оиск" i], input[aria-label*="earch" i]').first();
  if (!(await box.isVisible({ timeout: 1500 }).catch(() => false))) {
    // the box is often behind a magnifier button
    await page.locator('button[aria-label*="earch" i], a[aria-label*="earch" i], button[aria-label*="оиск" i]').first().click({ timeout: 1500 }).catch(() => {});
  }
  await box.fill(item, { timeout: 3000 });
  await box.press('Enter');
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  return (await page.evaluate(() => document.body.innerText)).split('\n').map(s => s.trim()).filter(Boolean);
}

const PRICE = /(£|€|\$|₽|руб|р\.|₴|грн|zł|kr|Kč|lei|₸|CHF)\s?\d|\d[\d\s]*[.,]\d{2}\s?(£|€|\$|₽|руб|р\.|₴|грн|zł|kr|Kč|lei|₸)|\d\s?(₽|руб|р\.|₴|грн|zł|Kč|lei|₸|€|kr)(?![a-zа-я])|\d+\s?(p|ct)\b/i;
const BLOCK = /access denied|captcha|not a robot|verify you are human|are you a robot|не робот|не с ботом|пройдите проверку|проблемы со связью|attention required/i;
// price lines with 3 lines of context above; only those that mention the item unless all=true
function priceLines(lines, item, max = 12, all = false) {
  const words = item.toLowerCase().split(/\s+/).filter(w => w.length > 2).map(w => w.slice(0, Math.max(4, w.length - 2))); // crude stem: филе/филею, oats/oat
  const out = [], seen = new Set();
  // "120" + "руб" + "/шт" on separate lines -> "120 руб /шт"
  const cur = /^(£|€|\$|₽|руб\.?|р\.|₴|грн|zł|kr|Kč|lei|₸|CHF)$/i;
  lines = lines.reduce((a, l) => { const k = a.length - 1; if (k >= 0 && (cur.test(l) && /\d$/.test(a[k]) || /^\/\S{1,6}$/.test(l) && PRICE.test(a[k]))) a[k] += ' ' + l; else a.push(l); return a; }, []);
  lines.forEach((l, i) => {
    if (!PRICE.test(l) || l.length > 160) return;
    const ctx = lines.slice(Math.max(0, i - 3), i + 3).join(' | ');
    const hit = words.some(w => ctx.toLowerCase().includes(w));
    if (!hit && !all) return;
    const key = ctx.slice(0, 60); if (seen.has(key)) return; seen.add(key);
    out.push((hit ? '* ' : '  ') + (ctx.length > 220 ? ctx.slice(-220) : ctx));
  });
  return out.slice(0, max);
}

// node coach.mjs prices --store "Lidl" --items "chicken breast, oats" [--site lidl.co.uk] [--near "Liverpool"]
export async function prices(root, args) {
  if (!args.store && !args.site) throw new Error('Usage: node coach.mjs prices --store "Store name" --items "item 1, item 2" [--site shop-domain.com] [--near "city"]');
  const items = String(args.items || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!items.length) throw new Error('Add --items "chicken breast, oats, eggs"');
  const { browser, page } = await launch(root);
  try {
    let site = args.site ? String(args.site).replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';
    if (!site) {
      const r = await search(page, `${args.store} ${args.near || ''}`);
      const skip = /wiki|stackoverflow|stackexchange|github|google\.|2gis|zoon|otzovik|irecommend|facebook|instagram|youtube|twitter|x\.com|linkedin|tripadvisor|yelp|maps\.|reddit/;
      site = (r.find(l => !skip.test(l.href)) || {}).href || '';
      site = site && new URL(site).hostname;
      if (!site) throw new Error('Could not find the store website, pass it with --site');
    }
    console.log(`Store site: ${site}\n(* = line mentions the item; check the pack size before using a price)\n`);
    const home = 'https://' + site;
    for (const item of items) {
      console.log(`== ${item}`);
      // 1) the store's own search box (works on most online shops), 2) usual search URLs
      let found = false, blocked = false;
      const tries = [() => siteSearch(page, home, item), ...['/search?q=', '/search/?q=', '/search?query=', '/search?text=', '/search?search='].map(t => () => open(page, home + t + encodeURIComponent(item)))];
      for (const t of tries) {
        const lines = await t().catch(() => null);
        if (!lines) continue;
        if (BLOCK.test(lines.slice(0, 15).join(' '))) { blocked = true; break; }
        const pl = priceLines(lines, item, 8);
        if (pl.length) { console.log(`  ${page.url()}\n${pl.map(s => '    ' + s).join('\n')}\n`); found = true; break; }
      }
      if (found) continue;
      if (blocked) { console.log(`  the site blocks automatic browsers (bot check or region lock). Ask the user to open ${home} and tell you the prices, or check another store\n`); continue; }
      // 2) web search for pages on the store site
      const dom = site.replace(/^www\./, '');
      const res = (await search(page, `${args.store || dom} ${item} price`)).filter(l => new URL(l.href).hostname.endsWith(dom) && new URL(l.href).pathname.length > 1).slice(0, 2);
      if (!res.length) { console.log('  no prices found on the store site (no online shop, or prices need a postcode/login): estimate, or use a big chain in the same country\n'); continue; }
      for (const r of res) {
        try {
          const pl = priceLines(await open(page, r.href), item, 6);
          console.log(`  ${r.href}\n${pl.length ? pl.map(s => '    ' + s).join('\n') : '    no matching products with prices on this page'}`);
        } catch (e) { console.log(`  ${r.href}\n    could not open: ${e.message.split('\n')[0]}`); }
      }
      console.log('');
    }
  } finally { await browser.close(); }
}

// node coach.mjs browse <url> [--find "word"]  prints the visible text of a page (prices first if --find)
export async function browse(root, url, args) {
  if (!url) throw new Error('Usage: node coach.mjs browse <url> [--find "chicken"]');
  const { browser, page } = await launch(root);
  try {
    const lines = await open(page, url);
    console.log(`${await page.title()}\n${page.url()}\n`);
    if (args.find) console.log(priceLines(lines, String(args.find), 30, true).join('\n') || 'no prices found');
    else console.log(lines.join('\n').slice(0, +(args.max || 8000)));
  } finally { await browser.close(); }
}
