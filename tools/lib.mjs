// 共通：Playwright 起動、three.js のローカル差し替え
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const { chromium } = createRequire(import.meta.url)('playwright');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const THREE_VER = '0.170.0';
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}/`;

export function ensureThree() {
  const vendor = path.join(ROOT, 'tools/.vendor', `three-${THREE_VER}`);
  if (!existsSync(path.join(vendor, 'package/build/three.module.js'))) {
    mkdirSync(vendor, { recursive: true });
    execSync(`npm pack three@${THREE_VER} --silent && tar xzf three-${THREE_VER}.tgz`, { cwd: vendor, stdio: 'inherit' });
  }
  return vendor;
}

export const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

export async function openPage(browser, html, viewport) {
  const vendor = ensureThree();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], blocked = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(CDN)) return route.fulfill({ path: path.join(vendor, 'package', u.slice(CDN.length)), contentType: 'text/javascript' });
    if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
    blocked.push(u); return route.abort();
  });
  await page.goto(pathToFileURL(html).href);
  return { ctx, page, errors, blocked };
}

export const hookOf = (src) => (src.match(/window\.(__\w+)\s*=/) || [])[1];
