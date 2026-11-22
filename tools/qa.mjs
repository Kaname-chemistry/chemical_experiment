// 品質保証部 自動テスト: node tools/qa.mjs apps/<slug> [--no-ogp]
// - three.js (jsdelivr) はローカルの npm パッケージに差し替えて読み込む（オフラインでも動く）
// - それ以外の外部通信はブロックして FAIL
// - tools/scenarios/<slug>.mjs の scenarios() / ogp() を実行
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.resolve(process.argv[2] || '');
const slug = path.basename(appDir);
const doOgp = !process.argv.includes('--no-ogp');
const html = path.join(appDir, 'index.html');
if (!existsSync(html)) { console.error('usage: node tools/qa.mjs apps/<slug>'); process.exit(2); }

const THREE_VER = '0.170.0';
const vendor = path.join(ROOT, 'tools/.vendor', `three-${THREE_VER}`);
if (!existsSync(path.join(vendor, 'package/build/three.module.js'))) {
  mkdirSync(vendor, { recursive: true });
  execSync(`npm pack three@${THREE_VER} --silent && tar xzf three-${THREE_VER}.tgz`, { cwd: vendor, stdio: 'inherit' });
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

// ---------- static checks ----------
const src = readFileSync(html, 'utf8');
const meta = (p) => (src.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`)) || [])[1];
const base = `https://kaname-chemistry.github.io/${slug}/`;
check('og:url', meta('og:url') === base, meta('og:url'));
check('og:image', meta('og:image') === base + 'ogp.jpg', meta('og:image'));
check('twitter:card', meta('twitter:card') === 'summary_large_image');
check('og:description (日本語)', /[ぁ-んァ-ン一-龥]/.test(meta('og:description') || ''));
const ext = [...src.matchAll(/https?:\/\/[^"'\s)]+/g)].map(m => m[0])
  .filter(u => !u.startsWith(`https://cdn.jsdelivr.net/npm/three@${THREE_VER}/`) && !u.startsWith(base));
check('外部読み込みは three.js 固定版のみ', ext.length === 0, ext.join(', '));
check('安全表示あり', /teacher|先生/i.test(src));

// ---------- browser ----------
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], blocked = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    const pre = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}/`;
    if (u.startsWith(pre)) return route.fulfill({ path: path.join(vendor, 'package', u.slice(pre.length)), contentType: 'text/javascript' });
    if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
    blocked.push(u); return route.abort();
  });
  await page.goto(pathToFileURL(html).href);
  return { ctx, page, errors, blocked };
}
const hookName = (src.match(/window\.(__\w+)\s*=/) || [])[1];
check('テスト用フックあり', !!hookName, hookName);

async function renderStats(page) {
  return page.evaluate(() => {
    const c = document.getElementById('c'), w = 160, h = 100;
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const g = t.getContext('2d'); g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data; let s = 0, s2 = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += l; s2 += l * l; }
    const n = d.length / 4, m = s / n; return { mean: m, sd: Math.sqrt(s2 / n - m * m) };
  });
}
async function layout(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight, bad = [];
    for (const el of document.querySelectorAll('.glass, button')) {
      const r = el.getBoundingClientRect(); if (r.width === 0) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push(el.id || el.textContent.trim().slice(0, 20));
    }
    const hud = document.getElementById('hud')?.getBoundingClientRect(), ctrl = document.getElementById('ctrl')?.getBoundingClientRect();
    if (hud && ctrl && hud.bottom > ctrl.top) bad.push('hud overlaps ctrl');
    if (document.documentElement.scrollWidth > W) bad.push('horizontal scroll');
    return bad;
  });
}

const shots = path.join(ROOT, 'company/reviews/shots'); mkdirSync(shots, { recursive: true });
for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
  const { ctx, page, errors, blocked } = await open(vp);
  await page.waitForFunction((h) => !!window[h], hookName, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const st = await renderStats(page);
  check(`[${label}] WebGL 描画`, st.sd > 6 && st.mean > 15 && st.mean < 245, `mean ${st.mean.toFixed(0)} sd ${st.sd.toFixed(1)}`);
  const bad = await layout(page);
  check(`[${label}] UI がはみ出さない`, bad.length === 0, bad.join(', '));
  await page.screenshot({ path: path.join(shots, `${slug}-${label}.jpg`), type: 'jpeg', quality: 82 });
  check(`[${label}] エラー 0件`, errors.length === 0, errors.slice(0, 3).join(' | '));
  check(`[${label}] 外部通信なし`, blocked.length === 0, blocked.slice(0, 3).join(', '));
  await ctx.close();
}

// ---------- scenarios ----------
const scenPath = path.join(ROOT, 'tools/scenarios', `${slug}.mjs`);
if (existsSync(scenPath)) {
  const scen = await import(pathToFileURL(scenPath).href);
  const { ctx, page, errors } = await open({ width: 1280, height: 800 });
  await page.waitForFunction((h) => !!window[h], hookName, { timeout: 30000 });
  await page.evaluate((h) => window[h].hold(true), hookName);
  await scen.scenarios(page, check, shots);
  check('[scenario] エラー 0件', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
  if (doOgp && scen.ogp) {
    const o = await open({ width: 1200, height: 630 });
    await o.page.waitForFunction((h) => !!window[h], hookName, { timeout: 30000 });
    await o.page.evaluate((h) => window[h].hold(true), hookName);
    await scen.ogp(o.page);
    await o.page.screenshot({ path: path.join(appDir, 'ogp.jpg'), type: 'jpeg', quality: 88 });
    check('ogp.jpg 1200×630 生成', true);
    await o.ctx.close();
  }
} else check('シナリオファイル', false, scenPath + ' がない');

await browser.close();
const fail = results.filter(r => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} PASS${fail.length ? '  — FAIL: ' + fail.map(f => f.name).join(', ') : ''}`);
process.exit(fail.length ? 1 : 0);
