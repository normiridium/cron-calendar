const test = require('node:test');
const assert = require('node:assert/strict');

const { formatToken } = require('../src/cron-editor.js');

const MIN = { key: 'min', min: 0, max: 59 };
const HOUR = { key: 'hour', min: 0, max: 23 };
const DOM = { key: 'dom', min: 1, max: 31 };
const MONTH = { key: 'month', min: 1, max: 12 };
const DOW = { key: 'dow', min: 0, max: 6 };

const CONFIGS = [MIN, HOUR, DOM, MONTH, DOW];

test('формат: известные пары (регресс-набор)', () => {
  const cases = [
    [MIN, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58], '*/2'],
    [MIN, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58], '*/5,58'],
    [MIN, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58, 59], '*/5,58-59'],
    [MIN, [0, 15, 30, 45], '*/15'],
    [MIN, [1, 2, 3, 4, 5], '1-5'],
    [HOUR, [19, 20, 22, 23], '19-20,22-23'],
    [MIN, [2, 4, 6, 10], '2,4,6,10'],
    [MIN, [1, 3, 5], '1,3,5'],
    [MIN, [11, 14, 29], '11,14,29'],
    [HOUR, [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23], '1-22/3,2-23/3'],
    [HOUR, [1, 4, 7, 10, 13, 16, 19, 22], '1-22/3'],
    [HOUR, [2, 5, 8, 11, 14, 17, 20, 23], '2-23/3'],
    [MIN, [0, 5, 7, 10, 15, 20, 25, 28, 30, 35, 40, 45, 50, 53, 55, 59], '*/5,7,28,53,59'],
  ];
  cases.forEach(([cfg, values, expected]) => {
    assert.equal(formatToken(values, cfg), expected, `набор ${values.join(',')}`);
  });
});

test('формат: пустой набор и полный диапазон дают звёздочку', () => {
  assert.equal(formatToken([], MIN), '*');
  const all = [];
  for (let v = 0; v <= 59; v += 1) all.push(v);
  assert.equal(formatToken(all, MIN), '*');
});

test('формат: при равной длине выигрывает перечисление', () => {
  // 2-6/2,10 и 2,4,6,10 — по 8 символов
  assert.equal(formatToken([2, 4, 6, 10], MIN), '2,4,6,10');
  assert.equal(formatToken([2, 4, 6, 10], MIN, { preferEnumeration: false }), '2-6/2,10');
});

test('формат: прогрессия только если короче перечисления того, что накрывает', () => {
  // 7-53/23 накрывает 7,30,53, но 30 уже занято */5 — остаток 7,53 перечислить короче
  const values = [0, 5, 7, 10, 15, 20, 25, 28, 30, 35, 40, 45, 50, 53, 55, 59];
  const token = formatToken(values, MIN);
  assert.equal(token, '*/5,7,28,53,59');
  assert.ok(!token.includes('7-53/23'));
});

test('формат: токен никогда не длиннее простого перечисления', () => {
  const random = (seed) => {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  };
  const rnd = random(20261118);
  CONFIGS.forEach((cfg) => {
    const span = cfg.max - cfg.min + 1;
    for (let n = 0; n < 400; n += 1) {
      const density = rnd();
      const values = [];
      for (let i = 0; i < span; i += 1) {
        if (rnd() < density) values.push(cfg.min + i);
      }
      if (values.length === 0 || values.length === span) continue;
      const token = formatToken(values, cfg);
      const plain = values.join(',');
      assert.ok(token.length <= plain.length, `${cfg.key}: ${token} длиннее ${plain}`);
    }
  });
});
