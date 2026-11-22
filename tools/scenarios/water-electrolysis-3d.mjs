// 水の電気分解：正しい手順と、定番の失敗を検証
const H = '__elec';
const run = (page, fn) => page.evaluate(([h, f]) => new Function('api', f)(window[h]), [H, fn]);
const state = (page) => run(page, `const S = api.S, t = api.tubes; return { L: t[0].gas, R: t[1].gas, kL: t[0].kind, kR: t[1].kind, I: S.I, simT: S.simT, on: S.on, rev: S.rev,
  log: [...document.querySelectorAll('#log li')].map(l => l.textContent), toast: document.getElementById('toast').textContent };`);
const faraday = (I, t, z) => I * t / (z * 96485) * 24500;

export async function scenarios(page, check, shots) {
  // 1. 正しい手順（9 V・水酸化ナトリウム水溶液）
  await run(page, `api.reset(); api.setVolt(9); api.setPower(true); api.step(15);`);
  let s = await state(page);
  check('電流 0.36 A（(9−1.8)/20 Ω）', Math.abs(s.I - 0.36) < 0.005, `${s.I.toFixed(3)} A`);
  const eH = faraday(s.I, s.simT, 2) - 0.25, eO = faraday(s.I, s.simT, 4) - 0.5;
  check('陰極の水素がファラデーの法則どおり', Math.abs(s.L - eH) < 0.15, `${s.L.toFixed(2)} mL（理論 ${eH.toFixed(2)}）`);
  check('陽極の酸素がファラデーの法則どおり', Math.abs(s.R - eO) < 0.15, `${s.R.toFixed(2)} mL（理論 ${eO.toFixed(2)}）`);
  check('体積比 2：1 に近い', s.L / s.R > 1.95 && s.L / s.R < 2.2, (s.L / s.R).toFixed(3));
  check('記録に「2倍」', s.log.some(l => /2倍/.test(l)));
  await page.screenshot({ path: `${shots}/water-electrolysis-3d-running.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.startTest(0); api.step(1);`);
  s = await state(page);
  check('電源を入れたまま調べられない', s.toast.includes('電源を切って'));
  await run(page, `api.setPower(false); api.setTool('match'); api.startTest(0); api.step(1.2);`);
  s = await state(page);
  check('陰極の気体にマッチ → ポン（水素）', s.log.some(l => /ポンと音を立てて燃えた → 水素/.test(l)));
  await page.screenshot({ path: `${shots}/water-electrolysis-3d-pop.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(3.5); api.setTool('incense'); api.startTest(1); api.step(1.6);`);
  s = await state(page);
  check('陽極の気体に線香 → 炎を上げる（酸素）', s.log.some(l => /炎を上げて激しく燃えた → 酸素/.test(l)));
  await page.screenshot({ path: `${shots}/water-electrolysis-3d-incense.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.step(4);`);
  s = await state(page);
  check('調べた後は気体が出ていく', s.L < 0.05 && s.R < 0.05, `${s.L.toFixed(2)} / ${s.R.toFixed(2)}`);

  // 2. 道具の取り違え
  await run(page, `api.reset(); api.setPower(true); api.step(10); api.setPower(false); api.setTool('match'); api.startTest(1); api.step(4.5); api.setTool('incense'); api.startTest(0); api.step(4.5);`);
  s = await state(page);
  check('酸素にマッチ → ポンと鳴らない', s.log.some(l => /ポンとは鳴らない/.test(l)));
  check('水素に線香 → 炎は上がらない', s.log.some(l => /炎は上がらない/.test(l)));

  // 3. 純粋な水
  await run(page, `api.reset(); api.setElec('water'); api.setPower(true); api.step(15);`);
  s = await state(page);
  check('純粋な水 → 電流がほとんど流れない', s.I < 0.005 && s.L < 0.3 && s.log.some(l => /電気を通しにくい/.test(l)), `${s.I.toFixed(4)} A, ${s.L.toFixed(2)} mL`);
  await run(page, `api.setElec('naoh'); api.step(5);`);
  s = await state(page);
  check('水酸化ナトリウムにすると流れ出す', s.I > 0.3 && s.L > 4, `${s.I.toFixed(2)} A, ${s.L.toFixed(1)} mL`);

  // 4. 活栓を開けたまま
  await run(page, `api.reset(); api.setCock(true); api.setPower(true); api.step(10);`);
  s = await state(page);
  check('活栓が開いたまま → 気体がたまらない', s.L === 0 && s.R === 0 && s.log.some(l => /逃げていく/.test(l)));

  // 5. つなぎ方を逆に
  await run(page, `api.reset(); api.setRev(true); api.setPower(true); api.step(10);`);
  s = await state(page);
  check('逆につなぐ → 多くたまるのが右側に', s.R > s.L * 1.9 && s.kR === 'H2', `${s.L.toFixed(1)} / ${s.R.toFixed(1)}`);
  await run(page, `api.setPower(false); api.setRev(false);`);
  s = await state(page);
  check('気体が残っているとつなぎ方を変えられない（混合気体を作らない）', s.rev === true);
  await run(page, `api.setTool('match'); api.startTest(1); api.step(1.2);`);
  s = await state(page);
  check('逆につないだときは右の管が水素', s.log.some(l => /右の管：マッチ.*水素/.test(l)));

  // 6. 電圧が低すぎる
  await run(page, `api.reset(); api.setVolt(1.5); api.setPower(true); api.step(5);`);
  s = await state(page);
  check('1.5 V では電気分解が起こらない', s.I === 0 && s.log.some(l => /電圧が低すぎて/.test(l)));

  // 7. 目盛りいっぱいで自動停止
  await run(page, `api.reset(); api.setVolt(12); api.setPower(true); api.step(40);`);
  s = await state(page);
  check('30 mL で自動的に電源が切れる', !s.on && s.L <= 30.6 && s.L >= 29.9, `${s.L.toFixed(1)} mL`);
  await run(page, `api.reset(); api.setVolt(9);`);
}

export async function ogp(page) {
  await page.addStyleTag({ content: '#ctrl,#hint{display:none!important}' });
  await run(page, `api.reset(); api.setPower(true); api.step(11); api.view([2.5, 12.5, 1], [6, 18, 45]);`);
  await run(page, `api.step(0.05);`);
}

// ---------- 撮影部：実演動画の台本 ----------
const WIDE = { target: [5, 11.5, 1], pos: [10, 19.5, 62] };
const TOPS = { target: [0, 24, 0], pos: [4, 27.5, 30] };
export const videos = {
  'ratio-pop': {
    seconds: 23,
    speedJs: `const S = api.S; return (S.on && api.tubes[api.cathode()].gas < 20) ? 2 : 1;`,
    cam: [{ t: 0, ...WIDE }, { t: 8, ...WIDE }, { t: 10, ...TOPS }, { t: 23, target: [0, 24, 0], pos: [5, 28, 31] }],
    cues: [
      { t: 0.3, caption: '陰極と陽極、たまる気体の量は？', hold: 2.6 },
      { t: 1.0, click: '#bPow' },
    ],
    watch: [
      { when: `return api.tubes[api.cathode()].gas > 12`, caption: '陰極：陽極 ＝ 2：1', hold: 3 },
      { when: `return api.tubes[api.cathode()].gas > 20`, click: '#bPow', caption: '電源を切って、気体を調べる', hold: 1.8 },
      { after: 1.0, click: '#tool [data-t=match]' },
      { after: 0.4, click: '#bTestL', caption: '陰極側にマッチの火 →「ポン」水素', hold: 3.6 },
      { after: 4.2, click: '#tool [data-t=incense]' },
      { after: 0.4, click: '#bTestR', caption: '陽極側に線香 → 炎を上げる 酸素', hold: 3.6 },
      { after: 4.0, caption: '2H₂O → 2H₂ + O₂', hold: 3 },
    ],
  },
  'pure-water': {
    seconds: 12,
    cam: [{ t: 0, ...WIDE }, { t: 3, target: [5, 8, 1], pos: [8, 13, 40] }, { t: 12, target: [5, 8, 1], pos: [9, 13, 39] }],
    cues: [
      { t: 0.3, caption: '純粋な水で電気分解すると…', hold: 2.4 },
      { t: 0.7, click: '#elec [data-e=water]' },
      { t: 1.5, click: '#bPow' },
      { t: 3.0, caption: '電流がほとんど流れず、泡も出ない', hold: 3 },
      { t: 6.3, click: '#elec [data-e=naoh]', caption: '水酸化ナトリウムを溶かすと…', hold: 1.8 },
      { t: 8.3, caption: '電流が流れて、気体が出てくる', hold: 3.5 },
    ],
  },
  'reverse': {
    seconds: 13,
    speedJs: `const S = api.S; return (S.on && api.tubes[1].gas < 16) ? 2 : 1;`,
    cam: [{ t: 0, ...WIDE }, { t: 13, target: [2, 12, 1], pos: [7, 19, 50] }],
    cues: [
      { t: 0.3, caption: 'つなぎ方を逆にすると？', hold: 2.2 },
      { t: 0.9, click: '#bRev' },
      { t: 1.8, click: '#bPow' },
    ],
    watch: [
      { when: `return api.tubes[1].gas > 9`, caption: '多くたまるのは右側に変わった', hold: 3 },
      { when: `return api.tubes[1].gas > 16`, click: '#bPow' },
      { after: 0.6, caption: '気体が多い側 ＝ 陰極（−）＝ 水素', hold: 3.4 },
    ],
  },
};
