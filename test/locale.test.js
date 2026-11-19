const test = require('node:test');
const assert = require('node:assert/strict');

const { intlNames, intlWeekStart, resolveLang, LOCALES, MESSAGES } = require('../src/cron-editor.js');

test('названия месяцев приходят из Intl для любого языка', () => {
  const ru = intlNames('ru', 'month', 'short');
  const en = intlNames('en', 'month', 'short');
  assert.equal(ru.length, 12);
  assert.equal(en.length, 12);
  assert.equal(ru[0], 'янв', 'русский Intl отдаёт «янв.» — точку убираем');
  assert.deepEqual(ru, ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    'короткие месяцы подрезаны до трёх знаков');
  assert.equal(en[0], 'Jan');
  assert.notDeepEqual(ru, en);
});

test('названия дней недели: индекс 0 — воскресенье', () => {
  const ru = intlNames('ru', 'dow', 'short');
  const en = intlNames('en', 'dow', 'short');
  assert.equal(ru.length, 7);
  assert.equal(en.length, 7);
  assert.equal(ru[0], 'вс');
  assert.equal(ru[1], 'пн');
  assert.equal(en[0], 'Sun');
  assert.equal(en[1], 'Mon');
});

test('незнакомый язык всё равно получает названия из Intl', () => {
  const de = intlNames('de', 'month', 'short');
  assert.ok(Array.isArray(de) && de.length === 12);
  assert.equal(de[0], 'Jan');
  assert.equal(resolveLang('de-DE'), 'de', 'язык из пакета определяется по префиксу');
  assert.equal(resolveLang('sv-SE'), 'en', 'язык вне пакета: названия свои, фразы английские');
});

test('первый день недели по CLDR', () => {
  assert.equal(intlWeekStart('ru-RU'), 'mon');
  assert.equal(intlWeekStart('en-US'), 'sun');
  assert.equal(intlWeekStart('de'), 'mon');
});

test('словари фраз полны и совпадают по набору ключей', () => {
  assert.deepEqual(LOCALES.slice().sort(), ['de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'ru', 'tr', 'zh']);
  const required = ['fields', 'expressionAria', 'cronAria', 'dayDead', 'dayPartial', 'monthDead', 'monthPartial'];
  LOCALES.forEach((lang) => {
    required.forEach((key) => {
      assert.ok(MESSAGES[lang][key] !== undefined, `${lang}: нет ${key}`);
    });
    ['min', 'hour', 'dom', 'month', 'dow'].forEach((field) => {
      assert.equal(typeof MESSAGES[lang].fields[field], 'string', `${lang}: нет подписи ${field}`);
    });
  });
});

test('регистр подписей и заголовков по правилам языка', () => {
  // ru/fr/es/it/pt/pl/tr — строчные подписи полей, de — существительные с заглавной,
  // en — заглавная в каждом слове подписи, zh — без регистра
  assert.equal(MESSAGES.ru.fields.min, 'минута');
  assert.equal(MESSAGES.en.fields.min, 'Minute');
  assert.equal(MESSAGES.en.fields.dow, 'Day of week');
  assert.equal(MESSAGES.de.fields.min, 'Minute');
  assert.equal(MESSAGES.fr.fields.min, 'minute');
  assert.equal(MESSAGES.zh.fields.min, '分钟');
  // заголовок списка запусков всегда с заглавной и с двоеточием
  LOCALES.forEach((lang) => {
    const title = MESSAGES[lang].nextRunsTitle;
    assert.ok(title, `${lang}: нет заголовка`);
    const first = Array.from(title)[0];
    assert.equal(first, first.toUpperCase(), `${lang}: заголовок должен начинаться с заглавной — ${title}`);
    assert.match(title, /[:：]\s*$/, `${lang}: заголовок должен кончаться двоеточием — ${title}`);
  });
});

test('фразы локалей подставляют значения', () => {
  assert.match(MESSAGES.ru.dayDead(31), /31-го числа/);
  assert.match(MESSAGES.en.dayDead(31), /31st/);
  assert.match(MESSAGES.en.dayDead(22), /22nd/);
  assert.match(MESSAGES.en.dayDead(13), /13th/);
  assert.match(MESSAGES.en.monthPartial('February', '30, 31'), /February has no 30, 31/);
});
