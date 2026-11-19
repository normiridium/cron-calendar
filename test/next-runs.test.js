const test = require('node:test');
const assert = require('node:assert/strict');

const { nextRuns, zoneOffsetMs, formatRun } = require('../src/cron-editor.js');

const at = (iso) => new Date(iso);
const fmt = (list, timeZone) => list.map((date) => {
  const options = { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('sv-SE', options).format(date); // ISO-подобный формат
});

test('ежедневный запуск: пять ближайших дней подряд', () => {
  const runs = nextRuns('0 9 * * *', { from: at('2026-11-18T05:00:00Z'), count: 5, timeZone: 'Europe/Moscow' });
  assert.equal(runs.length, 5);
  assert.deepEqual(fmt(runs, 'Europe/Moscow'), [
    '2026-11-18 09:00', '2026-11-19 09:00', '2026-11-20 09:00', '2026-11-21 09:00', '2026-11-22 09:00'
  ]);
});

test('шаг по минутам и часам', () => {
  // отсчёт строго после «сейчас»: 08:00 ровно — это уже текущая минута
  const quarter = nextRuns('*/15 * * * *', { from: at('2026-11-18T05:00:30Z'), count: 3, timeZone: 'Europe/Moscow' });
  assert.deepEqual(fmt(quarter, 'Europe/Moscow'), ['2026-11-18 08:15', '2026-11-18 08:30', '2026-11-18 08:45']);
  const daily = nextRuns('30 23 * * *', { from: at('2026-11-18T05:00:00Z'), count: 2, timeZone: 'Europe/Moscow' });
  assert.deepEqual(fmt(daily, 'Europe/Moscow'), ['2026-11-18 23:30', '2026-11-19 23:30']);
});

test('день недели: рабочие дни', () => {
  // 2026-11-18 — среда
  const runs = nextRuns('0 9 * * 1-5', { from: at('2026-11-20T20:00:00Z'), count: 3, timeZone: 'Europe/Moscow' });
  assert.deepEqual(fmt(runs, 'Europe/Moscow'), ['2026-11-23 09:00', '2026-11-24 09:00', '2026-11-25 09:00']);
});

test('31 февраля: запусков нет', () => {
  assert.deepEqual(nextRuns('0 0 31 2 *', { from: at('2026-11-18T05:00:00Z'), count: 3 }), []);
});

test('29 февраля срабатывает только в високосный год', () => {
  const runs = nextRuns('0 0 29 2 *', { from: at('2026-11-18T05:00:00Z'), count: 1, timeZone: 'UTC' });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].toISOString().slice(0, 10), '2028-02-29');
});

test('день месяца и день недели ограничены оба — правило ИЛИ, как в cron', () => {
  // 13-е ИЛИ пятница: ближайшее после 2026-11-18 12:00 UTC — 20 ноября (пятница)
  const runs = nextRuns('0 12 13 * 5', { from: at('2026-11-18T13:00:00Z'), count: 3, timeZone: 'UTC' });
  assert.deepEqual(fmt(runs, 'UTC'), ['2026-11-20 12:00', '2026-11-27 12:00', '2026-12-04 12:00']);
});

test('звёздочка в дне месяца игнорирует число', () => {
  const runs = nextRuns('0 0 * * 1', { from: at('2026-11-18T05:00:00Z'), count: 2, timeZone: 'UTC' });
  assert.deepEqual(fmt(runs, 'UTC'), ['2026-11-23 00:00', '2026-11-30 00:00']);
});

test('смещение часового пояса считается через Intl', () => {
  const date = at('2026-11-18T05:00:00Z');
  assert.equal(zoneOffsetMs(date, 'Europe/Moscow'), 3 * 3600 * 1000);
  assert.equal(zoneOffsetMs(date, 'UTC'), 0);
  assert.equal(zoneOffsetMs(date, 'Asia/Tokyo'), 9 * 3600 * 1000);
  assert.equal(zoneOffsetMs(date, ''), null);
});

test('пустое выражение и неизвестный токен не дают запусков', () => {
  assert.deepEqual(nextRuns('', { count: 2 }), []);
  assert.deepEqual(nextRuns('0 0 JAN * *', { count: 2 }), []);
});

test('строка запуска: полное название месяца и без запятой перед временем', () => {
  const run = new Date('2026-11-20T06:30:00Z'); // пятница, 09:30 МСК
  const ru = formatRun(run, 'ru', 'Europe/Moscow');
  const en = formatRun(run, 'en', 'Europe/Moscow');
  assert.equal(ru, 'пт, 20 ноября в 09:30');
  assert.equal(en, 'Fri, November 20 at 09:30');
  [ru, en].forEach((text) => {
    assert.ok(!text.includes('нояб.'), 'месяц полный, без сокращения');
    assert.ok(!/,\s*\d{2}:\d{2}/.test(text), 'перед временем нет запятой');
    assert.match(text, /\d{2}:\d{2}$/);
  });
  assert.equal(formatRun(run, 'de', 'Europe/Moscow'), 'Fr., 20. November um 09:30');
});
