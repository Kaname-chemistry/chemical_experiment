// 化学のクリスマスツリー（金属樹）：組み合わせごとの反応と、遊びの機能を検証
const H = '__tree';
const run = (page, fn) => page.evaluate(([h, f]) => new Function('api', f)(window[h]), [H, fn]);
const state = (page) => run(page, `const S = api.S; return { conv: api.conv(), dep: api.deposit(), dis: api.dissolved(), cu: api.solutionColor().cu,
  ...api.counts(), inB: S.inBeaker, wire: S.wire, sol: S.sol, log: [...document.querySelectorAll('#log li')].map(l => l.textContent),
  eq: document.getElementById('eq').textContent, sname: document.getElementById('sname').textContent };`);

export async function scenarios(page, check, shots) {
  // 1. 銅線 ＋ 硝酸銀（主役）
  await run(page, `api.reset(); api.setWire('Cu'); api.setSol('Ag'); api.insert(); api.step(2); api.step(12);`);
  let s = await state(page);
  check('銀の結晶が伸び始める', s.needles > 50 && s.conv > 0.1, `needles ${s.needles}, ${(s.conv * 100).toFixed(0)}%`);
  check('組み合わせは変えられない（入れた後）', await run(page, `api.setWire('Zn'); return api.S.wire;`) === 'Cu');
  await run(page, `api.step(30);`);
  s = await state(page);
  check('銀と銅の質量比 3.39（2×107.87 / 63.55）', Math.abs(s.dep / s.dis - 3.395) < 0.01, (s.dep / s.dis).toFixed(3));
  check('ほぼ完成で銀 約431 mg', s.conv > 0.9 && Math.abs(s.dep - 431.5 * s.conv) < 1, `${s.dep.toFixed(0)} mg`);
  check('液が青くなる', s.cu > 0.4 && /青/.test(s.sname) && s.log.some(l => /青くなって/.test(l)), s.sname);
  check('イオンの式', s.eq === 'Cu + 2Ag⁺ → Cu²⁺ + 2Ag', s.eq);
  check('完成のログ', s.log.some(l => /完成/.test(l)));
  await page.screenshot({ path: `${shots}/metal-tree-3d-silver.jpg`, type: 'jpeg', quality: 82 });
  await run(page, `api.setStar(true); api.setLight(true); api.step(2);`);
  await page.screenshot({ path: `${shots}/metal-tree-3d-lightup.jpg`, type: 'jpeg', quality: 82 });
  const len = await run(page, `return api.photo(false).length;`);
  check('写真を保存（画像を作れる）', len > 50000, `${len} chars`);
  await run(page, `api.setLight(false); api.setStar(false); api.step(2);`);

  // 2. 銅線 ＋ 硫酸亜鉛 → 何も起こらない
  await run(page, `api.reset(); api.setWire('Cu'); api.setSol('Zn'); api.insert(); api.step(20);`);
  s = await state(page);
  check('銅 ＋ 硫酸亜鉛は反応しない', s.conv === 0 && s.needles === 0 && s.blobs === 0 && s.log.some(l => /イオンになりにくい/.test(l)) && s.eq === '反応しない');

  // 3. 同じ金属
  await run(page, `api.reset(); api.setWire('Cu'); api.setSol('Cu'); api.insert(); api.step(10);`);
  s = await state(page);
  check('同じ金属どうしは変化しない', s.conv === 0 && s.log.some(l => /同じ金属/.test(l)));

  // 4. 亜鉛線 ＋ 硫酸銅
  await run(page, `api.reset(); api.setWire('Zn'); api.setSol('Cu'); api.insert(); api.step(2); api.step(25);`);
  s = await state(page);
  check('亜鉛 ＋ 硫酸銅 → 銅が出る', s.blobs > 200 && s.conv > 0.9, `blobs ${s.blobs}`);
  check('銅と亜鉛の質量比（63.55 / 65.38）', Math.abs(s.dep / s.dis - 63.55 / 65.38) < 0.005, (s.dep / s.dis).toFixed(4));
  check('青色がうすくなる', s.cu < 0.15 && s.log.some(l => /うすくなって/.test(l)), s.sname);
  await page.screenshot({ path: `${shots}/metal-tree-3d-copper.jpg`, type: 'jpeg', quality: 82 });

  // 5. マグネシウム ＋ 硫酸亜鉛 → 亜鉛が出る＋水素の泡
  await run(page, `api.reset(); api.setWire('Mg'); api.setSol('Zn'); api.insert(); api.step(2); api.step(6);`);
  s = await state(page);
  check('マグネシウム ＋ 硫酸亜鉛 → 亜鉛が出て泡も出る', s.needles > 50 && s.bubbles > 0 && s.log.some(l => /水素の泡/.test(l)), `needles ${s.needles}, bubbles ${s.bubbles}`);

  // 6. 亜鉛線 ＋ 硫酸マグネシウム → 反応しない
  await run(page, `api.reset(); api.setWire('Zn'); api.setSol('Mg'); api.insert(); api.step(10);`);
  s = await state(page);
  check('亜鉛 ＋ 硫酸マグネシウムは反応しない', s.conv === 0);
  await run(page, `api.reset(); api.setWire('Cu'); api.setSol('Ag');`);
}

export async function ogp(page) {
  await page.addStyleTag({ content: '#ctrl,#hint{display:none!important}' });
  await run(page, `api.reset(); api.setWire('Cu'); api.setSol('Ag'); api.insert(); api.step(2); api.step(40); api.setStar(true); api.setLight(true); api.step(2.5);
    api.view([4.2, 7.2, 0], [5.5, 13, 29]);`);
  await run(page, `api.step(0.05);`);
}

// ---------- 撮影部：実演動画の台本 ----------
const T = [3.5, 7, 0];
export const videos = {
  'silver-tree': {
    seconds: 26,
    setup: `api.reset(); api.setWire('Cu'); api.setSol('Ag'); api.setStar(false); api.setLight(false);`,
    speedJs: `const S = api.S; return (S.inBeaker && api.conv() < 0.9) ? 2.5 : 1;`,
    cam: [{ t: 0, target: T, pos: [7, 15, 34] }, { t: 9, target: T, pos: [-6, 12, 30] }, { t: 17, target: T, pos: [1, 10.5, 27] }, { t: 26, target: [3.5, 7.5, 0], pos: [8, 11, 25] }],
    cues: [
      { t: 0.3, caption: '銅線で作ったツリーを、硝酸銀水溶液に入れると…', hold: 2.8 },
      { t: 1.2, click: '#bGo' },
    ],
    watch: [
      { when: `return api.conv() > 0.12`, caption: '銀の結晶が、枝のように伸びていく', hold: 3 },
      { when: `return api.conv() > 0.5`, caption: '液が青くなるのは、銅が溶け出したから', hold: 3.2 },
      { when: `return api.conv() > 0.9`, click: '#bStar', caption: '星をのせて…', hold: 1.4 },
      { after: 1.3, click: '#bLight', caption: 'ライトアップ', hold: 1.6 },
      { after: 2.2, caption: '化学のクリスマスツリー、完成', hold: 4.5 },
    ],
  },
  'which-metal': {
    seconds: 21,
    setup: `api.reset(); api.setWire('Cu'); api.setSol('Ag'); api.setStar(false); api.setLight(false);`,
    speedJs: `const S = api.S; if (S.inBeaker && S.wire === 'Cu' && S.drop >= 1 && S.simT < 1800) return 6; return (S.inBeaker && S.wire === 'Zn' && api.conv() < 0.9) ? 3 : 1;`,
    cam: [{ t: 0, target: T, pos: [6, 13, 31] }, { t: 21, target: T, pos: [2, 11, 28] }],
    cues: [
      { t: 0.3, caption: '銅線を「硫酸亜鉛水溶液」に入れると？', hold: 2.6 },
      { t: 0.7, click: '#sol [data-s=Zn]' },
      { t: 1.4, click: '#bGo' },
      { t: 4.2, caption: '30分たっても…何も起こらない', hold: 3.6 },
      { t: 8.6, click: '#bReset' },
      { t: 9.0, click: '#wire [data-w=Zn]' },
      { t: 9.4, click: '#sol [data-s=Cu]' },
      { t: 9.7, caption: '亜鉛線を「硫酸銅水溶液」に入れると？', hold: 2.4 },
      { t: 10.2, click: '#bGo' },
    ],
    watch: [
      { when: `return api.S.wire === 'Zn' && api.conv() > 0.3`, caption: '銅が出てきた！ 青色もうすくなる', hold: 3 },
      { after: 3.3, caption: 'イオンへのなりやすさ  Zn ＞ Cu', hold: 4 },
    ],
  },
  'lightup': {
    seconds: 10,
    css: '#ctrl,#hud{display:none!important}',
    setup: `api.reset(); api.setWire('Cu'); api.setSol('Ag'); api.insert(); api.step(2); api.step(40); api.setStar(true); api.setLight(true); api.step(3);`,
    cam: [{ t: 0, target: [0, 7.5, 0], pos: [9, 12, 24] }, { t: 5, target: [0, 7.5, 0], pos: [-4, 11, 25] }, { t: 10, target: [0, 7.5, 0], pos: [-12, 12.5, 21] }],
    cues: [
      { t: 0.4, caption: '銅 ＋ 硝酸銀 → 銀のツリー', hold: 4 },
      { t: 5.2, caption: 'あなたのツリーも育ててみて', hold: 4.6 },
    ],
  },
};
