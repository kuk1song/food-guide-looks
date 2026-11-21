/* v2: vanilla JS, no libraries. Reads window.PROTO from data.js. Generated from shared rules + v2 UI. */
(function () {
'use strict';
/* ===== shared rules (same in v1.js and v2.js; only facts from data.js) ===== */
var P = window.PROTO;
var REST = {};
P.restaurants.forEach(function (r) { REST[r.id] = r; });
var CUISINE = { duck: 'Peking duck', noodles: 'Noodles', dumplings: 'Dumplings', hotpot: 'Hotpot', snacks: 'Breakfast & snacks' };
var PRICE = { budget: '¥ Budget', mid: '¥¥ Mid' };
var AREA = { fc: 'Near the Forbidden City', dongcheng: 'Dongcheng', xicheng: 'Xicheng', chaoyang: 'Chaoyang' };
var DIET = { 'no-pork': 'No pork', peanut: 'Peanut allergy', sesame: 'Sesame allergy' };
var GROUPS = [
  { k: 'diet', opts: DIET },
  { k: 'area', opts: AREA },
  { k: 'cuisine', opts: CUISINE },
  { k: 'price', opts: PRICE }
];
var FIRST = { crowd_pleaser: 'Crowd pleaser', approachable: 'Approachable', adventurous: 'Adventurous', challenging: 'Challenging' };
var DIETNOTE = { pork: 'contains pork', high_fat: 'rich and fatty', organ_meat: 'organ meat' };
var DIVERGE = { fermented_or_pungent: 'strong smell, fermented' };
var ALG = { peanut: 'peanut', tree_nut: 'tree nuts', sesame: 'sesame', gluten: 'gluten (wheat)', soy: 'soy', shellfish: 'shellfish', fish: 'fish', egg: 'egg', dairy: 'dairy' };
var PRESENCE = { always: 'always', common: 'common', varies: 'sometimes' };
var UNCHECKED = [['hours', 'hours'], ['ordering', 'how to order'], ['payment', 'payment'], ['englishMenu', 'English menu'], ['priceBand', 'price band'], ['spendPerHead', 'spend per head']];
var EXAMPLE = 'Two of us staying near the Forbidden City, one doesn’t eat pork. We want Peking duck or noodles, mid-range.';
var NUMWORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/* session state: what the sentence produced, and what the order builder uses */
var S = { said: '', read: false, chips: { diet: [], area: [], cuisine: [], price: [] }, party: 2, diet: ['no-pork'], partyFromSentence: false };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function zh(t, cls) { return '<span lang="zh-Hans"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(t) + '</span>'; }
function splitName(n) {
  var m = String(n).match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { main: m[1], branch: m[2] } : { main: n, branch: '' };
}
function fmtDate(iso) {
  var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + m[Number(p[1]) - 1] + ' ' + p[0];
}
function lib(d) { return d && d.slug ? P.dishes[d.slug] : null; }
function verified(r) { return r.dishes.filter(function (d) { return d.verified; }); }
function single(r) { return r.dishes.filter(function (d) { return !d.verified; }); }
function libDishes(r) { return verified(r).filter(function (d) { return d.slug; }); }
function hasPork(d) { var L = lib(d); return L ? L.dietaryNotes.indexOf('pork') >= 0 : d.nameZh.indexOf('猪肉') >= 0; }
function allergen(slug, a) { return P.dishes[slug].allergens.filter(function (x) { return x.allergen === a; })[0] || null; }
function sentences(text) { return (String(text).match(/[^.!?]+[.!?]+(\s|$)/g) || [text]).map(function (s) { return s.trim(); }); }
function districtOf(r) { return P.districts[r.district]; }
function cuisineLabel(r) { return r.cuisines.map(function (c) { return CUISINE[c]; }).join(', '); }
function uncheckedList(r) {
  return UNCHECKED.filter(function (f) { return r[f[0]] == null; }).map(function (f) { return f[1]; });
}
function sourceNames(r) { return r.sources.map(function (s) { return s.name; }); }

/* ---- sentence -> chips (keyword rules, scripted) ---- */
function parseSentence(s) {
  var t = String(s).toLowerCase().replace(/’/g, "'");
  var c = { diet: [], area: [], cuisine: [], price: [] };
  function add(k, v) { if (c[k].indexOf(v) < 0) c[k].push(v); }
  if (/\bpork\b|\bpig\b|\bhalal\b|muslim/.test(t)) add('diet', 'no-pork');
  if (/peanut/.test(t)) add('diet', 'peanut');
  if (/sesame/.test(t)) add('diet', 'sesame');
  if (/forbidden city|palace|gugong|tiananmen/.test(t)) add('area', 'fc');
  if (/dongcheng/.test(t)) add('area', 'dongcheng');
  if (/xicheng/.test(t)) add('area', 'xicheng');
  if (/chaoyang|sanlitun/.test(t)) add('area', 'chaoyang');
  if (/\bduck\b|peking|kaoya/.test(t)) add('cuisine', 'duck');
  if (/noodle/.test(t)) add('cuisine', 'noodles');
  if (/dumpling|jiaozi/.test(t)) add('cuisine', 'dumplings');
  if (/hot ?pot|mutton|lamb/.test(t)) add('cuisine', 'hotpot');
  if (/breakfast|snack|douzhi/.test(t)) add('cuisine', 'snacks');
  if (/\bmid\b|mid-range|midrange|moderate/.test(t)) add('price', 'mid');
  if (/cheap|inexpensive/.test(t) || (/budget/.test(t) && !/mid[ -]budget/.test(t))) add('price', 'budget');
  var party = null;
  var m = t.match(/\b(one|two|three|four|five|six|[1-6])\b (of us|people|adults|persons|friends)/);
  if (m) party = NUMWORD[m[1]] || Number(m[1]);
  return { chips: c, party: party };
}
function readSentence(s) {
  var r = parseSentence(s);
  S.said = s; S.read = true; S.chips = r.chips;
  if (r.party) { S.party = r.party; S.partyFromSentence = true; }
  S.diet = r.chips.diet.slice();
}
function toggleChip(k, v) {
  var a = S.chips[k]; var i = a.indexOf(v);
  if (i >= 0) a.splice(i, 1); else a.push(v);
  if (k === 'diet') S.diet = a.slice();
}
function activeChips() {
  var out = [];
  GROUPS.forEach(function (g) { S.chips[g.k].forEach(function (v) { out.push({ k: g.k, v: v, label: g.opts[v] }); }); });
  return out;
}

/* ---- how one restaurant meets the chips: yes / no / ask, with the reason ---- */
function dietCheck(r, diet) {
  var v = verified(r);
  if (diet === 'no-pork') {
    if (r.halalSignage) return { s: 'yes', t: 'No pork: 清真 (halal) in the shop name, a strong cue; the card still applies' };
    if (r.onlyDishPork) return { s: 'no', t: 'No pork: its only dish has a pork-based sauce' };
    var pork = v.filter(hasPork);
    if (pork.length) return { s: 'ask', t: 'No pork: ' + pork.map(function (d) { return d.nameEn; }).join(', ') + ' typically contain pork; ask about fillings' };
    if (v.some(function (d) { return !d.slug; })) return { s: 'ask', t: 'No pork: some dishes have no notes on file; ask with the card' };
    return { s: 'ask', t: 'No pork: our notes list none in ' + v.map(function (d) { return d.nameEn; }).join(', ') + '; kitchens vary, show the card' };
  }
  var L = libDishes(r);
  var name = ALG[diet];
  var hits = L.filter(function (d) { return allergen(d.slug, diet); });
  var noted = v.filter(function (d) { return !d.slug && new RegExp(diet, 'i').test(d.note || ''); });
  if (noted.length) return { s: 'ask', t: cap(name) + ': ' + noted.map(function (d) { return d.nameEn; }).join(', ') + ' carries ' + name + ' per our source; ask about the rest', warn: true };
  if (hits.length) return { s: 'ask', t: cap(name) + ': ' + hits.map(function (d) { return d.nameEn + ' (' + PRESENCE[allergen(d.slug, diet).presence] + ')'; }).join(', ') + ' in typical preparation; ask', warn: true };
  if (L.length && L.length === v.length) return { s: 'ask', t: cap(name) + ': not in our typical-preparation notes; confirm with the card', warn: true };
  return { s: 'ask', t: cap(name) + ': no allergen notes on file for some dishes; ask with the card', warn: true };
}
function lc(s) { return s.replace(/^[A-Z][a-z]/, function (m) { return m.toLowerCase(); }).replace(/^peking/, 'Peking'); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fit(r) {
  var lines = [];
  var score = 0, yes = 0, no = 0, groups = 0;
  var c = S.chips;
  if (c.cuisine.length) {
    groups++;
    var okC = c.cuisine.some(function (x) { return r.cuisines.indexOf(x) >= 0; });
    lines.push(okC ? { s: 'yes', t: cuisineLabel(r) } : { s: 'no', t: 'Not ' + c.cuisine.map(function (x) { return lc(CUISINE[x]); }).join(' or ') + ' (' + lc(cuisineLabel(r)) + ')' });
    if (okC) { score += 3; yes++; } else no++;
  }
  if (c.area.length) {
    groups++;
    var okA = c.area.some(function (a) { return a === 'fc' ? r.nearForbiddenCity : r.district === a; });
    lines.push(okA ? { s: 'yes', t: r.nearForbiddenCity && c.area.indexOf('fc') >= 0 ? r.areaNote : districtOf(r).nameEn } : { s: 'no', t: (c.area.indexOf('fc') >= 0 ? 'Not near the Forbidden City: ' : 'Elsewhere: ') + r.areaNote });
    if (okA) { score += 2; yes++; } else no++;
  }
  if (c.price.length) {
    groups++;
    if (!r.priceBand) { lines.push({ s: 'ask', t: 'Price band not checked by two sources' }); score += 0.5; }
    else if (c.price.indexOf(r.priceBand) >= 0) { lines.push({ s: 'yes', t: PRICE[r.priceBand] }); score += 1; yes++; }
    else { lines.push({ s: 'no', t: PRICE[r.priceBand] + ', not ' + c.price.map(function (x) { return PRICE[x]; }).join(' or ') }); no++; }
  }
  var conflict = false;
  c.diet.forEach(function (d) {
    var x = dietCheck(r, d);
    lines.push(x);
    if (x.s === 'yes') score += 1;
    if (x.s === 'no') { score -= 3; conflict = true; }
  });
  var full = groups > 0 && yes === groups && !conflict;
  return { lines: lines, score: score, full: full, partial: !full && yes > 0, groups: groups };
}
function ranked() {
  var list = P.restaurants.map(function (r, i) { var f = fit(r); f.r = r; f.i = i; return f; });
  list.sort(function (a, b) { return (b.full - a.full) || (b.partial - a.partial) || (b.score - a.score) || (a.i - b.i); });
  return {
    full: list.filter(function (x) { return x.full; }),
    partial: list.filter(function (x) { return x.partial; }),
    rest: list.filter(function (x) { return !x.full && !x.partial; })
  };
}

/* ---- Build my order: only verified dishes from the data, with quantities and card lines ---- */
function quantity(d, party) {
  if (d.slug === 'peking-duck') return party <= 3
    ? { zh: '半只', en: 'Half a duck for the table', why: 'Our dish notes: roast duck houses sell half ducks (半只) for small groups.' }
    : { zh: '半只', en: 'Half a duck to start', why: 'Our dish notes only confirm half ducks (半只). For a bigger table, ask staff on the day whether to add a second half or a whole duck.' };
  if (d.slug === 'jiaozi') return { zh: 2 * party + '两', en: 2 * party + ' liang (两), about five or six dumplings each', why: 'Our dish notes: a normal solo order is two or three liang.' };
  if (/noodle/i.test(d.nameEn) || d.slug === 'douzhi') return { zh: '×' + party, en: party === 1 ? 'One bowl' : party + ' bowls, one each', why: 'Rule of thumb, not from a source.' };
  return { zh: '×1', en: 'One to share', why: 'Rule of thumb, not from a source.' };
}
function buildOrder(r, party, diet) {
  var order = [], ask = [], out = [];
  verified(r).forEach(function (d) {
    var L = lib(d), why = null, ex = null, warn = false, check = null;
    if (diet.indexOf('no-pork') >= 0) {
      if (r.onlyDishPork && hasPork(d)) ex = 'The sauce is pork-based, and our sources mention no pork-free version.';
      else if (!L && hasPork(d)) ex = 'Pork in the name (猪肉).';
      else if (L && hasPork(d)) why = 'Typically contains pork and fillings vary: the card asks for a pork-free choice.';
      else if (!L) why = 'No dish notes on file, so pork cannot be ruled out: ask.';
    }
    ['peanut', 'sesame'].forEach(function (a) {
      if (diet.indexOf(a) < 0) return;
      if (L) {
        var x = allergen(d.slug, a);
        if (x && x.presence === 'always') ex = ex || cap(ALG[a]) + ' is always in the typical preparation.';
        else if (x) { why = why || cap(ALG[a]) + ' ' + PRESENCE[x.presence] + ' in the typical preparation: ' + x.note; warn = true; }
        else check = cap(ALG[a]) + ' is not in our typical-preparation notes for this dish. Kitchens vary: the card asks staff to confirm.';
      } else if (new RegExp(a, 'i').test(d.note || '')) ex = ex || 'Carries ' + a + ', per our source: ' + d.note;
      else { why = why || 'No allergen notes on file for this dish: ask with the card.'; warn = true; }
    });
    var item = { d: d, q: quantity(d, party), why: why, warn: warn, check: why ? null : check };
    if (ex) out.push({ d: d, why: ex });
    else if (why) ask.push(item);
    else order.push(item);
  });
  return { order: order, ask: ask, out: out, single: single(r), cards: diet.filter(function (x) { return P.cards[x]; }) };
}

/* ---- Ask about this dish: answers quote the dish library only ---- */
var QUESTIONS = [['what', 'What is it?'], ['eat', 'How do I eat it?'], ['allergens', 'Allergens and diet'], ['spice', 'Is it spicy?']];
function answer(slug, q) {
  var d = P.dishes[slug];
  if (q === 'what') return { title: 'What it is', paras: sentences(d.body[0]).slice(0, 3) };
  if (q === 'eat') return { title: 'How to eat it', paras: [d.howToEat] };
  if (q === 'allergens') {
    var rows = d.allergens.map(function (a) { return { k: cap(ALG[a.allergen] || a.allergen), p: PRESENCE[a.presence] || a.presence, t: a.note }; });
    var diet = d.dietaryNotes.map(function (n) { return DIETNOTE[n] || n; });
    return { title: 'Allergens in the typical preparation', rows: rows, diet: diet, foot: 'This describes the typical preparation only, not a given kitchen. Ask staff to confirm; the card asks in Chinese.' };
  }
  var paras = [d.spiceLevel === 0 ? 'Not spicy in its typical preparation.' : 'Spice level in our notes: ' + d.spiceLevel + '.'];
  if (d.divergence.length) paras.push('Worth knowing: ' + d.divergence.map(function (x) { return DIVERGE[x] || x; }).join(', ') + '. Our notes rate it ' + FIRST[d.firstTimer].toLowerCase() + ' for a first try.');
  if (d.cautiousAlternatives.length) paras.push('Gentler alternative from our notes: ' + d.cautiousAlternatives.map(function (s) { return P.dishes[s].nameEn + ' (' + P.dishes[s].nameZh + ')'; }).join(', ') + '.');
  return { title: 'Spice', paras: paras };
}

/* ---- tiny router ---- */
function route() {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('?')[0].split('/').filter(Boolean);
  return { name: parts[0] || 'home', id: parts[1] || null };
}
/* ===== V2 Night Market: rendering ===== */
var app = document.getElementById('app');
var INK = '#120E0B', PAPER = '#FFF6E2', RED = '#FF4A1F', YEL = '#FFD23F', JADE = '#14B87A', COB = '#2D4BFF', PINK = '#FF8CC6', BROWN = '#B5651D', SOUP = '#C9D3A6';
/* each restaurant: tile colour, text colour on it, giant texture characters (a verified dish name from the data), sticker icon */
var LOOK = {
  'siji-minfu-gugong': { bg: 'yel', tex: '北京烤鸭', icon: 'duck' },
  'no69-fangzhuanchang': { bg: 'cob', tex: '炸酱面', icon: 'zhajiang' },
  'pang-mei-noodles': { bg: 'red', tex: '豌杂面', icon: 'wanza' },
  'man-heng-ji': { bg: 'jade', tex: '涮羊肉', icon: 'hotpot' },
  'bao-yuan': { bg: 'pink', tex: '饺子', icon: 'jiaozi' },
  'huguosi-snacks': { bg: 'paper', tex: '豆汁', icon: 'douzhi' }
};
function C(cx, cy, r) { return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z'; }
function E(cx, cy, rx, ry) { return 'M' + (cx - rx) + ' ' + cy + 'a' + rx + ' ' + ry + ' 0 1 0 ' + 2 * rx + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + -2 * rx + ' 0Z'; }
var ICONS = {
  duck: [[E(50, 76, 46, 15), PAPER], ['M22 66 C12 50 12 36 22 28 L31 33 C25 41 27 52 34 60 Z', RED], [C(25, 26, 9), RED], ['M32 22 L46 26 L33 31 Z', YEL],
    ['M14 68 C12 46 34 36 56 38 C78 40 90 50 90 64 C90 76 76 80 52 80 C30 80 16 76 14 68 Z', RED], ['M34 47 C44 42 56 41 66 42 L65 47 C55 46 45 47 36 52 Z', YEL]],
  zhajiang: [['M8 50 a42 36 0 0 0 84 0 Z', PAPER], ['M12 64 Q50 78 88 64 L85 72 Q50 86 15 72 Z', COB], ['M36 84 H64 V92 H36 Z', PAPER], [E(50, 50, 42, 11), YEL],
    ['M34 53 Q34 37 50 37 Q66 37 66 53 Q50 57 34 53 Z', INK], ['M66 44 l14 -5 l2 5 l-14 5 Z', JADE], ['M70 53 l13 -2 l1 5 l-13 2 Z', JADE], ['M18 46 l12 -3 l1 5 l-12 3 Z', JADE]],
  wanza: [['M70 4 L50 46 L56 48 L76 6 Z', BROWN], ['M8 52 a42 34 0 0 0 84 0 Z', PAPER], ['M12 66 Q50 80 88 66 L85 73 Q50 87 15 73 Z', JADE], ['M36 84 H64 V92 H36 Z', PAPER], [E(50, 52, 42, 11), RED],
    [C(30, 52, 4), YEL], [C(42, 56, 4), YEL], [C(60, 50, 4), YEL], [C(72, 55, 4), YEL], [C(52, 58, 3.6), YEL]],
  hotpot: [['M26 94 L32 74 H68 L74 94 Z', BROWN], ['M42 94 V86 Q50 78 58 86 V94 Z', RED], ['M6 54 Q8 76 50 76 Q92 76 94 54 Z', YEL], [E(50, 54, 44, 10), PAPER],
    ['M40 56 L42 18 H58 L60 56 Z', YEL], ['M34 18 H66 L62 9 H38 Z', BROWN], ['M14 54 q6 -4 13 -1 q-6 4 -13 1 Z', RED], ['M72 55 q6 -3 13 0 q-6 4 -13 0 Z', RED]],
  jiaozi: [[E(50, 66, 48, 26), PAPER], ['M6 58 C8 38 40 38 42 58 C32 64 16 64 6 58 Z', PINK], ['M34 50 C36 28 70 28 72 50 C62 57 44 57 34 50 Z', YEL], ['M58 64 C60 44 92 44 94 64 C84 70 68 70 58 64 Z', JADE], ['M26 78 C28 58 62 58 64 78 C54 84 36 84 26 78 Z', PAPER]],
  douzhi: [[E(72, 24, 24, 12), YEL], [E(72, 24, 10, 4.5), INK], ['M6 50 a40 34 0 0 0 80 0 Z', PAPER], ['M32 82 H60 V90 H32 Z', PAPER], [E(46, 50, 40, 10), SOUP]]
};
var ICON_LINES = {
  duck: 'M46 58 C58 50 74 52 82 62',
  zhajiang: 'M22 52 q7 -4 14 0 M66 56 q7 -4 14 0',
  wanza: 'M58 8 L44 44',
  hotpot: 'M40 34 H60 M40 44 H60',
  jiaozi: 'M14 46 l2 5 M22 44 l1 5 M30 46 l-1 5 M44 36 l2 5 M53 34 l0 5 M62 36 l-2 5 M68 52 l2 5 M76 50 l0 5 M84 52 l-2 5',
  douzhi: 'M30 36 q-5 -7 0 -13 M44 34 q-5 -7 0 -13'
};
function sticker(name, cls) {
  var parts = ICONS[name];
  var white = parts.map(function (p) { return '<path d="' + p[0] + '"/>'; }).join('');
  var body = parts.map(function (p) { return '<path d="' + p[0] + '" fill="' + p[1] + '"/>'; }).join('');
  return '<svg class="stk ' + (cls || '') + '" viewBox="-10 -10 120 120" aria-hidden="true">' +
    '<g fill="#fff" stroke="#fff" stroke-width="18" stroke-linejoin="round">' + white + '</g>' +
    '<g stroke="' + INK + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">' + body + '</g>' +
    '<path d="' + ICON_LINES[name] + '" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/></svg>';
}
var WARN = '<svg class="warn-i" viewBox="0 0 24 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L22.5 20.5 H1.5 Z"/><path d="M12 9 V13.5"/><path d="M12 17.2 V17.3"/></svg>';
var TAPE = '<span class="tape">Prototype · draft data</span>';
var MARK = { yes: '+', no: '×', ask: '?' };
var LAST = 'siji-minfu-gugong';

function ticker() {
  var items = [];
  P.restaurants.forEach(function (r) { verified(r).forEach(function (d) { items.push('<span lang="zh-Hans">' + esc(d.nameZh) + '</span> ' + esc(splitName(d.nameEn).main)); }); });
  var run = items.join('<i class="dot" aria-hidden="true"></i>') + '<i class="dot" aria-hidden="true"></i>';
  return '<div class="ticker" role="marquee" aria-label="Dishes in this guide"><div class="ticker-run"><span>' + run + '</span><span aria-hidden="true">' + run + '</span></div></div>';
}
function tabbar(active) {
  var id = LAST;
  function t(href, label, key) { return '<a href="' + href + '" class="tab' + (active === key ? ' on' : '') + '"' + (active === key ? ' aria-current="page"' : '') + '>' + label + '</a>'; }
  return '<nav class="tabbar" aria-label="Main">' + t('#/', 'Board', 'home') + t('#/order/' + id, 'Order', 'order') + t('#/card/' + id, 'Card', 'card') + '</nav>';
}
function receipt(lines) {
  return '<div class="receipt"><ul>' + lines.map(function (l) {
    var t = esc(l.t).replace('清真', '<span lang="zh-Hans">清真</span>');
    return l.warn ? '<li class="r-warn">' + WARN + '<span>' + t + '</span></li>' : '<li class="r-' + l.s + '"><b>' + MARK[l.s] + '</b><span>' + t + '</span></li>';
  }).join('') + '</ul></div>';
}

/* ---------- Discover: the board ---------- */
function ticket(c, on, i) {
  return '<button type="button" class="tkt tkt-' + c.k + (on ? ' on' : '') + '" data-act="chip" data-k="' + c.k + '" data-v="' + c.v + '" aria-pressed="' + on + '" style="--r:' + ([-3, 2, -1, 3, -2, 1][i % 6]) + 'deg">' +
    '<span class="tkt-no">' + (on ? 'No. ' + String(i + 1).padStart(3, '0') : 'Add') + '</span><span class="tkt-l">' + esc(c.label) + '</span><span class="tkt-x" aria-hidden="true">' + (on ? '×' : '+') + '</span></button>';
}
function slip() {
  var h = '<section class="slip" id="slip"><div class="slip-head"><span>Order slip</span><span>Tell us your table</span></div>' +
    '<form data-form="say"><label class="sr" for="say">Describe your meal in one sentence</label><textarea id="say" rows="4">' + esc(S.said || EXAMPLE) + '</textarea>' +
    '<button class="stamp-btn" type="submit"><span>Read<br>it</span></button></form>' +
    '<p class="slip-foot">Scripted demo · keyword rules · no model connected</p></section>';
  if (S.read) {
    var act = activeChips();
    h += '<section class="tickets" id="read"><h2 class="mega-s">Your tickets</h2><p class="hint">Tap a ticket to tear it off.' + (S.partyFromSentence ? ' Party of ' + S.party + ' saved for your order.' : '') + '</p>' +
      '<div class="tkts">' + act.map(function (c, i) { return ticket(c, true, i); }).join('') + '</div>' +
      '<details class="moretk"><summary>More tickets</summary><div class="tkts">' +
      GROUPS.map(function (g) { return Object.keys(g.opts).filter(function (v) { return S.chips[g.k].indexOf(v) < 0; }).map(function (v, i) { return ticket({ k: g.k, v: v, label: g.opts[v] }, false, i); }).join(''); }).join('') +
      '</div></details></section>';
  }
  return h;
}
function bigTile(f, stamp) {
  var r = f.r, L = LOOK[r.id], n = splitName(r.nameEn);
  return '<article class="tile big t-' + L.bg + '"><span class="tex" lang="zh-Hans" aria-hidden="true">' + esc(L.tex) + '</span>' +
    sticker(L.icon, 'stk-big') + '<span class="stamp">' + stamp + '</span>' +
    '<p class="t-kick">' + esc(districtOf(r).nameEn) + ' · ' + esc(cuisineLabel(r)) + '</p>' +
    '<h3 class="t-name' + (n.main.length > 24 ? ' long' : '') + '"><a class="stretch" href="#/r/' + r.id + '">' + esc(n.main) + '</a></h3>' +
    '<p class="t-zh" lang="zh-Hans">' + esc(r.nameZh) + '</p><p class="t-why">' + esc(r.why) + '</p></article>' + (f.lines.length ? receipt(f.lines) : '');
}
function smallTile(f) {
  var r = f.r, L = LOOK[r.id], n = splitName(r.nameEn);
  return '<article class="tile small t-' + L.bg + '"><span class="tex" lang="zh-Hans" aria-hidden="true">' + esc(L.tex) + '</span>' + sticker(L.icon, 'stk-sm') +
    '<h3 class="t-name sm"><a class="stretch" href="#/r/' + r.id + '">' + esc(n.main) + '</a></h3><p class="t-zh sm" lang="zh-Hans">' + esc(r.nameZh.replace(/（.*）/, '')) + '</p>' +
    '<p class="t-kick sm">' + esc(cuisineLabel(r)) + '</p></article>';
}
function board() {
  var g = ranked();
  var h = '<section class="board" id="board"><h2 class="mega">Tonight’s<br>board</h2>';
  if (!S.read) return h + '<p class="hint">All six places. Fill in the slip to sort them for your table.</p><div class="grid2">' + g.rest.map(smallTile).join('') + '</div></section>';
  h += '<p class="hint">Matches first. Nothing is hidden: every place stays on the board.</p>';
  if (g.full.length) h += g.full.map(function (f) { return bigTile(f, 'Fits all'); }).join('');
  else h += '<p class="hint">Nothing fits every ticket. Closest first.</p>';
  if (g.partial.length) h += '<h3 class="band">Close calls</h3>' + g.partial.map(function (f) { return bigTile(f, 'Close'); }).join('');
  if (g.rest.length) h += '<h3 class="band">Also on the board</h3><div class="grid2">' + g.rest.map(smallTile).join('') + '</div>';
  return h + '</section>';
}
function home() {
  return ticker() + '<header class="hero"><div class="hero-top">' + TAPE + '</div>' +
    '<h1 class="wm"><span class="wm1">China</span><span class="wm2">Food</span><span class="wm3">Guide</span></h1>' +
    '<span class="sk sk-city">Beijing <span lang="zh-Hans">北京</span></span><span class="sk sk-rule">No stars.<br>No scores.</span>' +
    '<p class="hero-dek">Six places to eat. A fact counts as confirmed only when two public sources agree.</p></header>' +
    slip() + board() + foot() + tabbar('home');
}
function foot() {
  return '<footer class="foot"><div class="checker" aria-hidden="true"></div><p>Original English writing. No ratings, no translated platform reviews. Data checked ' + fmtDate(P.generatedOn) + '.</p>' +
    '<details class="moretk"><summary>Not on the board yet</summary><ul class="notyet">' + P.notSourced.map(function (x) { return '<li>' + esc(x).replace(/(花开素食)/, '<span lang="zh-Hans">$1</span>') + '</li>'; }).join('') + '</ul></details>' + TAPE + '</footer>';
}

/* ---------- Restaurant: the shop front ---------- */
function topbar(back, label) {
  return '<header class="topbar"><a class="pill" href="' + back + '"><span aria-hidden="true">←</span> ' + label + '</a>' + TAPE + '</header>';
}
function shop(r) {
  LAST = r.id;
  var L = LOOK[r.id], n = splitName(r.nameEn), d = districtOf(r);
  var vs = sentences(r.visitorView);
  var zhMain = r.nameZh.replace(/（.*）/, ''), zhBranch = (r.nameZh.match(/（.*）/) || [''])[0];
  var V = verified(r), Sg = single(r), Lb = libDishes(r);
  return ticker() + topbar('#/', 'Board') +
    '<section class="sign t-' + L.bg + '"><p class="sign-zh" lang="zh-Hans" style="font-size:min(52px, calc((min(100vw, 430px) - 84px) / ' + zhMain.length + '))">' + esc(zhMain) + '<small>' + esc(zhBranch) + '</small></p>' +
    '<h1 class="sign-en">' + esc(n.main) + '</h1>' + (n.branch ? '<p class="sign-br">' + esc(n.branch) + '</p>' : '') +
    sticker(L.icon, 'stk-sign') + '<div class="sign-tags"><span class="tag">' + esc(d.nameEn) + ' <span lang="zh-Hans">' + esc(d.nameZh) + '</span></span><span class="tag">' + esc(cuisineLabel(r)) + '</span>' + (r.priceBand ? '<span class="tag">' + esc(PRICE[r.priceBand]) + '</span>' : '') + '</div></section>' +
    '<section class="pboard"><h2 class="marker">Why go</h2><p>' + esc(r.why) + '</p></section>' +
    '<section class="quote"><svg class="q-mark" viewBox="0 0 60 44" aria-hidden="true"><path d="M4 44 V26 Q4 6 24 2 L26 9 Q14 13 14 22 H24 V44 Z M34 44 V26 Q34 6 54 2 L56 9 Q44 13 44 22 H54 V44 Z" fill="currentColor"/></svg><blockquote>' + esc(vs[0]) + '</blockquote>' + (vs.length > 1 ? '<p>' + esc(vs.slice(1).join(' ')) + '</p>' : '') + '<p class="q-by">Our view, for a first visit</p></section>' +
    '<section class="local"><h2 class="mega-s">What locals say</h2><p>' + esc(r.localView) + '</p></section>' +
    '<section class="busticket"><div class="bt-l"><span>Show</span><span>the</span><span>driver</span></div><div class="bt-r"><p class="bt-zh" lang="zh-Hans">' + esc(r.addressZh) + '</p><p class="bt-en">' + esc(r.addressEn) + '</p>' +
    '<button type="button" class="pill pill-ink" data-act="big" data-zh="' + esc(r.addressZh) + '" data-en="' + esc(r.addressEn) + '">Full screen</button></div></section>' +
    (r.addressPartial ? '<p class="hint pad">' + esc(r.addressPartial).replace(/(北新桥香饵胡同东口)/, '<span lang="zh-Hans">$1</span>') + '</p>' : '') +
    '<section class="coupons"><h2 class="mega-s">What to order</h2><p class="hint">Coupons are dishes two sources agree on.</p>' +
    V.map(function (x, i) {
      return '<div class="coupon"><span class="c-no">No. ' + String(i + 1).padStart(2, '0') + '</span><span class="c-stamp">Two sources</span><p class="c-zh" lang="zh-Hans">' + esc(x.nameZh) + '</p><p class="c-en">' + esc(x.nameEn) + '</p><p class="c-note">' + esc(x.note) + '</p>' +
        (x.slug ? '<button type="button" class="pill pill-ink" data-act="ask" data-slug="' + x.slug + '">Ask about this dish</button>' : '') + '</div>';
    }).join('') +
    (Sg.length ? '<h3 class="band">One source only</h3>' + Sg.map(function (x) {
      return '<div class="coupon void"><p class="c-zh sm" lang="zh-Hans">' + esc(x.nameZh) + '</p><p class="c-en">' + esc(x.nameEn) + '</p><p class="c-note">' + esc(x.note) + '</p></div>';
    }).join('') : '') + '</section>' +
    '<section class="receipt big"><p class="rc-head">Shop facts</p><table><tbody>' +
    '<tr><th>District</th><td>' + esc(d.nameEn) + ' <span lang="zh-Hans">' + esc(d.nameZh) + '</span></td></tr><tr><th>Where</th><td>' + esc(r.areaNote) + '</td></tr>' +
    '<tr><th>Cuisine</th><td>' + esc(cuisineLabel(r)) + '</td></tr>' + (r.priceBand ? '<tr><th>Price</th><td>' + esc(PRICE[r.priceBand]) + '</td></tr>' : '') +
    (r.spendPerHead ? '<tr><th>Spend</th><td>' + esc(r.spendPerHead) + '</td></tr>' : '') +
    (r.halalSignage ? '<tr><th>Sign</th><td><span lang="zh-Hans">清真</span> (halal) in the name; not a certification</td></tr>' : '') +
    '<tr><th>Checked</th><td>' + fmtDate(r.checkedOn) + '</td></tr></tbody></table>' +
    '<p class="rc-rule">- - - - - - - - - - - - - - - -</p><p><b>Not yet checked on site:</b> ' + esc(uncheckedList(r).join(', ')) + '.</p>' +
    '<p class="rc-src"><b>Sources:</b> ' + sourceNames(r).map(esc).join(' / ').replace(/(北京旅游网)/g, '<span lang="zh-Hans">$1</span>') + '</p></section>' +
    '<div class="dock"><a class="sbtn sbtn-yel" href="#/order/' + r.id + '">Build my order</a><button type="button" class="sbtn sbtn-paper" data-act="ask" data-slug="' + (Lb[0] ? Lb[0].slug : '') + '">Ask about a dish</button></div>';
}

/* ---------- Ask panel ---------- */
function openSheet(inner, label) {
  closeSheet();
  var s = document.createElement('div');
  s.className = 'sheet-wrap';
  s.innerHTML = '<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><div class="sheet-head"><span class="mega-xs">' + esc(label) + '</span>' +
    '<button type="button" class="xbtn" data-act="close" aria-label="Close">×</button></div>' + inner + '</section>';
  document.body.appendChild(s);
  document.body.classList.add('locked');
  requestAnimationFrame(function () { s.classList.add('in'); });
}
function closeSheet() { var s = document.querySelector('.sheet-wrap'); if (s) s.remove(); document.body.classList.remove('locked'); }
function askSheet(slug, q) {
  if (!slug) { openSheet('<p class="body">None of the dishes here has an entry in our dish library yet, so there is nothing to quote. Ask staff with the card instead.</p>', 'Ask about this dish'); return; }
  var d = P.dishes[slug];
  var h = '<p class="sh-zh" lang="zh-Hans">' + esc(d.nameZh) + '</p><p class="sh-en">' + esc(d.nameEn) + ' · <i>' + esc(d.pinyin) + '</i></p>' +
    '<p class="slip-foot dark">Scripted · answers quote our dish notes only · no model connected</p><div class="qgrid">' +
    QUESTIONS.map(function (x, i) { return '<button type="button" class="qbtn q' + i + (x[0] === q ? ' on' : '') + '" data-act="q" data-slug="' + slug + '" data-q="' + x[0] + '" aria-pressed="' + (x[0] === q) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  if (q) {
    var a = answer(slug, q);
    h += '<div class="ans"><p class="ans-h">From our dish notes: ' + esc(a.title) + '</p>';
    if (a.paras) h += a.paras.map(function (p) { return '<p>' + esc(p).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>'; }).join('');
    if (a.rows) h += '<div class="hazard">' + WARN + '<div>' + a.rows.map(function (x) { return '<p><b>' + esc(x.k) + ': ' + esc(x.p) + '.</b> ' + esc(x.t).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>'; }).join('') +
      (a.diet.length ? '<p><b>Diet:</b> ' + esc(a.diet.join(', ')) + '.</p>' : '') + '<p>' + esc(a.foot) + '</p></div></div>';
    h += '</div>';
  }
  openSheet(h, 'Ask about this dish');
}

/* ---------- Order pad ---------- */
function pad(r) {
  LAST = r.id;
  var n = splitName(r.nameEn), o = buildOrder(r, S.party, S.diet), L = LOOK[r.id];
  var rows = o.order.concat(o.ask);
  return ticker() + topbar('#/r/' + r.id, n.main.length > 18 ? 'Shop' : n.main) +
    '<section class="padhead t-' + L.bg + '"><h1 class="mega">Build<br>my order</h1><p class="pad-at">at ' + esc(n.main) + ' <span lang="zh-Hans">' + esc(r.nameZh) + '</span></p>' + sticker(L.icon, 'stk-pad') + '</section>' +
    '<p class="slip-foot dark pad">Scripted demo · picks only from this shop’s confirmed dishes · no model connected</p>' +
    '<section class="counter"><h2 class="mega-xs">How many of you</h2><div class="cnt"><button type="button" class="round" data-act="party" data-d="-1" aria-label="One fewer"' + (S.party <= 1 ? ' disabled' : '') + '>−</button>' +
    '<output class="cnt-n" aria-live="polite">' + S.party + '</output><button type="button" class="round" data-act="party" data-d="1" aria-label="One more"' + (S.party >= 8 ? ' disabled' : '') + '>+</button></div></section>' +
    '<section class="counter"><h2 class="mega-xs">The table can’t eat</h2><div class="stamps">' +
    Object.keys(DIET).map(function (k, i) { var on = S.diet.indexOf(k) >= 0; return '<button type="button" class="dstamp' + (on ? ' on' : '') + '" data-act="diet" data-v="' + k + '" aria-pressed="' + on + '" style="--r:' + [-6, 4, -2][i] + 'deg">' + esc(DIET[k]) + '</button>'; }).join('') + '</div></section>' +
    '<section class="orderpad"><div class="op-head"><span>Dish</span><span>Qty</span></div>' +
    (rows.length ? rows.map(function (it) {
      return '<div class="op-row"><div class="op-dish"><p class="op-zh" lang="zh-Hans">' + esc(it.d.nameZh) + '</p><p class="op-en">' + esc(it.d.nameEn) + '</p></div><div class="op-q"><span lang="zh-Hans">' + esc(it.q.zh) + '</span><small>' + esc(it.q.en) + '</small></div>' +
        '<p class="op-why">' + esc(it.q.why).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>' +
        (it.why ? (it.warn ? '<div class="hazard sm">' + WARN + '<p><b>Ask first.</b> ' + esc(it.why) + '</p></div>' : '<p class="op-ask"><b>Ask first:</b> ' + esc(it.why) + '</p>') : '') + (it.check ? '<div class="hazard sm">' + WARN + '<p>' + esc(it.check) + '</p></div>' : '') + '</div>';
    }).join('') : '<p class="op-empty">Nothing on this shop’s confirmed list fits. The card asks staff to recommend something.</p>') +
    (o.out.length ? '<div class="op-out"><p class="op-outh">Crossed off</p>' + o.out.map(function (x) { return '<p><s lang="zh-Hans">' + esc(x.d.nameZh) + '</s> ' + esc(x.d.nameEn) + ': ' + esc(x.why).replace(/(猪肉)/, '<span lang="zh-Hans">$1</span>') + '</p>'; }).join('') + '</div>' : '') +
    (o.single.length ? '<p class="op-why">' + o.single.length + ' more ' + (o.single.length === 1 ? 'dish is' : 'dishes are') + ' listed by one source only and left off the pad.</p>' : '') + '</section>' +
    '<a class="sbtn sbtn-yel wide" href="#/card/' + r.id + '">Show the card to staff →</a>' + tabbar('order');
}

/* ---------- Staff card: calm, plain, flips for English ---------- */
function card(r) {
  LAST = r.id;
  var o = buildOrder(r, S.party, S.diet), rows = o.order.concat(o.ask);
  var cards = o.cards.map(function (k) { return P.cards[k]; });
  return '<div class="calm"><header class="calm-bar"><a class="calm-btn" href="#/order/' + r.id + '">← Back</a><button type="button" class="calm-btn" data-act="flip" aria-pressed="false">English ↻</button><span class="calm-proto">Prototype · draft data</span></header>' +
    '<div class="flip"><div class="flip-in">' +
    '<section class="face front" lang="zh-Hans" aria-label="Card for staff, in Chinese"><p class="f-greet">' + esc(P.cardGreeting.zh) + '</p>' +
    (rows.length ? '<ol class="f-order">' + rows.map(function (it) { return '<li><span>' + esc(it.d.nameZh) + '</span><b>' + esc(it.q.zh) + '</b></li>'; }).join('') + '</ol>' : '') +
    cards.map(function (c) {
      return '<div class="f-diet"><p class="f-title">' + (c.kind === 'allergen' ? WARN : '') + esc(c.titleZh) + '</p><p class="f-stmt">' + esc(c.statement.zh) + '</p><p>' + esc(c.avoid.zh) + '</p><p>' + esc(c.crossContact.zh) + '</p><p>' + esc(c.askAlternative.zh) + '</p></div>';
    }).join('') + '<p class="f-close">' + esc(P.cardClosing.zh) + '</p></section>' +
    '<section class="face back" aria-label="English gloss for you"><p class="b-h">For you, not for staff</p><p>' + esc(P.cardGreeting.en) + '</p>' +
    (rows.length ? '<ol class="b-order">' + rows.map(function (it) { return '<li><span lang="zh-Hans">' + esc(it.d.nameZh) + '</span> ' + esc(it.d.nameEn) + ': ' + esc(it.q.en) + '</li>'; }).join('') + '</ol>' : '') +
    cards.map(function (c) { return '<p><b>' + esc(c.titleEn) + '.</b> ' + esc(c.statement.en) + ' ' + esc(c.avoid.en) + ' ' + esc(c.crossContact.en) + ' ' + esc(c.askAlternative.en) + '</p>' + (c.noteEn ? '<p class="b-note">' + esc(c.noteEn).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>' : ''); }).join('') +
    '<p>' + esc(P.cardClosing.en) + '</p>' + (cards.length ? '<div class="hazard">' + WARN + '<p>' + esc(P.cardsDisclaimer) + '</p></div>' : '<p class="b-note">No dietary card chosen. Go back to add one.</p>') + '</section>' +
    '</div></div></div>';
}

/* ---------- wiring ---------- */
function render(keep) {
  var rt = route(), r = rt.id ? REST[rt.id] : null, html;
  if (rt.name === 'r' && r) html = shop(r);
  else if (rt.name === 'order' && r) html = pad(r);
  else if (rt.name === 'card' && r) html = card(r);
  else html = home();
  closeSheet();
  document.body.setAttribute('data-route', r ? rt.name : 'home');
  app.innerHTML = '<div class="view">' + html + '</div>';
  if (!keep) window.scrollTo(0, 0);
}
document.addEventListener('submit', function (e) {
  if (e.target.getAttribute('data-form') !== 'say') return;
  e.preventDefault();
  readSentence((e.target.querySelector('textarea').value || '').trim() || EXAMPLE);
  render(true);
  var el = document.getElementById('read');
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]');
  if (!t) return;
  var a = t.getAttribute('data-act');
  if (a === 'chip') { toggleChip(t.getAttribute('data-k'), t.getAttribute('data-v')); render(true); }
  if (a === 'ask') askSheet(t.getAttribute('data-slug'), null);
  if (a === 'q') askSheet(t.getAttribute('data-slug'), t.getAttribute('data-q'));
  if (a === 'close') closeSheet();
  if (a === 'big') openSheet('<p class="big-zh" lang="zh-Hans">' + esc(t.getAttribute('data-zh')) + '</p><p class="body">' + esc(t.getAttribute('data-en')) + '</p>', 'Show the driver');
  if (a === 'party') { S.party = Math.max(1, Math.min(8, S.party + Number(t.getAttribute('data-d')))); render(true); }
  if (a === 'diet') { var v = t.getAttribute('data-v'), i = S.diet.indexOf(v); if (i >= 0) S.diet.splice(i, 1); else S.diet.push(v); S.chips.diet = S.diet.slice(); render(true); }
  if (a === 'flip') { var f = document.querySelector('.flip'); var on = f.classList.toggle('flipped'); t.setAttribute('aria-pressed', String(on)); t.textContent = on ? 'Chinese ↻' : 'English ↻'; }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', function () { render(false); });
if (/read=1/.test(location.hash)) readSentence(EXAMPLE);
render(false);
})();
