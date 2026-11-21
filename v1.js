/* v1: vanilla JS, no libraries. Reads window.PROTO from data.js. Generated from shared rules + v1 UI. */
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
/* ===== V1 Gazette: rendering ===== */
var app = document.getElementById('app');
var ART = {
  'siji-minfu-gugong': ['duck', 'custard'],
  'no69-fangzhuanchang': ['zhajiang', 'sky'],
  'pang-mei-noodles': ['wanza', 'scallion'],
  'man-heng-ji': ['copper-hotpot', 'chili'],
  'bao-yuan': ['jiaozi', 'custard'],
  'huguosi-snacks': ['douzhi-set', 'caramel']
};
var STEAM = '<svg class="steam" viewBox="0 0 44 34" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M8 32 C13 26 3 20 8 13 C11 8 10 5 8 3"/><path d="M22 34 C28 27 16 20 22 12 C26 6 24 3 22 1"/><path d="M36 32 C41 26 31 20 36 13 C39 8 38 5 36 3"/></g></svg>';
var WARN = '<svg class="warn-i" viewBox="0 0 24 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L22.5 20.5 H1.5 Z"/><path d="M12 9 V13.5"/><path d="M12 17.2 V17.3"/></svg>';
var PROTO_MARK = '<span class="proto">Prototype · draft data</span>';

function art(r, cls) {
  var a = ART[r.id];
  return '<div class="block ' + (cls || '') + '" style="--block:var(--' + a[1] + ')"><img src="svg/v1/' + a[0] + '.svg" alt="" loading="lazy"></div>';
}
function kicker(r) {
  var d = districtOf(r);
  return esc(d.nameEn) + ' ' + zh(d.nameZh) + ' · ' + esc(cuisineLabel(r));
}
function fitTable(f) {
  var label = { yes: 'Fits', no: 'No', ask: 'Ask' };
  return '<dl class="fit">' + f.lines.map(function (l) {
    return '<div class="fit-row is-' + l.s + (l.warn ? ' is-warn' : '') + '"><dt>' + (l.warn ? WARN : '') + label[l.s] + '</dt><dd>' + esc(l.t).replace('清真', '<span lang="zh-Hans">清真</span>') + '</dd></div>';
  }).join('') + '</dl>';
}
function secHead(num, title, sub) {
  return '<header class="sec-head"><span class="sec-num">' + num + '</span><h2>' + title + '</h2>' + (sub ? '<p class="sec-sub">' + sub + '</p>' : '') + '</header>';
}

/* ---------- Discover ---------- */
function chipBtn(c, on) {
  return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="chip" data-k="' + c.k + '" data-v="' + c.v + '" aria-pressed="' + on + '">' +
    esc(c.label) + (on ? '<span class="x" aria-hidden="true">×</span>' : '<span class="x" aria-hidden="true">+</span>') + '</button>';
}
function assistHtml() {
  var h = '<section class="sec" id="table">' + secHead('01', 'Your table') +
    '<form class="say" data-form="say"><label for="say" class="lbl">Tell us in one sentence</label>' +
    '<textarea id="say" name="say" rows="4">' + esc(S.said || EXAMPLE) + '</textarea>' +
    '<div class="say-row"><button class="btn btn-ink" type="submit">Read my sentence <span aria-hidden="true">→</span></button></div></form>' +
    '<p class="demo">Scripted demo: keyword rules turn the sentence into filters. No model is connected.</p>';
  if (S.read) {
    var act = activeChips();
    h += '<div class="read" id="read"><p class="lbl">We read it as</p>' +
      (act.length ? '<div class="chips">' + act.map(function (c) { return chipBtn(c, true); }).join('') + '</div>' : '<p class="quiet">No filters matched. Add some below.</p>') +
      (S.partyFromSentence ? '<p class="party">Party of ' + S.party + ' noted for your order.</p>' : '') +
      '<details class="more"><summary>Add a filter</summary><div class="chips">' +
      GROUPS.map(function (g) {
        return Object.keys(g.opts).filter(function (v) { return S.chips[g.k].indexOf(v) < 0; }).map(function (v) { return chipBtn({ k: g.k, v: v, label: g.opts[v] }, false); }).join('');
      }).join('') + '</div></details></div>';
  }
  return h + '</section>';
}
function featureCard(f) {
  var r = f.r, n = splitName(r.nameEn);
  return '<article class="feature">' + art(r, 'block-lg') +
    '<p class="kicker">' + kicker(r) + '</p>' +
    '<h3 class="h-feature"><a class="stretch" href="#/r/' + r.id + '">' + esc(n.main) + '</a></h3>' +
    (n.branch ? '<p class="branch">' + esc(n.branch) + '</p>' : '') +
    '<p class="zh-name" lang="zh-Hans">' + esc(r.nameZh) + '</p>' +
    '<p class="why">' + esc(r.why) + '</p>' + (f.lines.length ? fitTable(f) : '') +
    '<p class="readon">Read the entry <span aria-hidden="true">→</span></p></article>';
}
function sideCard(f, i) {
  var r = f.r, n = splitName(r.nameEn);
  return '<article class="side">' +
    '<div class="side-top">' + art(r, 'block-sm') + '<div class="side-text"><p class="kicker">' + kicker(r) + '</p>' +
    '<h3 class="h-side"><a class="stretch" href="#/r/' + r.id + '">' + esc(n.main) + '</a></h3>' +
    '<p class="zh-name sm" lang="zh-Hans">' + esc(r.nameZh) + '</p></div></div>' +
    '<p class="why sm">' + esc(r.why) + '</p>' + (f.lines.length ? fitTable(f) : '') + '</article>';
}
function indexRow(f, i) {
  var r = f.r, n = splitName(r.nameEn);
  return '<li class="idx"><span class="idx-n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><div class="idx-text">' +
    '<a class="stretch idx-name" href="#/r/' + r.id + '">' + esc(n.main) + '</a>' +
    '<span class="zh-name sm" lang="zh-Hans">' + esc(r.nameZh) + '</span>' +
    '<span class="idx-meta">' + kicker(r) + '</span></div>' + art(r, 'block-xs') + '</li>';
}
function resultsHtml() {
  var g = ranked();
  var n = 0;
  var h = '<section class="sec" id="results">' + secHead('02', S.read ? 'Where to eat' : 'The six places', S.read ? 'Matches first. Every place in the guide stays on this page.' : '');
  if (!S.read) {
    h += '<ol class="index">' + g.rest.map(function (f) { return indexRow(f, n++); }).join('') + '</ol>';
    return h + '</section>';
  }
  if (g.full.length) h += '<h3 class="group">Fits everything you asked</h3>' + g.full.map(featureCard).join('');
  else h += '<p class="quiet">Nothing fits every filter. The closest places come first.</p>';
  if (g.partial.length) h += '<h3 class="group">Close, and why not quite</h3>' + g.partial.map(sideCard).join('');
  if (g.rest.length) h += '<h3 class="group">Also in the guide</h3><ol class="index">' + g.rest.map(function (f) { return indexRow(f, n++); }).join('') + '</ol>';
  return h + '</section>';
}
function home() {
  return '<header class="mast"><div class="mast-row">' + PROTO_MARK + '<span>Beijing edition ' + zh('北京') + '</span></div>' +
    '<a class="wordmark" href="#/">' + STEAM + '<span>China Food Guide</span></a></header>' +
    '<section class="cover" aria-label="Cover"><div class="cover-text"><p class="kicker">The city guide</p>' +
    '<h1 class="cover-title">Beijing <span lang="zh-Hans">北京</span></h1>' +
    '<p class="cover-dek">Six places to eat on a first visit. No stars, no copied reviews: a fact counts as confirmed only when two public sources agree.</p></div>' +
    '<img class="cover-art" src="svg/v1/beijing-hutong.svg" alt="A hutong lane in autumn: a red courtyard door, two bicycles, a yellow ginkgo, two people eating at a small table"></section>' +
    assistHtml() + resultsHtml() + colophon();
}
function colophon() {
  return '<footer class="colophon">' + STEAM + '<p class="colo-title">About this guide</p>' +
    '<p>Original English writing. No ratings, no translated platform reviews. Single-source details are labelled as such.</p>' +
    '<details class="more"><summary>Not in the guide yet</summary><ul class="notyet">' + P.notSourced.map(function (x) { return '<li>' + esc(x).replace(/(花开素食)/, '<span lang="zh-Hans">$1</span>') + '</li>'; }).join('') + '</ul></details>' +
    '<p class="colo-meta">Data checked ' + fmtDate(P.generatedOn) + ' · ' + PROTO_MARK + '</p></footer>';
}

/* ---------- Restaurant ---------- */
function bar(back, label) {
  return '<header class="bar"><a class="back" href="' + back + '"><span aria-hidden="true">←</span> ' + label + '</a>' + PROTO_MARK + '</header>';
}
function restaurant(r) {
  var n = splitName(r.nameEn), d = districtOf(r);
  var vs = sentences(r.visitorView);
  var V = verified(r), Sg = single(r);
  var h = bar('#/', 'The guide') + '<article class="entry">' + art(r, 'block-hero') +
    '<p class="kicker">' + kicker(r) + '</p><h1 class="h-entry">' + esc(n.main) + '</h1>' +
    (n.branch ? '<p class="branch">' + esc(n.branch) + '</p>' : '') +
    '<p class="zh-name lg" lang="zh-Hans">' + esc(r.nameZh) + '</p>' +
    '<p class="standfirst">' + esc(r.why) + '</p>' +
    '<section class="sub">' + '<h2 class="smallcaps">What locals say</h2><p class="prose">' + esc(r.localView) + '</p></section>' +
    '<figure class="pull"><blockquote>' + esc(vs[0]) + '</blockquote><figcaption>Our view, for a first visit</figcaption></figure>' +
    (vs.length > 1 ? '<p class="prose">' + esc(vs.slice(1).join(' ')) + '</p>' : '') +
    '<section class="sub"><h2 class="smallcaps">Show the driver</h2><div class="taxi">' +
    '<p class="taxi-lbl">For a taxi or a passer-by</p><p class="taxi-zh" lang="zh-Hans">' + esc(r.addressZh) + '</p><p class="taxi-en">' + esc(r.addressEn) + '</p>' +
    '<button type="button" class="btn btn-line" data-act="big" data-zh="' + esc(r.addressZh) + '" data-en="' + esc(r.addressEn) + '">Show full screen</button></div>' +
    (r.addressPartial ? '<p class="note">' + esc(r.addressPartial).replace(/(北新桥香饵胡同东口)/, '<span lang="zh-Hans">$1</span>') + '</p>' : '') + '</section>' +
    '<section class="sub"><h2 class="smallcaps">What to order</h2><p class="lbl">Confirmed by two sources</p><ol class="dishes">' +
    V.map(function (x) {
      return '<li class="dish"><p class="dish-zh" lang="zh-Hans">' + esc(x.nameZh) + '</p><p class="dish-en">' + esc(x.nameEn) + '</p><p class="note">' + esc(x.note) + '</p>' +
        (x.slug ? '<button type="button" class="linkbtn" data-act="ask" data-slug="' + x.slug + '">Ask about this dish <span aria-hidden="true">→</span></button>' : '') + '</li>';
    }).join('') + '</ol>' +
    (Sg.length ? '<p class="lbl">Seen in one source only</p><ul class="dishes single">' + Sg.map(function (x) {
      return '<li class="dish"><p class="dish-zh sm" lang="zh-Hans">' + esc(x.nameZh) + '</p><p class="dish-en sm">' + esc(x.nameEn) + '</p><p class="note">' + esc(x.note) + '</p></li>';
    }).join('') + '</ul>' : '') + '</section>' +
    '<section class="sub"><h2 class="smallcaps">The facts</h2><table class="facts"><tbody>' +
    '<tr><th>District</th><td>' + esc(d.nameEn) + ' ' + zh(d.nameZh) + '</td></tr>' +
    '<tr><th>Where</th><td>' + esc(r.areaNote) + '</td></tr>' +
    '<tr><th>Cuisine</th><td>' + esc(cuisineLabel(r)) + '</td></tr>' +
    (r.priceBand ? '<tr><th>Price band</th><td>' + esc(PRICE[r.priceBand]) + '</td></tr>' : '') +
    (r.spendPerHead ? '<tr><th>Spend</th><td>' + esc(r.spendPerHead) + '</td></tr>' : '') +
    (r.halalSignage ? '<tr><th>Signage</th><td>' + zh('清真') + ' (halal) in the shop name; not a certification</td></tr>' : '') +
    '<tr><th>Checked</th><td>' + fmtDate(r.checkedOn) + '</td></tr></tbody></table>' +
    '<p class="unchecked"><b>Not yet checked on site:</b> ' + esc(uncheckedList(r).join(', ')) + '.</p>' +
    '<p class="sources"><b>Sources</b> ' + sourceNames(r).map(esc).join(' · ').replace(/(北京旅游网)/g, '<span lang="zh-Hans">$1</span>') + '</p></section></article>' +
    '<nav class="actionbar" aria-label="Actions"><a class="btn btn-ink" href="#/order/' + r.id + '">Build my order</a>' +
    '<button type="button" class="btn btn-line" data-act="ask" data-slug="' + (libDishes(r)[0] ? libDishes(r)[0].slug : '') + '" data-r="' + r.id + '">Ask about a dish</button></nav>';
  return h;
}

/* ---------- Ask sheet ---------- */
function openSheet(inner, label) {
  closeSheet();
  var s = document.createElement('div');
  s.className = 'sheet-wrap';
  s.innerHTML = '<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' +
    '<div class="sheet-head"><p class="kicker">' + esc(label) + '</p><button type="button" class="x-btn" data-act="close" aria-label="Close">×</button></div>' + inner + '</section>';
  document.body.appendChild(s);
  document.body.classList.add('locked');
  requestAnimationFrame(function () { s.classList.add('in'); var b = s.querySelector('.sheet button:not(.x-btn)') || s.querySelector('.x-btn'); if (b) b.focus(); });
}
function closeSheet() {
  var s = document.querySelector('.sheet-wrap');
  if (s) s.remove();
  document.body.classList.remove('locked');
}
function askSheet(slug, q) {
  if (!slug) {
    openSheet('<p class="prose">None of the dishes here has an entry in our dish library yet, so there is nothing to quote. Ask staff with the card instead.</p>', 'Ask about this dish');
    return;
  }
  var d = P.dishes[slug];
  var h = '<p class="sheet-zh" lang="zh-Hans">' + esc(d.nameZh) + '</p><p class="sheet-en">' + esc(d.nameEn) + ' <span class="pinyin">' + esc(d.pinyin) + '</span></p>' +
    '<p class="demo">Scripted: answers quote our dish notes only. No model is connected.</p>' +
    '<div class="qs">' + QUESTIONS.map(function (x) {
      return '<button type="button" class="q' + (x[0] === q ? ' on' : '') + '" data-act="q" data-slug="' + slug + '" data-q="' + x[0] + '" aria-pressed="' + (x[0] === q) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  if (q) {
    var a = answer(slug, q);
    h += '<div class="answer"><p class="lbl">From our dish notes · ' + esc(a.title) + '</p>';
    if (a.paras) h += a.paras.map(function (p) { return '<p class="prose">' + esc(p).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>'; }).join('');
    if (a.rows) h += '<div class="warnbox">' + WARN + '<div>' + a.rows.map(function (x) {
      return '<p><b>' + esc(x.k) + ': ' + esc(x.p) + '.</b> ' + esc(x.t).replace(/([\u4e00-\u9fff]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>';
    }).join('') + (a.diet.length ? '<p><b>Diet:</b> ' + esc(a.diet.join(', ')) + '.</p>' : '') + '<p>' + esc(a.foot) + '</p></div></div>';
    h += '</div>';
  }
  openSheet(h, 'Ask about this dish');
}
function bigSheet(zhT, en) {
  openSheet('<p class="big-zh" lang="zh-Hans">' + esc(zhT) + '</p><p class="taxi-en">' + esc(en) + '</p>', 'Show the driver');
}

/* ---------- Build my order ---------- */
function orderPage(r) {
  var n = splitName(r.nameEn);
  var o = buildOrder(r, S.party, S.diet);
  var h = bar('#/r/' + r.id, n.main) + '<article class="entry order">' +
    '<p class="kicker">Build my order</p><h1 class="h-entry">Your order at ' + esc(n.main) + '</h1>' +
    '<p class="demo">Scripted demo: rules pick only from this restaurant’s confirmed dishes. No model is connected.</p>' +
    '<section class="sub">' + '<h2 class="smallcaps"><span class="sec-num">01</span> How many at the table</h2>' +
    '<div class="stepper"><button type="button" class="step" data-act="party" data-d="-1" aria-label="One fewer"' + (S.party <= 1 ? ' disabled' : '') + '>−</button>' +
    '<output class="step-n" aria-live="polite">' + S.party + '</output><button type="button" class="step" data-act="party" data-d="1" aria-label="One more"' + (S.party >= 8 ? ' disabled' : '') + '>+</button>' +
    '<span class="step-l">' + (S.party === 1 ? 'person' : 'people') + '</span></div></section>' +
    '<section class="sub"><h2 class="smallcaps"><span class="sec-num">02</span> What the table cannot eat</h2><div class="chips">' +
    Object.keys(DIET).map(function (k) { var on = S.diet.indexOf(k) >= 0; return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-act="diet" data-v="' + k + '" aria-pressed="' + on + '">' + esc(DIET[k]) + '</button>'; }).join('') +
    '</div></section>' +
    '<section class="sub"><h2 class="smallcaps"><span class="sec-num">03</span> The suggested order</h2><div class="menu">';
  if (o.order.length + o.ask.length) {
    h += '<ol class="menu-list">' + o.order.concat(o.ask).map(function (it) {
      return '<li class="menu-item"><p class="menu-line" lang="zh-Hans"><span class="menu-zh">' + esc(it.d.nameZh) + '</span><span class="lead" aria-hidden="true"></span><span class="menu-q">' + esc(it.q.zh) + '</span></p><p class="menu-en">' + esc(it.d.nameEn) + ' <span class="menu-qen">' + esc(it.q.en) + '</span></p>' +
        '<p class="note">' + esc(it.q.why).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>' +
        (it.why ? (it.warn ? '<p class="warnline">' + WARN + '<span>Ask first. ' + esc(it.why) + '</span></p>' : '<p class="askline"><b>Ask first.</b> ' + esc(it.why) + '</p>') : '') + (it.check ? '<p class="warnline">' + WARN + '<span>' + esc(it.check) + '</span></p>' : '') + '</li>';
    }).join('') + '</ol>';
  } else h += '<p class="prose">Nothing on this restaurant’s confirmed dish list fits. The card asks staff to recommend something.</p>';
  if (o.out.length) h += '<p class="lbl">Left out</p><ul class="out">' + o.out.map(function (x) { return '<li>' + zh(x.d.nameZh) + ' ' + esc(x.d.nameEn) + ': ' + esc(x.why).replace(/(猪肉)/, '<span lang="zh-Hans">$1</span>') + '</li>'; }).join('') + '</ul>';
  if (o.single.length) h += '<p class="note">' + o.single.length + ' more ' + (o.single.length === 1 ? 'dish is' : 'dishes are') + ' listed by one source only, so the order leaves ' + (o.single.length === 1 ? 'it' : 'them') + ' out.</p>';
  h += '</div></section><a class="btn btn-ink btn-wide" href="#/card/' + r.id + '">Show the card to staff <span aria-hidden="true">→</span></a></article>';
  return h;
}

/* ---------- Staff card ---------- */
function cardPage(r) {
  var o = buildOrder(r, S.party, S.diet);
  var lines = o.order.concat(o.ask);
  var cards = o.cards.map(function (k) { return P.cards[k]; });
  var h = '<div class="cardscreen"><header class="bar bar-card"><a class="back" href="#/order/' + r.id + '"><span aria-hidden="true">←</span> Order</a>' + PROTO_MARK + '</header>' +
    '<section class="staff" lang="zh-Hans" aria-label="Card for staff, in Chinese">' +
    '<p class="s-greet">' + esc(P.cardGreeting.zh) + '</p>' +
    (lines.length ? '<ul class="s-order">' + lines.map(function (it) { return '<li><span>' + esc(it.d.nameZh) + '</span><span class="s-q">' + esc(it.q.zh) + '</span></li>'; }).join('') + '</ul>' : '') +
    cards.map(function (c) {
      return '<div class="s-diet"><p class="s-title">' + (c.kind === 'allergen' ? WARN : '') + esc(c.titleZh) + '</p><p class="s-stmt">' + esc(c.statement.zh) + '</p>' +
        '<p>' + esc(c.avoid.zh) + '</p><p>' + esc(c.crossContact.zh) + '</p><p>' + esc(c.askAlternative.zh) + '</p></div>';
    }).join('') +
    '<p class="s-close">' + esc(P.cardClosing.zh) + '</p></section>' +
    '<section class="gloss"><p class="kicker">For you, not for staff: what the card says</p>' +
    '<p class="prose">' + esc(P.cardGreeting.en) + '</p>' +
    (lines.length ? '<ul class="gloss-order">' + lines.map(function (it) { return '<li>' + zh(it.d.nameZh) + ' ' + esc(it.d.nameEn) + ': ' + esc(it.q.en) + '</li>'; }).join('') + '</ul>' : '') +
    cards.map(function (c) {
      return '<p class="prose"><b>' + esc(c.titleEn) + '.</b> ' + esc(c.statement.en) + ' ' + esc(c.avoid.en) + ' ' + esc(c.crossContact.en) + ' ' + esc(c.askAlternative.en) + '</p>' +
        (c.noteEn ? '<p class="note">' + esc(c.noteEn).replace(/([一-鿿]+)/g, '<span lang="zh-Hans">$1</span>') + '</p>' : '');
    }).join('') +
    '<p class="prose">' + esc(P.cardClosing.en) + '</p>' +
    (cards.length ? '<div class="warnbox">' + WARN + '<p>' + esc(P.cardsDisclaimer) + '</p></div>' : '<p class="note">No dietary card chosen. Go back to add one.</p>') +
    '</section></div>';
  return h;
}

/* ---------- wiring ---------- */
function render(keepScroll) {
  var rt = route();
  var r = rt.id ? REST[rt.id] : null;
  var html;
  if (rt.name === 'r' && r) html = restaurant(r);
  else if (rt.name === 'order' && r) html = orderPage(r);
  else if (rt.name === 'card' && r) html = cardPage(r);
  else html = home();
  closeSheet();
  app.innerHTML = '<div class="view">' + html + '</div>';
  document.body.setAttribute('data-route', rt.name);
  if (!keepScroll) window.scrollTo(0, 0);
}
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f.getAttribute('data-form') !== 'say') return;
  e.preventDefault();
  readSentence((f.querySelector('textarea').value || '').trim() || EXAMPLE);
  render(true);
  var el = document.getElementById('read');
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]');
  if (!t) return;
  var a = t.getAttribute('data-act');
  if (a === 'chip') {
    toggleChip(t.getAttribute('data-k'), t.getAttribute('data-v'));
    render(true);
  }
  if (a === 'ask') askSheet(t.getAttribute('data-slug'), null);
  if (a === 'q') askSheet(t.getAttribute('data-slug'), t.getAttribute('data-q'));
  if (a === 'close') closeSheet();
  if (a === 'big') bigSheet(t.getAttribute('data-zh'), t.getAttribute('data-en'));
  if (a === 'party') { S.party = Math.max(1, Math.min(8, S.party + Number(t.getAttribute('data-d')))); render(true); }
  if (a === 'diet') {
    var v = t.getAttribute('data-v'), i = S.diet.indexOf(v);
    if (i >= 0) S.diet.splice(i, 1); else S.diet.push(v);
    S.chips.diet = S.diet.slice();
    render(true);
  }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', function () { render(false); });
if (/[?&]read=1/.test(location.hash) || /read=1/.test(location.search)) readSentence(EXAMPLE);
render(false);
})();
