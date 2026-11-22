// 撮影部：実演動画をコマ撮りで書き出す
//   node tools/record.mjs apps/<slug> [video-name ...] [--fps 30] [--size 1280x720]
// シミュレーションを1コマずつ進めてスクショ → ffmpeg で H.264 MP4（X 投稿向け）
// 処理が重くても動画は常に一定fpsでなめらか。カメラはイージング補間、タップ位置に波紋、早送り中は倍率表示、日本語字幕。
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, launch, openPage, hookOf } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const fps = +opt('--fps', 30);
const [W, H] = opt('--size', '1280x720').split('x').map(Number);
const appDir = path.resolve(args.shift() || '');
const slug = path.basename(appDir);
const html = path.join(appDir, 'index.html');
const scen = await import(pathToFileURL(path.join(ROOT, 'tools/scenarios', `${slug}.mjs`)).href);
const videos = scen.videos || {};
const names = args.length ? args : Object.keys(videos);
if (!existsSync(html) || !names.length) { console.error('usage: node tools/record.mjs apps/<slug> [video ...]'); process.exit(2); }
const hook = hookOf(readFileSync(html, 'utf8'));
const outDir = path.join(ROOT, 'media', slug); mkdirSync(outDir, { recursive: true });

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
function camAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) { const k = ease((t - a.t) / (b.t - a.t)); return { target: lerp(a.target, b.target, k), pos: lerp(a.pos, b.pos, k) }; }
  }
  return keys[keys.length - 1];
}

const OVERLAY_CSS = `
  #hint{display:none!important}
  #__rip{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;z-index:99;
    border:3px solid rgba(255,255,255,.95);box-shadow:0 0 0 2px rgba(20,48,63,.55),0 0 18px rgba(255,255,255,.6);opacity:0}
  #__cap{position:fixed;left:50%;transform:translateX(-50%);top:18px;z-index:98;pointer-events:none;
    font:700 26px "IPAPGothic","IPAGothic",system-ui,sans-serif;color:#fff;background:rgba(14,28,40,.78);
    padding:10px 20px;border-radius:12px;white-space:nowrap;opacity:0;letter-spacing:.02em}
  #__spd{position:fixed;left:16px;top:16px;z-index:98;font:800 18px system-ui,sans-serif;color:#14303f;
    background:rgba(255,255,255,.8);padding:5px 10px;border-radius:9px;opacity:0}`;

const browser = await launch();
for (const name of names) {
  const v = videos[name]; if (!v) { console.error('no video', name); continue; }
  const { ctx, page, errors } = await openPage(browser, html, { width: W, height: H });
  await page.waitForFunction((h) => !!window[h], hook, { timeout: 30000 });
  await page.addStyleTag({ content: OVERLAY_CSS + (v.css || '') });
  await page.evaluate((h) => {
    window[h].hold(true);
    for (const id of ['__rip', '__cap', '__spd']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  }, hook);
  await page.clock.install();                     // toast などの setTimeout を動画の時間で進める
  await page.evaluate(([h, js]) => new Function('api', js)(window[h]), [hook, v.setup || 'api.reset();']);

  const out = path.join(outDir, `${name}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  // 台本をページ内に渡す：cues（時刻で発火）と watch（状態で順に発火）
  await page.evaluate(([cues, watch, speed, speedJs]) => {
    window.__rec = { cues: cues.sort((a, b) => a.t - b.t), ci: 0, watch, wi: 0, wlast: 0, speed, speedJs, rip: null, cap: null };
  }, [v.cues || [], v.watch || [], v.speed || [{ t: 0, v: 1 }], v.speedJs || '']);
  const N = Math.round(v.seconds * fps);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const t = f / fps, cam = camAt(v.cam, t);
    await page.evaluate(([h, t, cam, fps]) => {
      const api = window[h], R = window.__rec;
      const fire = (c) => {
        if (c.click) { const e = document.querySelector(c.click); if (e) { const b = e.getBoundingClientRect(); e.click(); R.rip = { x: b.left + b.width / 2, y: b.top + b.height / 2, t }; } }
        if (c.js) new Function('api', c.js)(api);
        if (c.caption !== undefined) R.cap = c.caption ? { text: c.caption, t, until: t + (c.hold ?? 3) } : null;
      };
      while (R.ci < R.cues.length && R.cues[R.ci].t <= t) fire(R.cues[R.ci++]);
      const w = R.watch[R.wi];
      if (w && t - R.wlast >= (w.after || 0) && (!w.when || new Function('api', w.when)(api))) { R.wi++; R.wlast = t; fire(w); }
      const sp = R.speedJs ? new Function('api', R.speedJs)(api) : R.speed.filter(k => k.t <= t).pop().v;
      api.view(cam.target, cam.pos);
      api.step(sp / fps, 1 / 120);
      const rk = R.rip ? (t - R.rip.t) / 0.5 : 1, RP = document.getElementById('__rip');
      if (rk < 1) { RP.style.left = R.rip.x + 'px'; RP.style.top = R.rip.y + 'px'; RP.style.opacity = 1 - rk; RP.style.transform = `scale(${0.6 + rk * 0.9})`; } else RP.style.opacity = 0;
      const C = document.getElementById('__cap');
      if (R.cap) { C.textContent = R.cap.text; C.style.opacity = Math.max(0, Math.min(1, (t - R.cap.t) / 0.25, (R.cap.until - t) / 0.25)); } else C.style.opacity = 0;
      const SP = document.getElementById('__spd'); SP.textContent = `×${sp}`; SP.style.opacity = sp > 1 ? 1 : 0;
    }, [hook, t, cam, fps]);
    await page.clock.runFor(1000 / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % fps === 0) process.stdout.write(`\r${name}: ${f}/${N} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\r${name}: ${N} frames → ${path.relative(ROOT, out)}${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
