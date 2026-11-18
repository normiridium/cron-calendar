const test = require('node:test');
const assert = require('node:assert/strict');

const { parseToken, formatToken, splitExpression, FIELDS } = require('../src/cron-editor.js');

const MIN = FIELDS.min;
const HOUR = FIELDS.hour;
const DOM = FIELDS.dom;
const MONTH = FIELDS.month;
const DOW = FIELDS.dow;

const CONFIGS = [MIN, HOUR, DOM, MONTH, DOW];

test('разбор: звёздочка и пустое значение', () => {
  assert.deepEqual(parseToken('*', MIN), { star: true, values: [], raw: '' });
  assert.deepEqual(parseToken('', MIN), { star: true, values: [], raw: '' });
});

test('разбор: перечисление, диапазон и шаг', () => {
  assert.deepEqual(parseToken('1,5,10', MIN).values, [1, 5, 10]);
  assert.deepEqual(parseToken('1-5', MIN).values, [1, 2, 3, 4, 5]);
  assert.deepEqual(parseToken('*/15', MIN).values, [0, 15, 30, 45]);
  assert.deepEqual(parseToken('10-50/10', MIN).values, [10, 20, 30, 40, 50]);
});

test('разбор: смешанный синтаксис из нескольких частей', () => {
  assert.deepEqual(parseToken('*/5,58', MIN).values, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58]);
  assert.deepEqual(parseToken('19-20,22-23', HOUR).values, [19, 20, 22, 23]);
  assert.deepEqual(parseToken('1-22/3,2-23/3', HOUR).values.length, 16);
});

test('разбор: значения вне диапазона поля — невалидно', () => {
  assert.deepEqual(parseToken('60', MIN).values, []);
  assert.deepEqual(parseToken('0', DOM).values, []);
  assert.deepEqual(parseToken('7', DOW).values, []);
  assert.deepEqual(parseToken('13', MONTH).values, []);
  assert.deepEqual(parseToken('5-1', MIN).values, []);
  assert.deepEqual(parseToken('*/0', MIN).values, []);
});

test('разбор: имена месяцев и дней не раскладываются в ячейки', () => {
  assert.deepEqual(parseToken('JAN', MONTH).values, []);
  assert.deepEqual(parseToken('MON', DOW).values, []);
});

test('инвариант: разбор того, что отформатировали, даёт исходный набор', () => {
  const random = (seed) => {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  };
  const rnd = random(424242);
  let checked = 0;
  let failures = [];
  CONFIGS.forEach((cfg) => {
    const span = cfg.max - cfg.min + 1;
    for (let n = 0; n < 600; n += 1) {
      const density = rnd();
      const values = [];
      for (let i = 0; i < span; i += 1) {
        if (rnd() < density) values.push(cfg.min + i);
      }
      if (values.length === 0 || values.length === span) continue;
      const token = formatToken(values, cfg);
      const back = parseToken(token, cfg).values;
      checked += 1;
      if (back.join(',') !== values.join(',')) {
        failures.push({ field: cfg.key, values, token, back });
      }
    }
  });
  assert.deepEqual(failures, [], `проверено ${checked} наборов`);
  assert.ok(checked > 2000, `проверено всего ${checked} наборов`);
});

test('splitExpression добивает недостающие поля звёздочкой', () => {
  assert.deepEqual(splitExpression('0 9 * * *', 5), ['0', '9', '*', '*', '*']);
  assert.deepEqual(splitExpression('30 23', 5), ['30', '23', '*', '*', '*']);
  assert.deepEqual(splitExpression('', 5), ['*', '*', '*', '*', '*']);
});
