// 炭酸水素ナトリウムの熱分解：正しい手順と、定番の失敗3種を検証
const H = '__soda';
const run = (page, fn, arg) => page.evaluate(([h, f, a]) => { const api = window[h]; return new Function('api', 'a', f)(api, a); }, [H, fn, arg]);
const state = (page) => run(page, `const S = api.S; return { conv: api.conv(), mass: api.massSolid(), co2: S.co2mL, turb: S.turb, T: S.T,
  broken: S.broken, cond: S.cond, suck: S.suck, h2o: S.h2oMade, co: S.co, log: [...document.querySelectorAll('#log li')].map(l => l.textContent) };`);

export async function scenarios(page, check, shots) {
  // 1. 正しい手順
  await run(page, `api.reset(); api.setBurner(true); api.step(2.0);`);
  let s = await state(page);
  check('最初の泡は空気（石灰水は透明）', s.turb < 0.01 && s.log.some(l => /expanded air/.test(l)), `turb ${s.turb.toFixed(3)} co2 ${s.co2.toFixed(1)}`);
  await run(page, `api.step(45);`);
  s = await state(page);
  check('全量分解で固体 1.26 g', Math.abs(s.mass - 1.262) < 0.01 && s.conv > 0.99, `${s.mass.toFixed(3)} g, ${(s.conv * 100).toFixed(1)}%`);
  check('CO₂ 約292 mL（25 °C）', Math.abs(s.co2 - 292) < 4, `${s.co2.toFixed(1)} mL`);
  check('水 0.21 g', Math.abs(s.h2o - 0.214) < 0.005, `${s.h2o.toFixed(3)} g`);
  check('石灰水が白濁', s.turb > 0.35, `turb ${s.turb.toFixed(2)}`);
  check('口を下げていれば割れない', !s.broken);
  await run(page, `api.setLift(true); api.step(1.0); api.setBurner(false); api.step(25);`);
  s = await state(page);
  check('ガラス管を抜いてから消火 → 逆流しない', !s.broken && s.suck === 0, `T ${s.T.toFixed(0)}`);
  await run(page, `api.testCoCl2(); api.step(2);`);
  s = await state(page);
  check('塩化コバルト紙が桃色（水）', s.co && s.co.pink);
  await run(page, `api.testPh(); api.step(3);`);
  s = await state(page);
  check('フェノールフタレインで残留物が濃い桃色', s.log.some(l => /deep pink/.test(l)));
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-tests.jpg`, type: 'jpeg', quality: 82 });

  // 2. 口を上げる → 水が逆流して割れる
  await run(page, `api.reset(); api.setTilt('up'); api.step(1); api.setBurner(true); api.step(40);`);
  s = await state(page);
  check('口を上げる → 水の逆流で割れる', s.broken && /ran back/.test(s.broken), s.broken || 'not broken');
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-crack.jpg`, type: 'jpeg', quality: 82 });

  // 3. 水平でも時間がたつと逆流する
  await run(page, `api.reset(); api.setTilt('level'); api.step(1); api.setBurner(true); api.step(45);`);
  s = await state(page);
  check('水平 → 遅れて逆流し割れる', s.broken && /ran back/.test(s.broken), s.broken || 'not broken');

  // 4. 先に火を消す → 石灰水が逆流
  await run(page, `api.reset(); api.setBurner(true); api.step(20); api.setBurner(false); api.step(2.0);`);
  s = await state(page);
  check('先に消火 → 石灰水が上がってくる', s.suck > 0.2 && !s.broken, `suck ${s.suck.toFixed(2)}`);
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-suckback.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(4);`);
  s = await state(page);
  check('放置すると石灰水の逆流で割れる', s.broken && /Suck-back/.test(s.broken), s.broken || 'not broken');

  // 5. 逆流中にガラス管を抜けば間に合う
  await run(page, `api.reset(); api.setBurner(true); api.step(20); api.setBurner(false); api.step(2.0); api.setLift(true); api.step(3);`);
  s = await state(page);
  check('逆流中に抜けば助かる', !s.broken && s.suck === 0 && s.log.some(l => /in time/.test(l)));

  // 6. 口を上げても、水がたまる前に下げれば戻る
  await run(page, `api.reset(); api.setTilt('down'); api.setBurner(true); api.step(25); api.setTilt('up'); api.step(1.6); api.setTilt('down'); api.step(4);`);
  s = await state(page);
  check('途中で口を下げ直すと水が口元に戻る', !s.broken && s.log.some(l => /drained back/.test(l)), s.broken || '');
}

export async function ogp(page) {
  await page.addStyleTag({ content: '#ctrl,#hint{display:none!important}' });
  await run(page, `api.reset(); api.setBurner(true); api.step(16); api.view([-5.5, 11.5, 1], [-1.5, 18, 43]);`);
  await run(page, `api.step(0.05);`);
}
