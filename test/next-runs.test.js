const test = require('node:test');
const assert = require('node:assert/strict');

const { nextRuns, zoneOffsetMs, formatRun, formatRuns, normalizeRunFormat, RUN_SEPARATOR } = require('../src/cron-editor.js');

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

test('строка запуска: по умолчанию без дня недели, полный месяц, без предлогов', () => {
  const run = new Date('2026-11-20T06:30:00Z'); // пятница, 09:30 МСК
  const W = '\u2002'; // широкий пробел между датой и временем
  assert.equal(formatRun(run, 'ru', 'Europe/Moscow'), '20 ноября' + W + '09:30');
  assert.equal(formatRun(run, 'en', 'Europe/Moscow'), 'November 20' + W + '09:30');
  assert.equal(formatRun(run, 'de', 'Europe/Moscow'), '20. November' + W + '09:30');
  const ru = formatRun(run, 'ru', 'Europe/Moscow');
  assert.ok(!ru.includes('пт'), 'день недели не выводится');
  assert.ok(!ru.includes('нояб.'), 'месяц полный');
  assert.ok(!/\sв\s/.test(ru), 'предлог «в» не ставится');
  assert.ok(!/,\s*\d{2}:\d{2}/.test(ru), 'перед временем нет запятой');
});

test('формат строки задаётся флагом run-format', () => {
  const run = new Date('2026-11-20T06:30:00Z');
  assert.equal(formatRun(run, 'ru', 'Europe/Moscow', 'weekday day month time'), 'пт, 20 ноября\u200209:30');
  assert.equal(formatRun(run, 'ru', 'Europe/Moscow', 'time'), '09:30');
  assert.equal(formatRun(run, 'ru', 'Europe/Moscow', 'day month'), '20 ноября');
  assert.equal(formatRun(run, 'ru', 'Europe/Moscow', ['day', 'month']), '20 ноября');
  assert.deepEqual(normalizeRunFormat(''), ['day', 'month', 'time']);
  assert.deepEqual(normalizeRunFormat('day month time'), ['day', 'month', 'time']);
  assert.deepEqual(normalizeRunFormat('weekday day month time'), ['weekday', 'day', 'month', 'time']);
  assert.deepEqual(normalizeRunFormat('time day'), ['time', 'day']);
  assert.deepEqual(normalizeRunFormat('мусор'), ['day', 'month', 'time'], 'неизвестные токены игнорируются');
});

test('строка запуска: широкий пробел между датой и временем, обычный — между днём и месяцем', () => {
  const run = new Date('2026-11-20T06:30:00Z');
  ['pl', 'es', 'tr'].forEach((locale) => {
    const text = formatRun(run, locale, 'Europe/Moscow');
    assert.ok(text.includes('\u2002'), `${locale}: ожидался широкий пробел, получено ${JSON.stringify(text)}`);
    assert.ok(!/,\s*\d{2}:\d{2}$/.test(text.replace(/\u2002/g, ' ')), `${locale}: запятая перед временем`);
  });
  // zh: «日» — суффикс дня, он липнет к числу, перед временем обычный пробел
  const zh = formatRun(run, 'zh', 'Europe/Moscow');
  assert.match(zh, /20日\s?\d{2}:\d{2}$/, `zh: ${JSON.stringify(zh)}`);
  assert.ok(!zh.includes(' 日'), 'суффикс 日 не отделяется пробелом');

  const ru = formatRun(run, 'ru', 'Europe/Moscow');
  assert.equal(ru, '20 ноября\u200209:30');
  assert.ok(!ru.includes(' в '), 'предлог «в» выброшен в любом языке');
});

test('перечисление запусков: запятая и широкий пробел', () => {
  const runs = nextRuns('0 9 * * *', { from: new Date('2026-11-18T05:00:00Z'), count: 3, timeZone: 'Europe/Moscow' });
  assert.equal(RUN_SEPARATOR, ',\u2002', 'после запятой — широкий пробел, а не обычный');
  const line = runs.map((run) => formatRun(run, 'ru', 'Europe/Moscow')).join(RUN_SEPARATOR);
  assert.equal(line, '18 ноября\u200209:00,\u200219 ноября\u200209:00,\u200220 ноября\u200209:00');
  assert.equal(line.split(RUN_SEPARATOR).length, 3);
});

test('ежегодное расписание: строки не повторяются, добавляется год', () => {
  const runs = nextRuns('0 10 26 9 *', { from: new Date('2026-11-18T05:00:00Z'), count: 3, timeZone: 'Europe/Moscow' });
  const texts = formatRuns(runs, 'ru', 'Europe/Moscow');
  assert.equal(texts.length, 3, 'три разных запуска, а не три одинаковые строки');
  assert.equal(new Set(texts).size, 3);
  assert.equal(texts[0], '26 сентября 2027\u200210:00');
  assert.equal(texts[2], '26 сентября 2029\u200210:00');
});

test('частые запуски год не получают', () => {
  const runs = nextRuns('0 9 * * *', { from: new Date('2026-11-18T05:00:00Z'), count: 3, timeZone: 'Europe/Moscow' });
  const texts = formatRuns(runs, 'ru', 'Europe/Moscow');
  assert.deepEqual(texts, ['18 ноября\u200209:00', '19 ноября\u200209:00', '20 ноября\u200209:00']);
  texts.forEach((text) => assert.ok(!/20\d{2}/.test(text), 'года в строке нет'));
});

test('строки, которые всё равно совпали, схлопываются', () => {
  const runs = nextRuns('0 10 * * *', { from: new Date('2026-11-18T05:00:00Z'), count: 3, timeZone: 'Europe/Moscow' });
  const onlyTime = formatRuns(runs, 'ru', 'Europe/Moscow', 'time');
  assert.deepEqual(onlyTime, ['10:00'], 'три одинаковых «10:00» дают одну строку');
});
