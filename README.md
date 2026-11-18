# cron-calendar

A dependency-free visual editor for cron expressions, shipped as one custom element.

`<cron-editor>` renders the five cron fields as clickable grids (minutes, hours, days,
months, weekdays), keeps a plain text input as the source of truth, and folds long
value lists into compact cron syntax on its own.

```html
<script src="src/cron-editor.js"></script>
<cron-editor value="*/5,58 19-20,22-23 11,14,29 1,4,6 1-2"></cron-editor>
```

No bundler, no framework, no Bootstrap: markup lives in a shadow root, so nothing leaks
in either direction. Only the cron grid itself is shipped — you style the host page.

## Why it exists

Cron pickers usually give you five dropdowns with 60 checkboxes each, and the result is
hard to read: `0,5,10,15,20,25,30,35,40,45,50,55,58` instead of `*/5,58`. This component
does the opposite — every field is a calendar-like grid where the selected values are
highlighted, and the expression shown next to it is folded to the shortest correct form.

It also refuses to lie about dates: `31` in February is marked red (that day never
happens), `31` with February and July selected is yellow (it fires in July, skips
February). Leap years are respected — `29 February` is valid.

## Install

Copy the single file into your project — that is the whole install:

```bash
curl -O https://raw.githubusercontent.com/normiridium/cron-calendar/main/src/cron-editor.js
```

```html
<script src="/static/cron-editor.js"></script>
<cron-editor value="0 9 * * 1-5"></cron-editor>
```

`src/cron-editor.js` registers the element as `<cron-editor>` and also exposes
`window.CronEditor`.

## API

| member | description |
|---|---|
| `el.value` | expression string, five space-separated fields. Setting it re-renders without firing events. |
| `el.values` | `{min: [...], hour: [...], dom: [...], month: [...], dow: [...]}` |
| `el.setValues({min: [0, 15, 30, 45]})` | same as `value`, but with number sets |
| `change` event | `detail: {value, values}`, fired only on user actions (cell click, token edit, blur) |
| `open` / `close` events | popover mode: panel opened / closed |

Static helpers, handy for tests and for formatting cron strings server-side in Node:

```js
const { formatToken, parseToken } = require('cron-calendar'); // or ./src/cron-editor.js

parseToken('*/5,58', { min: 0, max: 59 }).values; // [0,5,…,55,58]
formatToken([2, 4, 6, 10], { min: 0, max: 59 });  // '2,4,6,10'
```

## Flags

All behaviour is switched by attributes or properties — no checkboxes in the markup.

| attribute | property | default | effect |
|---|---|---|---|
| `mode` | `el.mode` | `always` | `always` — grid is visible; `popover` — the component renders its own input and drops the grid down on focus |
| `fields` | — | `min,hour,dom,month,dow` | subset of fields to render, e.g. `fields="min,hour"` |
| `week-start` | `el.weekStart` | `sun` | `sun` — 4 columns, rows 4+3; `mon` — 5 columns, weekdays 5 + weekend 2 |
| `enumeration` | `el.preferEnumeration` | on | on ties in token length the enumeration wins (`2,4,6,10`); `enumeration="off"` prefers the step form (`2-6/2,10`) |

```html
<cron-editor week-start="mon" mode="popover" enumeration="off"></cron-editor>
```

`week-start` only changes the visual order: cron semantics stay intact, `0` is still
Sunday, and clicking "Sun" in Monday mode appends `0`, not `7`.

## How the expression is folded

`formatToken` builds candidates and keeps the shortest:

1. **enumeration** — consecutive values collapsed into ranges: `1,2,3,4,5` → `1-5`;
2. **progressions** — arithmetic sequences with any step and phase, built only from values
   that are actually selected, so a progression can never imply an extra value;
3. greedy cover over those progressions, remainder appended as enumeration.

| selected values | token |
|---|---|
| `0,2,4,…,58` | `*/2` |
| `0,5,10,…,55,58` | `*/5,58` |
| `0,15,30,45` | `*/15` |
| `19,20,22,23` | `19-20,22-23` |
| `1,2,4,5,7,8,…` | `1-22/3,2-23/3` |
| `2,4,6,10` | `2,4,6,10` (tie — enumeration wins) |
| `*/5,7,28,53,59` | `*/5,7,28,53,59` (`7-53/23` would be longer) |

A progression is only accepted when it is shorter than enumerating what it actually
covers. Two invariants, both covered by tests:

- `parseToken(formatToken(values)) === values` for any non-empty set;
- the produced token is never longer than a plain comma-separated list.

## Date validation

Per selected value:

- **red** — the day does not exist in any selected month (`31` with February only), or the
  month cannot host any of the selected days — the schedule never fires;
- **yellow** — the day is missing in some of the selected months (`31` with `Feb,Jul`) —
  those months are skipped, the rest fire;
- no colour — everything lines up.

Tooltips spell out what is missing ("31-го числа не бывает в: февраль"). Warnings are
advisory: the value is still settable and the schedule still saves.

## Theming

Style the host element with CSS custom properties — the shadow DOM reads them:

```css
cron-editor {
  --cron-border: #3a3f46;         /* frame of the whole grid */
  --cron-accent: #2f7d5d;         /* selected cell */
  --cron-accent-text: #eaf6f0;
  --cron-label: #7b838d;          /* field labels */
  --cron-cell-bg, --cron-cell-border, --cron-cell-color;
  --cron-focus: #4d90fe;
  --cron-input-bg: #0b0d10;       /* token input while focused */
  --cron-panel-bg: #14171b;       /* popover panel */
  --cron-panel-max-width: calc(100vw - 3rem);
  --cron-warn: #ffc107;
  --cron-error: #dc3545;
  --cron-cell-w: 1.9rem;          /* cell size */
  --cron-cell-gap: .2rem;
}
```

Layout details worth knowing: the gap between field blocks equals one cell step, and the
block width is defined by its cells only — so `minute(12) + hour(6)` and
`day(8) + month(4) + weekdays(5)` end on the same right edge.

## Demo

Open `demo/index.html` directly from disk (`file://`) — no server needed. It shows the
default layout, Monday-first week with the popover, date validation and the enumeration
flag.

## Tests

```bash
npm test          # node --test test/*.test.js
```

No test dependencies: `node:test` plus property tests over the formatter and parser
(canonical token table, tie-breaking, "never longer than enumeration", round-trip
`parse(format(x)) === x` on thousands of random sets).

## Browser support

`customElements` + shadow DOM: Chrome 54+, Firefox 63+, Safari 10.1+, Edge 79+. No
polyfills bundled.

## License

MIT — see [LICENSE](LICENSE).
