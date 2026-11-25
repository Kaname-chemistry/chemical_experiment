// 鏡のハート（銀鏡反応）：条件ごとの出来ばえと、物質ごとの還元性を検証
const H = '__mirror';
const run = (page, fn) => page.evaluate(([h, f]) => new Function('api', f)(window[h]), [H, fn]);
const state = (page) => run(page, `const S = api.S; return { r: S.r, m: S.mirror, p: S.powder, stars: S.stars, T: S.T, started: S.started,
  log: [...document.querySelectorAll('#log li')].map(l => l.textContent), judge: document.getElementById('judge').textContent, starsTxt: document.getElementById('sname').textContent };`);

export async function scenarios(page, check, shots) {
  // 1. 正しい手順：グルコース・60 °C・よく洗った・ゆすらない
  await run(page, `api.reset(); api.setSubst('glucose'); api.setClean(true); api.setTemp(60); api.start(); api.step(1.5); api.step(8);`);
  let s = await state(page);
  check('銀がガラスにはりつき始める', s.log.some(l => /はりつき始めた/.test(l)) && s.m > 10, `${s.m.toFixed(0)} mg`);
  check('始めた後は物質を変えられない', await run(page, `api.setSubst('sucrose'); return api.S.subst;`) === 'glucose');
  await page.screenshot({ path: `${shots}/silver-mirror-heart-3d-growing.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(20);`);
  s = await state(page);
  check('反応がほぼ終わる（60 °C・約10分）', s.r > 0.97 && s.log.some(l => /液を捨てて/.test(l)), `${(s.r * 100).toFixed(1)}%`);
  check('銀の合計 108 mg', Math.abs(s.m + s.p - 107.87 * s.r) < 0.5, `${(s.m + s.p).toFixed(1)} mg`);
  await run(page, `api.pour(); api.step(4);`);
  s = await state(page);
  check('液を捨てると ★★★', s.stars === 3 && /ピカピカ/.test(s.starsTxt), `★${s.stars}`);
  await page.screenshot({ path: `${shots}/silver-mirror-heart-3d-mirror.jpg`, type: 'jpeg', quality: 82 });
  const len = await run(page, `return api.photo(false).length;`);
  check('メッセージ入りの写真を作れる', len > 50000, `${len} chars`);

  // 2. スクロース：還元性なし
  await run(page, `api.reset(); api.setSubst('sucrose'); api.start(); api.step(1.5); api.step(15); api.pour(); api.step(1);`);
  s = await state(page);
  check('スクロースは何も起こらない', s.r === 0 && s.stars === 0 && /還元性なし/.test(s.judge) && s.log.some(l => /還元性を示さない/.test(l)));
  // 3. アセトン
  await run(page, `api.reset(); api.setSubst('acetone'); api.start(); api.step(1.5); api.step(10);`);
  s = await state(page);
  check('アセトンは何も起こらない', s.r === 0);
  // 4. フルクトース
  await run(page, `api.reset(); api.setSubst('fructose'); api.start(); api.step(1.5); api.step(30); api.pour(); api.step(1);`);
  s = await state(page);
  check('フルクトースでも鏡ができる', s.r > 0.95 && s.stars >= 2 && s.log.some(l => /塩基性の水溶液中では還元性/.test(l)), `★${s.stars}`);

  // 5. 汚れたガラス
  await run(page, `api.reset(); api.setSubst('glucose'); api.setClean(false); api.start(); api.step(1.5); api.step(25); api.pour(); api.step(3);`);
  s = await state(page);
  check('汚れたガラス → まだら（★1以下）', s.stars <= 1 && s.log.some(l => /汚れていて/.test(l)), `★${s.stars}`);
  await page.screenshot({ path: `${shots}/silver-mirror-heart-3d-dirty.jpg`, type: 'jpeg', quality: 82 });

  // 6. 熱すぎる（90 °C）
  await run(page, `api.reset(); api.setClean(true); api.setTemp(90); api.step(3); api.start(); api.step(1.5); api.step(6);`);
  s = await state(page);
  check('90 °C → 黒い粉が多い', s.p > s.m && s.log.some(l => /温度が高すぎて/.test(l)), `鏡 ${s.m.toFixed(0)} / 粉 ${s.p.toFixed(0)} mg`);
  await page.screenshot({ path: `${shots}/silver-mirror-heart-3d-hot.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(6); api.pour(); api.step(1);`);
  s = await state(page);
  check('90 °C → ★0', s.stars === 0, `★${s.stars}`);

  // 7. 冷たい（25 °C）
  await run(page, `api.reset(); api.setTemp(25); api.step(4); api.start(); api.step(1.5); api.step(15);`);
  s = await state(page);
  check('25 °C → 反応が遅い', s.r < 0.5 && s.log.some(l => /なかなか進まない/.test(l)), `${(s.r * 100).toFixed(0)}%`);

  // 8. ゆする
  await run(page, `api.reset(); api.setTemp(60); api.step(4); api.start(); api.step(1.5); for (let i = 0; i < 8; i++) { api.shake(); api.step(1.6); } api.step(14); api.pour(); api.step(1);`);
  s = await state(page);
  check('ゆすり続ける → 出来ばえが下がる', s.stars <= 1 && s.log.some(l => /ゆすると/.test(l)), `★${s.stars}`);
  await run(page, `api.reset(); api.setTemp(60);`);
}

export async function ogp(page) {
  await page.addStyleTag({ content: '#ctrl,#hint{display:none!important}' });
  await run(page, `api.reset(); api.setSubst('glucose'); api.setClean(true); api.setTemp(60); api.step(2); api.start(); api.step(1.5); api.step(28); api.pour(); api.step(5);
    api.view([2.2, 12.4, 0], [3.5, 15.5, 25]);`);
  await run(page, `api.step(0.05);`);
}

// ---------- 撮影部：実演動画の台本 ----------
const T0 = [3.5, 8, 0];
export const videos = {
  'mirror-heart': {
    seconds: 24,
    setup: `api.reset(); api.setSubst('glucose'); api.setClean(true); api.setTemp(60); api.step(2);`,
    speedJs: `const S = api.S; return (S.started && !S.poured && S.r < 0.97) ? 2 : 1;`,
    cam: [{ t: 0, target: T0, pos: [6, 14, 34] }, { t: 10, target: [1.5, 8, 0], pos: [3, 12, 26] }, { t: 16, target: [1.5, 11.5, 0], pos: [3, 14, 25] }, { t: 24, target: [1.5, 12.5, 0], pos: [4.5, 15, 22] }],
    cues: [
      { t: 0.3, caption: 'ハートのフラスコで、銀鏡反応をすると…', hold: 2.6 },
      { t: 1.2, click: '#bGo' },
    ],
    watch: [
      { when: `return api.S.r > 0.2`, caption: '銀イオンが銀になって、ガラスにはりつく', hold: 3.2 },
      { when: `return api.S.r > 0.97`, click: '#bPour', caption: '液を捨てると…', hold: 2.2 },
      { after: 3.0, caption: '鏡のハート ★★★', hold: 5 },
    ],
  },
  'fail-black': {
    seconds: 17,
    setup: `api.reset(); api.setSubst('glucose'); api.setClean(true); api.setTemp(60); api.step(2);`,
    cam: [{ t: 0, target: T0, pos: [6, 14, 34] }, { t: 9, target: [1.5, 7.5, 0], pos: [3, 11, 26] }, { t: 17, target: [1.5, 12, 0], pos: [3.5, 14.5, 24] }],
    cues: [
      { t: 0.3, caption: '早く作りたくて、湯を90℃にすると…', hold: 2.8 },
      { t: 0.8, js: `api.setTemp(90);` },
      { t: 2.8, click: '#bGo' },
      { t: 6.5, caption: '銀が黒い粉になって、鏡にならない', hold: 3.2 },
      { t: 10.2, click: '#bPour', caption: '液を捨てると…', hold: 1.8 },
      { t: 13.0, caption: '★0　正解は 約60℃ の湯でじっくり', hold: 4 },
    ],
  },
  'which-sugar': {
    seconds: 21,
    setup: `api.reset(); api.setSubst('glucose'); api.setClean(true); api.setTemp(60); api.step(2);`,
    speedJs: `const S = api.S; return (S.started && !S.poured && S.subst === 'fructose' && S.r < 0.97) ? 2 : 1;`,
    cam: [{ t: 0, target: T0, pos: [6, 13, 32] }, { t: 21, target: [2, 9, 0], pos: [3, 12, 27] }],
    cues: [
      { t: 0.3, caption: '砂糖（スクロース）で銀鏡反応をすると？', hold: 2.6 },
      { t: 0.7, click: '#sub [data-s=sucrose]' },
      { t: 1.4, click: '#bGo' },
      { t: 4.4, caption: '…何も起こらない', hold: 2.4 },
      { t: 7.2, click: '#bReset' },
      { t: 7.6, click: '#sub [data-s=fructose]' },
      { t: 8.0, caption: 'では、果糖（フルクトース）は？', hold: 2.2 },
      { t: 8.6, click: '#bGo' },
    ],
    watch: [
      { when: `return api.S.subst === 'fructose' && api.S.r > 0.3`, caption: '鏡ができる！', hold: 2.4 },
      { after: 2.6, caption: '果糖は還元性を示す、砂糖は示さない', hold: 4.5 },
    ],
  },
};
