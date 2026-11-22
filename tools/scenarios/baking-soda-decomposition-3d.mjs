// 炭酸水素ナトリウムの熱分解：正しい手順と、定番の失敗3種を検証
const H = '__soda';
const run = (page, fn, arg) => page.evaluate(([h, f, a]) => { const api = window[h]; return new Function('api', 'a', f)(api, a); }, [H, fn, arg]);
const state = (page) => run(page, `const S = api.S; return { conv: api.conv(), mass: api.massSolid(), co2: S.co2mL, turb: S.turb, T: S.T,
  broken: S.broken, cond: S.cond, suck: S.suck, h2o: S.h2oMade, co: S.co, log: [...document.querySelectorAll('#log li')].map(l => l.textContent) };`);

export async function scenarios(page, check, shots) {
  // 1. 正しい手順
  await run(page, `api.reset(); api.setBurner(true); api.step(2.0);`);
  let s = await state(page);
  check('最初の泡は空気（石灰水は透明）', s.turb < 0.01 && s.log.some(l => /押し出された空気/.test(l)), `turb ${s.turb.toFixed(3)} co2 ${s.co2.toFixed(1)}`);
  await run(page, `api.step(60);`);
  s = await state(page);
  check('完了ログの質量が理論値 1.26 g', s.log.some(l => /2\.00 g → 1\.26 g/.test(l)));
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
  check('フェノールフタレインで残留物が濃い桃色', s.log.some(l => /濃い赤/.test(l)));
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-tests.jpg`, type: 'jpeg', quality: 82 });

  // 2. 口を上げる → 水が逆流して割れる
  await run(page, `api.reset(); api.setTilt('up'); api.step(1); api.setBurner(true); api.step(40);`);
  s = await state(page);
  check('口を上げる → 水の逆流で割れる', s.broken && /流れ戻/.test(s.broken), s.broken || 'not broken');
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-crack.jpg`, type: 'jpeg', quality: 82 });

  // 3. 水平でも時間がたつと逆流する
  await run(page, `api.reset(); api.setTilt('level'); api.step(1); api.setBurner(true); api.step(45);`);
  s = await state(page);
  check('水平 → 遅れて逆流し割れる', s.broken && /流れ戻/.test(s.broken), s.broken || 'not broken');

  // 4. 先に火を消す → 石灰水が逆流
  await run(page, `api.reset(); api.setBurner(true); api.step(20); api.setBurner(false); api.step(2.0);`);
  s = await state(page);
  check('先に消火 → 石灰水が上がってくる', s.suck > 0.2 && !s.broken, `suck ${s.suck.toFixed(2)}`);
  await page.screenshot({ path: `${shots}/baking-soda-decomposition-3d-suckback.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(4);`);
  s = await state(page);
  check('放置すると石灰水の逆流で割れる', s.broken && /逆流/.test(s.broken), s.broken || 'not broken');

  // 5. 逆流中にガラス管を抜けば間に合う
  await run(page, `api.reset(); api.setBurner(true); api.step(20); api.setBurner(false); api.step(2.0); api.setLift(true); api.step(3);`);
  s = await state(page);
  check('逆流中に抜けば助かる', !s.broken && s.suck === 0 && s.log.some(l => /間に合/.test(l)));

  // 6. 口を上げても、水がたまる前に下げれば戻る
  await run(page, `api.reset(); api.setTilt('down'); api.setBurner(true); api.step(25); api.setTilt('up'); api.step(1.6); api.setTilt('down'); api.step(4);`);
  s = await state(page);
  check('途中で口を下げ直すと水が口元に戻る', !s.broken && s.log.some(l => /口元に戻/.test(l)), s.broken || '');
}

export async function ogp(page) {
  await page.addStyleTag({ content: '#ctrl,#hint{display:none!important}' });
  await run(page, `api.reset(); api.setBurner(true); api.step(16); api.view([-5.5, 11.5, 1], [-1.5, 18, 43]);`);
  await run(page, `api.step(0.05);`);
}

// ---------- 撮影部：実演動画の台本（node tools/record.mjs apps/baking-soda-decomposition-3d） ----------
// cam: 時刻ごとのカメラ（イージング補間） / cues: 時刻で発火 / watch: 状態で順に発火 / speedJs: 早送り倍率（画面に ×N 表示）
const WIDE = { target: [-4, 11, 1], pos: [2, 24, 46] };
export const videos = {
  'mouth-up-crack': {
    seconds: 13,
    speedJs: `const S = api.S; return (S.run || S.broken || !S.burner) ? 1 : 4;`,
    cam: [{ t: 0, ...WIDE }, { t: 2.2, ...WIDE }, { t: 5.5, target: [-3, 18, 0], pos: [0, 22.5, 24] }],
    cues: [
      { t: 0.3, caption: '試験管の口を「上げて」加熱すると…', hold: 2.6 },
      { t: 0.9, click: '#tilt [data-t=up]' },
      { t: 1.8, click: '#bBurn' },
    ],
    watch: [
      { when: `return !!api.S.run`, caption: '口元で冷えた水が、熱い底へ流れ戻る', hold: 3.2 },
      { when: `return !!api.S.broken`, caption: '急に冷やされたガラスが割れる', hold: 2.6 },
      { after: 2.8, caption: 'だから「口を少し下げて」加熱する', hold: 4 },
    ],
  },
  'suck-back-save': {
    seconds: 11,
    setup: `api.reset(); api.setBurner(true); api.step(22);`,
    cam: [{ t: 0, target: [-11, 11, 1], pos: [-5, 21, 36] }, { t: 5, target: [-16, 10.5, 2], pos: [-11.5, 16.5, 26] }, { t: 11, target: [-16, 10.5, 2], pos: [-10.5, 17, 27] }],
    cues: [
      { t: 0.2, caption: 'ガラス管を石灰水に入れたまま火を消すと…', hold: 2.6 },
      { t: 1.2, click: '#bBurn' },
      { t: 4.2, click: '#bLift' },
    ],
    watch: [
      { when: `return api.S.suck > 0.05`, caption: '石灰水が逆流してくる！', hold: 2.2 },
      { when: `return api.S.suck === 0 && !api.S.sucking`, caption: 'ガラス管を抜けば、ギリギリ間に合う', hold: 2.8 },
      { after: 2.9, caption: '火を消す前に、ガラス管を石灰水から抜く', hold: 3.2 },
    ],
  },
  'full-experiment': {
    seconds: 24,
    speedJs: `const S = api.S; return (S.burner && api.conv() < 0.995) ? 6 : (!S.burner && S.T > 58 ? 8 : 1);`,
    cam: [{ t: 0, ...WIDE }, { t: 9, target: [-7, 11, 1], pos: [-12, 23, 42] }, { t: 16, target: [-1, 9, 2], pos: [8, 21, 42] }, { t: 24, target: [1, 8, 3], pos: [10, 19, 38] }],
    cues: [
      { t: 0.3, caption: '正しい手順：口を少し下げて加熱', hold: 2.8 },
      { t: 1.0, click: '#bBurn' },
    ],
    watch: [
      { when: `return api.S.turb > 0.15`, caption: '石灰水が白くにごる → CO₂', hold: 2.4 },
      { when: `return api.conv() > 0.995`, click: '#bLift', caption: 'まずガラス管を石灰水から抜いて', hold: 1.8 },
      { after: 1.2, click: '#bBurn', caption: 'それから火を消す', hold: 1.6 },
      { when: `return api.S.T < 58`, click: '#bCo', caption: '塩化コバルト紙：青 → 桃（水）', hold: 2.6 },
      { after: 2.8, click: '#bPh', caption: 'フェノールフタレイン：残った物質のほうが濃い赤', hold: 3.2 },
      { after: 3.4, caption: '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂', hold: 4 },
    ],
  },
};
