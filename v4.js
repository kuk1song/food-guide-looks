/* v4.js: prototype screens. Vanilla JS, no libraries. Reads window.PROTO from data.js. */
/* ---- shared rules (same in v3/v4/v5): keyword parse, ranking, order builder, card.
   Scripted: plain keyword rules over data.js. No model is connected. ---- */
(function () {
  'use strict';
  var P = window.PROTO;
  var C = (window.CORE = { P: P });

  C.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  C.zh = function (t, cls) { return '<span lang="zh-Hans"' + (cls ? ' class="' + cls + '"' : '') + '>' + C.esc(t) + '</span>'; };
  C.rest = function (id) { return P.restaurants.filter(function (r) { return r.id === id; })[0] || null; };
  C.index = function (r) { return P.restaurants.indexOf(r); };
  C.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  C.roman = function (n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); };

  C.PRICE = { budget: '¥ Budget', mid: '¥¥ Mid' };
  C.CUISINE = { duck: 'Peking duck', noodles: 'Noodles', dumplings: 'Dumplings', hotpot: 'Hotpot', snacks: 'Breakfast & snacks' };
  C.district = function (r) { return P.districts[r.district]; };
  C.splitName = function (en) {
    var m = /^(.*?)\s*\((.*)\)\s*$/.exec(en);
    return m ? { main: m[1], branch: m[2] } : { main: en, branch: '' };
  };
  C.GLYPH = { duck: '鸭', noodles: '面', dumplings: '饺', hotpot: '涮', snacks: '豆' }; /* each one appears in that restaurant's own dish names */
  C.glyph = function (r) { return C.GLYPH[r.cuisines[0]] || r.nameZh.charAt(0); };

  C.OPTS = [
    { id: 'no-pork', g: 'diet', en: 'No pork' },
    { id: 'peanut', g: 'diet', en: 'Peanut allergy' },
    { id: 'sesame', g: 'diet', en: 'Sesame allergy' },
    { id: 'fc', g: 'area', en: 'Near the Forbidden City' },
    { id: 'dongcheng', g: 'area', en: 'Dongcheng' },
    { id: 'xicheng', g: 'area', en: 'Xicheng' },
    { id: 'chaoyang', g: 'area', en: 'Chaoyang' },
    { id: 'duck', g: 'cuisine', en: 'Peking duck' },
    { id: 'noodles', g: 'cuisine', en: 'Noodles' },
    { id: 'dumplings', g: 'cuisine', en: 'Dumplings' },
    { id: 'hotpot', g: 'cuisine', en: 'Hotpot' },
    { id: 'snacks', g: 'cuisine', en: 'Breakfast & snacks' },
    { id: 'budget', g: 'price', en: '¥ Budget' },
    { id: 'mid', g: 'price', en: '¥¥ Mid' },
  ];
  C.GROUPS = ['diet', 'area', 'cuisine', 'price'];
  C.GROUP_EN = { diet: 'Dietary', area: 'Area', cuisine: 'Food', price: 'Price' };
  C.opt = function (id) { return C.OPTS.filter(function (o) { return o.id === id; })[0]; };
  C.sortChips = function (ids) {
    return ids.filter(function (id, i) { return C.opt(id) && ids.indexOf(id) === i; })
      .sort(function (a, b) { return C.OPTS.indexOf(C.opt(a)) - C.OPTS.indexOf(C.opt(b)); });
  };

  C.SAMPLE = 'Two of us staying near the Forbidden City, one doesn’t eat pork. We want Peking duck or noodles, mid-range.';

  var RULES = [
    [/\bpork\b|\bpig\b|\bhalal\b|muslim|清真/, 'no-pork'],
    [/peanut/, 'peanut'],
    [/sesame/, 'sesame'],
    [/forbidden city|palace|gugong|故宫|tiananmen/, 'fc'],
    [/dongcheng|东城/, 'dongcheng'],
    [/xicheng|西城/, 'xicheng'],
    [/chaoyang|sanlitun|朝阳/, 'chaoyang'],
    [/\bduck\b|peking|kaoya|烤鸭/, 'duck'],
    [/noodle|mian\b|面/, 'noodles'],
    [/dumpling|jiaozi|饺子/, 'dumplings'],
    [/hot ?pot|mutton|lamb|火锅/, 'hotpot'],
    [/breakfast|snack|douzhi/, 'snacks'],
    [/\bmid\b|mid-range|moderate|not too expensive/, 'mid'],
    [/cheap|inexpensive|\bbudget\b/, 'budget'],
  ];
  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  C.parse = function (s) {
    var t = String(s || '').toLowerCase().replace(/’/g, "'");
    var chips = [];
    RULES.forEach(function (r) { if (r[0].test(t)) chips.push(r[1]); });
    if (chips.indexOf('mid') >= 0 && chips.indexOf('budget') >= 0 && !/cheap|inexpensive/.test(t)) chips.splice(chips.indexOf('budget'), 1);
    var m = t.match(/\b(one|two|three|four|five|six|[1-6])\b (of us|people|adults|persons)/);
    var party = m ? (NUM[m[1]] || Number(m[1])) : null;
    return { chips: C.sortChips(chips), party: party };
  };

  /* ---- dish helpers ---- */
  C.lib = function (d) { return d.slug ? P.dishes[d.slug] : null; };
  C.libDishes = function (r) { return r.dishes.filter(function (d) { return d.slug && P.dishes[d.slug]; }); };
  C.verified = function (r) { return r.dishes.filter(function (d) { return d.verified; }); };
  C.single = function (r) { return r.dishes.filter(function (d) { return !d.verified; }); };
  function hasPork(d) {
    if (d.slug) return P.dishes[d.slug].dietaryNotes.indexOf('pork') >= 0;
    return d.nameZh.indexOf('猪肉') >= 0;
  }
  function allergen(slug, a) { return P.dishes[slug].allergens.filter(function (e) { return e.allergen === a; })[0] || null; }
  C.ALG = { peanut: 'peanut', tree_nut: 'tree nuts', sesame: 'sesame', gluten: 'gluten', soy: 'soy', shellfish: 'shellfish', fish: 'fish', egg: 'egg', dairy: 'dairy' };
  C.PRESENCE = { always: 'always', common: 'often', varies: 'sometimes' };
  C.DIET = { pork: 'contains pork', organ_meat: 'organ meat', bone_in: 'bone in', small_bones: 'small bones', raw_or_undercooked: 'raw or undercooked', alcohol: 'alcohol', high_fat: 'rich and fatty', msg_common: 'MSG common' };
  C.DIV = { fermented_or_pungent: 'strong smell, fermented', body_part_concept: 'unfamiliar cut or part', texture: 'unfamiliar texture', sweet_savory_mix: 'sweet and savoury together', bones_and_effort: 'bones, shells, or effort' };
  C.FIRST = { crowd_pleaser: 'Crowd pleaser for first-timers', approachable: 'Approachable for first-timers', adventurous: 'Adventurous for first-timers', challenging: 'Challenging for first-timers' };
  C.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---- how one restaurant answers each chip ---- */
  function dietFit(r, id) {
    var names = function (a) { return a.map(function (d) { return d.nameEn; }).join(', '); };
    if (id === 'no-pork') {
      if (r.halalSignage === true) return { state: 'yes', text: '清真 (halal) in the shop name; the no-pork card still applies' };
      if (r.onlyDishPork) return { state: 'no', text: 'its only dish has a pork-based sauce' };
      var v = C.verified(r);
      var pork = v.filter(hasPork);
      if (pork.length) return { state: 'ask', text: names(pork) + ' typically contains pork; ask about fillings' };
      if (v.some(function (d) { return !d.slug; })) return { state: 'ask', text: 'Some dishes have no notes on file; ask with the card' };
      return { state: 'ask', text: 'No pork in our notes for the main dish; kitchens vary, ask' };
    }
    var lib = C.verified(r).filter(function (d) { return d.slug; });
    var hit = lib.filter(function (d) { return allergen(d.slug, id); });
    var a = C.ALG[id];
    if (hit.length) return { state: 'ask', text: hit.map(function (d) { return d.nameEn + ': ' + a + ' ' + C.PRESENCE[allergen(d.slug, id).presence] + ' in the typical preparation'; }).join('; ') };
    if (lib.length) return { state: 'ask', text: C.cap(a) + ' is not in our notes for ' + names(lib) + '; confirm with the card' };
    return { state: 'ask', text: 'No allergen notes on file here; ask with the card' };
  }
  C.evaluate = function (r, chips) {
    var by = {};
    chips.forEach(function (id) { var o = C.opt(id); if (o) (by[o.g] = by[o.g] || []).push(id); });
    var parts = [];
    (by.diet || []).forEach(function (id) { var f = dietFit(r, id); parts.push({ g: 'diet', label: C.opt(id).en, state: f.state, text: f.text }); });
    if (by.area) {
      var okA = by.area.some(function (a) { return a === 'fc' ? r.nearForbiddenCity : r.district === a; });
      parts.push({ g: 'area', label: by.area.map(function (a) { return C.opt(a).en; }).join(' or '), state: okA ? 'yes' : 'no',
        text: r.nearForbiddenCity ? r.areaNote : C.district(r).nameEn });
    }
    if (by.cuisine) {
      var okC = by.cuisine.some(function (c) { return r.cuisines.indexOf(c) >= 0; });
      parts.push({ g: 'cuisine', label: by.cuisine.map(function (c) { return C.opt(c).en; }).join(' or '), state: okC ? 'yes' : 'no',
        text: r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ') });
    }
    if (by.price) {
      var st = !r.priceBand ? 'unknown' : (by.price.indexOf(r.priceBand) >= 0 ? 'yes' : 'no');
      parts.push({ g: 'price', label: by.price.map(function (p) { return C.opt(p).en; }).join(' or '), state: st,
        text: r.priceBand ? C.PRICE[r.priceBand] : 'Price band not verified' });
    }
    var met = parts.filter(function (p) { return p.state === 'yes' || p.state === 'ask'; }).length;
    var all = parts.length > 0 && met === parts.length;
    var food = parts.filter(function (p) { return p.g === 'cuisine' && p.state === 'yes'; }).length;
    return { r: r, parts: parts, met: met, all: all, score: (all ? 100 : 0) + met + food * 0.5 };
  };
  C.rank = function (chips) {
    return P.restaurants.map(function (r) { return C.evaluate(r, chips); })
      .sort(function (a, b) { return b.score - a.score || C.index(a.r) - C.index(b.r); });
  };

  /* ---- facts that are null: listed once, grouped ---- */
  var NULLS = [['hours', 'hours'], ['spendPerHead', 'spend per head'], ['priceBand', 'price band'], ['ordering', 'how to order'], ['payment', 'payment'], ['englishMenu', 'English menu']];
  C.unverifiedList = function (r) {
    var out = NULLS.filter(function (f) { return r[f[0]] == null; }).map(function (f) { return f[1]; });
    if (r.addressPartial) out.unshift('street number');
    return out;
  };
  C.joinList = function (a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  C.fmtDate = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    return Number(m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] + ' ' + m[1];
  };

  /* ---- Build my order: picks only from verified dishes in the data ---- */
  function quantity(d, party) {
    if (d.slug === 'peking-duck') {
      return party <= 3
        ? { en: 'Half a duck (半只) for the table', zh: '半只', src: 'Dish notes: proper roast duck houses sell half ducks (半只) for a small group' }
        : { en: 'One whole duck for the table (rule of thumb)', zh: '×1' };
    }
    if (d.slug === 'jiaozi') return { en: 'About ' + 2 * party + ' to ' + 3 * party + ' liang (两) for ' + party, zh: 2 * party + '–' + 3 * party + '两', src: 'Dish notes: a normal solo order is two or three liang' };
    if (d.slug === 'zhajiang-noodles' || d.slug === 'douzhi' || /noodles/i.test(d.nameEn)) return { en: party + (party === 1 ? ' bowl' : ' bowls') + ', one each (rule of thumb)', zh: '×' + party };
    return { en: 'One to share (rule of thumb)', zh: '×1' };
  }
  C.DIET_OPTS = [['no-pork', 'No pork'], ['peanut', 'Peanut allergy'], ['sesame', 'Sesame allergy']];
  C.buildOrder = function (r, party, diet) {
    var order = [], ask = [], out = [];
    C.verified(r).forEach(function (d) {
      var lib = C.lib(d);
      var notes = [], exclude = null, askFirst = null;
      if (diet.indexOf('no-pork') >= 0) {
        if (r.onlyDishPork && lib && lib.dietaryNotes.indexOf('pork') >= 0) exclude = 'Pork-based sauce';
        else if (lib && lib.dietaryNotes.indexOf('pork') >= 0) askFirst = 'Typically contains pork; fillings vary, ask for a non-pork filling';
        else if (!lib && hasPork(d)) exclude = 'Pork in the name (猪肉)';
        else if (!lib) askFirst = 'No dish notes on file, so pork cannot be ruled out; ask';
        else notes.push('No pork in our notes on the typical preparation; kitchens vary');
      }
      ['peanut', 'sesame'].forEach(function (a) {
        if (diet.indexOf(a) < 0) return;
        if (lib) {
          var x = allergen(d.slug, a);
          if (x && x.presence === 'always') exclude = exclude || C.cap(C.ALG[a]) + ' is always in the typical preparation';
          else if (x) askFirst = askFirst || C.cap(C.ALG[a]) + ' ' + C.PRESENCE[x.presence] + ' in the typical preparation: ' + (x.note || '');
          else notes.push(C.cap(C.ALG[a]) + ' is not in our notes on the typical preparation; confirm with the card');
        } else if (a === 'sesame' && /sesame/i.test(d.note || d.nameEn)) {
          exclude = exclude || 'Sesame, per the source description';
        } else {
          askFirst = askFirst || 'No allergen notes on file for this dish; ask with the card';
        }
      });
      if (lib) {
        var typical = lib.allergens.filter(function (x) { return diet.indexOf(x.allergen) < 0; })
          .map(function (x) { return C.ALG[x.allergen] + ' (' + C.PRESENCE[x.presence] + ')'; });
        if (typical.length) notes.push('Typically contains ' + C.joinList(typical));
      }
      var item = { d: d, lib: lib, qty: quantity(d, party), notes: notes };
      if (exclude) out.push({ d: d, why: exclude });
      else if (askFirst) { item.why = askFirst; ask.push(item); }
      else order.push(item);
    });
    return { order: order, ask: ask, out: out, single: C.single(r), cards: diet.filter(function (x) { return P.cards[x]; }) };
  };

  /* ---- staff card: Chinese is copied verbatim from PROTO.cards ---- */
  C.card = function (r, party, diet) {
    var o = C.buildOrder(r, party, diet);
    var lines = o.order.concat(o.ask).map(function (it) { return { zh: it.d.nameZh, qtyZh: it.qty.zh, en: it.d.nameEn, qtyEn: it.qty.en, ask: !!it.why }; });
    var cards = o.cards.map(function (id) { return P.cards[id]; });
    return { lines: lines, cards: cards, order: o, askAlt: lines.length === 0 };
  };

  /* ---- Ask about this dish: answers only from PROTO.dishes fields ---- */
  C.sentences = function (text) { return (text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text]).map(function (s) { return s.trim(); }); };
  C.TOPICS = [['what', 'What is it?'], ['how', 'How do I eat it?'], ['allergens', 'Allergens and diet'], ['spice', 'Is it spicy?']];
  C.answer = function (slug, topic) {
    var d = P.dishes[slug];
    if (!d) return null;
    if (topic === 'what') {
      var s = C.sentences(d.body.join(' '));
      var alt = d.cautiousAlternatives.map(function (x) { return P.dishes[x]; }).filter(Boolean);
      return { field: 'body', paras: [s.slice(0, 3).join(' ')], more: s.slice(3).join(' '), tags: [C.FIRST[d.firstTimer]].concat(d.divergence.map(function (x) { return C.cap(C.DIV[x] || x); })).filter(Boolean),
        alt: alt.length ? alt.map(function (a) { return { en: a.nameEn, zh: a.nameZh }; }) : null };
    }
    if (topic === 'how') return { field: 'howToEat', paras: [d.howToEat] };
    if (topic === 'allergens') {
      return { field: 'allergens, dietaryNotes', lead: 'In the typical preparation, per our dish notes. This kitchen may differ: confirm with staff.',
        rows: d.allergens.map(function (a) { return { k: C.cap(C.ALG[a.allergen] || a.allergen), v: C.PRESENCE[a.presence], note: a.note || '' }; }),
        diet: d.dietaryNotes.map(function (x) { return C.DIET[x] || x; }) };
    }
    if (topic === 'spice') {
      var sp = C.sentences(d.body.join(' ') + ' ' + d.howToEat).filter(function (x) { return /spic|chil/i.test(x); });
      return { field: 'spiceLevel', lead: 'Kitchens vary; ask if heat matters to you.',
        paras: [d.spiceLevel === 0 ? 'Not spicy in the typical preparation: spice level 0 in our dish notes.' : 'Spice level ' + d.spiceLevel + ' in our dish notes.'].concat(sp) };
    }
    return null;
  };

  /* ---- router ---- */
  C.route = function () {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var q = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    var p = path.split('/').filter(Boolean);
    var name = p[0] || 'discover';
    return { name: name, id: p[1] || null, q: q };
  };
  C.qs = function (o) {
    var k = Object.keys(o).filter(function (x) { return o[x] !== '' && o[x] != null; });
    return k.length ? '?' + k.map(function (x) { return x + '=' + encodeURIComponent(o[x]); }).join('&') : '';
  };

  /* ---- session state shared across screens ---- */
  C.S = { said: C.SAMPLE, chips: null, party: 2, diet: ['no-pork'] };
  C.syncFromQuery = function (q) {
    if (q.f != null) C.S.chips = C.sortChips(q.f.split(',').filter(Boolean));
    if (q.p) C.S.party = Math.max(1, Math.min(8, Number(q.p) || 2));
    if (q.d != null) C.S.diet = q.d.split(',').filter(function (x) { return P.cards[x]; });
  };
  C.dietFromChips = function (chips) { return chips.filter(function (x) { return P.cards[x] && x !== 'vegetarian'; }); };
  C.discoverHash = function () { return '#/' + C.qs({ f: C.S.chips ? C.S.chips.join(',') : null, p: C.S.chips ? C.S.party : null }); };
  C.orderHash = function (id) { return '#/order/' + id + C.qs({ p: C.S.party, d: C.S.diet.join(',') }); };
  C.cardHash = function (id) { return '#/card/' + id + C.qs({ p: C.S.party, d: C.S.diet.join(',') }); };
})();
/* ---- V4 After Dark: screens ---- */
(function () {
  'use strict';
  var C = window.CORE, P = C.P, S = C.S, esc = C.esc, zh = C.zh;
  var app = document.getElementById('app');
  var ov = document.getElementById('ov');
  var WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  var ui = { page: 0, editing: false, side: 'zh' };
  var cur = null, ranked = [], lastKey = '';

  function head(back, backLabel) {
    return '<header class="hd"><p class="proto">Prototype · draft data</p><div class="hd-row">' +
      (back ? '<a class="hd-back" href="' + back + '">' + (backLabel || 'Back') + '</a>' : '<span class="hd-sp"></span>') +
      '<a class="wm" href="#/">China Food Guide</a><span class="hd-sp"></span></div></header>';
  }
  function label(t) { return '<p class="lr"><span>' + t + '</span></p>'; }
  function rn(r) { return C.roman(C.index(r) + 1); }

  /* ---------- Discover ---------- */
  function fitHtml(ev) {
    if (!ev || !ev.parts.length) return '';
    var yes = ev.parts.filter(function (p) { return p.state === 'yes' || p.state === 'ask'; });
    var no = ev.parts.filter(function (p) { return p.state === 'no' || p.state === 'unknown'; });
    return '<dl class="fits">' +
      (yes.length ? '<div><dt>Fits</dt><dd>' + yes.map(function (p) { return esc(p.label) + (p.state === 'ask' ? ' <i>(ask staff)</i>' : ''); }).join(', ') + '</dd></div>' : '') +
      (no.length ? '<div><dt>Not quite</dt><dd>' + no.map(function (p) { return esc(p.label) + ' <i>(' + esc(p.state === 'unknown' ? 'not verified' : p.text) + ')</i>'; }).join(', ') + '</dd></div>' : '') + '</dl>';
  }
  function pageHtml(i) {
    var e = ranked[i], r = e.r, n = C.splitName(r.nameEn);
    var meta = [C.district(r).nameEn, r.priceBand ? C.PRICE[r.priceBand] : null, r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ')].filter(Boolean).join(' · ');
    var tag = S.chips && S.chips.length ? (e.all ? 'Fits every request' : 'Closest after that') : 'From the guide';
    return '<article class="pg" aria-roledescription="slide" aria-label="' + WORDS[i] + ' of six">' +
      '<p class="pg-tag' + (e.all ? ' on' : '') + '">' + tag + '</p>' +
      '<p class="pg-num" aria-hidden="true">' + rn(r) + '</p>' +
      '<h2 class="pg-name"><a href="#/r/' + r.id + '">' + esc(n.main) + '</a></h2>' +
      (n.branch ? '<p class="pg-branch">' + esc(n.branch) + '</p>' : '') +
      '<p class="pg-zh" lang="zh-Hans">' + esc(r.nameZh) + '</p>' +
      '<p class="pg-meta">' + esc(meta) + '</p>' +
      '<p class="orn" aria-hidden="true"></p>' +
      '<p class="pg-why">' + esc(r.why) + '</p>' +
      (S.chips && S.chips.length ? fitHtml(e) : '') +
      '<a class="btn btn-line" href="#/r/' + r.id + '">View the restaurant</a></article>';
  }
  function pager() {
    var i = ui.page;
    return '<section class="pager" aria-roledescription="carousel" aria-label="Restaurants, one per page">' +
      '<div class="pg-stage" id="stage">' + pageHtml(i) + '</div>' +
      '<nav class="pg-nav" aria-label="Pages"><button type="button" class="pg-b" data-act="prev"' + (i === 0 ? ' disabled' : '') + '>Previous</button>' +
      '<span class="pg-count" aria-live="polite">' + WORDS[i] + ' of six</span>' +
      '<button type="button" class="pg-b" data-act="next"' + (i === ranked.length - 1 ? ' disabled' : '') + '>Next</button></nav>' +
      '<ol class="pg-index" aria-label="All six">' + ranked.map(function (e, k) {
        return '<li><button type="button" class="pg-i' + (e.all ? ' on' : '') + '" data-act="go" data-v="' + k + '" aria-current="' + (k === i) + '" aria-label="' + esc(e.r.nameEn) + '">' + rn(e.r) + '</button></li>';
      }).join('') + '</ol></section>';
  }
  function discover(q) {
    C.syncFromQuery(q);
    if (q.f == null) S.chips = null;
    ranked = S.chips ? C.rank(S.chips) : P.restaurants.map(function (r) { return C.evaluate(r, []); });
    if (q.pg != null) ui.page = Math.max(0, Math.min(5, Number(q.pg) || 0));
    var h = head();
    if (!S.chips || ui.editing) {
      h += '<section class="intro"><p class="eyebrow">Beijing <span lang="zh-Hans">北京</span></p>' +
        '<h1 class="display">A table<br>in <em>Beijing</em></h1><p class="orn" aria-hidden="true"></p>' +
        '<form class="ask" data-form="say"><label class="sc" for="say">Tell us about your party</label>' +
        '<textarea id="say" rows="4">' + esc(S.said) + '</textarea>' +
        '<button type="submit" class="btn btn-brass">Find our tables</button></form>' +
        '<p class="fine">A scripted demo: keyword rules read your sentence. No model is connected.</p></section>';
    } else {
      h += '<section class="req"><p class="sc">From your sentence</p>' +
        '<ul class="chips" aria-label="Filters from your sentence, tap to remove">' + S.chips.map(function (id) {
          return '<li><button type="button" class="chip" data-act="rm" data-v="' + id + '" aria-label="Remove ' + esc(C.opt(id).en) + '">' + esc(C.opt(id).en) + '<span aria-hidden="true">×</span></button></li>';
        }).join('') + '</ul>' +
        '<div class="req-acts"><button type="button" class="lnk" data-act="edit">Rewrite</button>' +
        '<details class="more"><summary>Add a request</summary><ul class="chips">' + C.OPTS.filter(function (o) { return S.chips.indexOf(o.id) < 0; }).map(function (o) {
          return '<li><button type="button" class="chip chip-add" data-act="add" data-v="' + o.id + '">' + esc(o.en) + '</button></li>';
        }).join('') + '</ul></details></div>' +
        (S.party ? '<p class="fine">A party of ' + WORDS[S.party - 1].toLowerCase() + ', noted for the order.</p>' : '') + '</section>';
    }
    h += pager();
    return h;
  }
  function swapPage(i) {
    if (i < 0 || i >= ranked.length || i === ui.page) return;
    var stage = document.getElementById('stage');
    ui.page = i;
    var nav = app.querySelector('.pager');
    stage.classList.add('out');
    setTimeout(function () {
      nav.outerHTML = pager();
      var st = document.getElementById('stage');
      st.classList.add('out');
      requestAnimationFrame(function () { requestAnimationFrame(function () { st.classList.remove('out'); }); });
      var base = C.discoverHash();
      history.replaceState(null, '', base + (base.indexOf('?') >= 0 ? '&' : '?') + 'pg=' + i);
    }, reduce() ? 0 : 320);
  }
  function reduce() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- Restaurant ---------- */
  function restaurant(r) {
    var n = C.splitName(r.nameEn), d = C.district(r);
    var ver = C.verified(r), single = C.single(r), libs = C.libDishes(r);
    var ev = S.chips && S.chips.length ? C.evaluate(r, S.chips) : null;
    var meta = [d.nameEn, r.priceBand ? C.PRICE[r.priceBand] : null, r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ')].filter(Boolean).join(' · ');
    var h = head(C.discoverHash()) +
      '<section class="r-hero"><p class="pg-num" aria-hidden="true">' + rn(r) + '</p>' +
      '<h1 class="r-name">' + esc(n.main) + '</h1>' + (n.branch ? '<p class="pg-branch">' + esc(n.branch) + '</p>' : '') +
      '<p class="pg-zh" lang="zh-Hans">' + esc(r.nameZh) + '</p><p class="pg-meta">' + esc(meta) + '</p>' +
      '<p class="orn" aria-hidden="true"></p><p class="r-why">' + esc(r.why) + '</p></section>';
    if (ev) h += '<section class="blk">' + label('Against your request') + fitHtml(ev) + '</section>';
    h += '<section class="blk">' + label('Local view') + '<p>' + esc(r.localView) + '</p></section>';
    h += '<section class="blk">' + label('Visitor view') + '<p>' + esc(r.visitorView) + '</p></section>';
    h += '<section class="blk">' + label('For your driver') +
      '<button type="button" class="ivory" data-act="taxi"><span class="iv-zh" lang="zh-Hans">' + esc(r.addressZh) + '</span><span class="iv-sm" lang="zh-Hans">' + esc(r.nameZh) + '</span></button>' +
      '<p class="addr-en">' + esc(r.addressEn) + '. ' + esc(r.areaNote) + '.</p>' +
      (r.addressPartial ? '<p class="fine">' + esc(r.addressPartial) + '</p>' : '') +
      (r.spendPerHead ? '<p class="addr-en">Spend: ' + esc(r.spendPerHead) + '.</p>' : '') +
      (r.halalSignage ? '<p class="addr-en">清真 (halal) in the shop name: signage, not a certification.</p>' : '') + '</section>';
    var dish = function (x, on) {
      return '<li class="dish' + (on ? '' : ' off') + '"><span class="d-zh" lang="zh-Hans">' + esc(x.nameZh) + '</span><span class="d-en">' + esc(x.nameEn) + '</span>' +
        (C.lib(x) ? '<button type="button" class="lnk" data-act="ask" data-v="' + x.slug + '">Ask about this dish</button>' : '') + '</li>';
    };
    h += '<section class="blk menu">' + label('The dishes') +
      (ver.length ? '<p class="sc sc-c">Named by two or more sources</p><ul class="dishes">' + ver.map(function (x) { return dish(x, true); }).join('') + '</ul>' : '') +
      (single.length ? '<p class="sc sc-c">Named by one source only</p><ul class="dishes">' + single.map(function (x) { return dish(x, false); }).join('') + '</ul>' : '') + '</section>';
    h += '<section class="blk">' + label('Still to confirm') + '<p class="center">Not yet verified by two sources: ' + esc(C.joinList(C.unverifiedList(r))) + '.</p></section>';
    h += '<section class="blk">' + label('Sources') + '<ul class="srcs">' + r.sources.map(function (s) { return '<li>' + esc(s.name) + (s.pageDate ? ' <i>' + esc(C.fmtDate(s.pageDate)) + '</i>' : '') + '</li>'; }).join('') + '</ul>' +
      '<p class="fine center">Checked ' + esc(C.fmtDate(r.checkedOn)) + '. Draft, not yet reviewed by the editor.</p></section>';
    h += '<nav class="bar" aria-label="Actions"><a class="btn btn-brass" href="' + C.orderHash(r.id) + '">Build my order</a>' +
      '<button type="button" class="btn btn-line" data-act="ask"' + (libs.length === 1 ? ' data-v="' + libs[0].slug + '"' : '') + '>Ask about a dish</button></nav>';
    return h;
  }

  /* ---------- Ask panel ---------- */
  function askPanel(r, slug, topic) {
    var libs = C.libDishes(r);
    var h = '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pn-t"><div class="pn-top"><p class="proto">Prototype · draft data</p><button type="button" class="hd-back" data-act="close">Close</button></div>' +
      '<p class="sc center">Ask about this dish</p>';
    if (!libs.length) {
      h += '<h2 class="pn-t" id="pn-t">No notes yet</h2><p class="center">None of the dishes here has an entry in our dish notes, so there is nothing to answer from. Please ask the staff, with the card for any dietary need.</p>';
    } else if (!slug) {
      h += '<h2 class="pn-t" id="pn-t">Which dish?</h2><ul class="dishes">' + libs.map(function (x) { return '<li class="dish"><button type="button" class="pick" data-act="ask" data-v="' + x.slug + '"><span class="d-zh" lang="zh-Hans">' + esc(x.nameZh) + '</span><span class="d-en">' + esc(x.nameEn) + '</span></button></li>'; }).join('') + '</ul>';
    } else {
      var d = P.dishes[slug], a = C.answer(slug, topic);
      h += '<h2 class="pn-t" id="pn-t"><span lang="zh-Hans" class="pn-zh">' + esc(d.nameZh) + '</span>' + esc(d.nameEn) + '</h2><p class="pg-branch">' + esc(d.pinyin) + '</p>' +
        '<div class="tabs" role="tablist">' + C.TOPICS.map(function (t) { return '<button type="button" role="tab" class="tab" data-act="topic" data-v="' + t[0] + '" data-s="' + slug + '" aria-selected="' + (t[0] === topic) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="ans" role="tabpanel">' + answerHtml(a) + '</div><p class="fine center">Answered only from our dish notes. Scripted, no model connected.</p>';
    }
    return h + '</div>';
  }
  function answerHtml(a) {
    var h = '';
    if (a.lead) h += '<div class="warn"><p class="warn-k">Please note</p><p>' + esc(a.lead) + '</p></div>';
    (a.paras || []).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });
    if (a.more) h += '<details class="more"><summary>Continue reading</summary><p>' + esc(a.more) + '</p></details>';
    if (a.tags && a.tags.length) h += '<p class="sc sc-c">' + a.tags.map(esc).join(' · ') + '</p>';
    if (a.alt) h += '<p>If that sounds like too much, our notes suggest ' + a.alt.map(function (x) { return esc(x.en) + ' ' + zh(x.zh); }).join(', ') + ' instead.</p>';
    if (a.rows) h += '<dl class="alg">' + a.rows.map(function (x) { return '<div><dt>' + esc(x.k) + ' <i>' + esc(x.v) + '</i></dt><dd>' + esc(x.note) + '</dd></div>'; }).join('') + '</dl>';
    if (a.diet) h += '<p><span class="sc">Diet notes</span> ' + (a.diet.length ? esc(C.cap(a.diet.join(', '))) : 'None listed') + '.</p>';
    return h;
  }

  /* ---------- Order ---------- */
  function order(r, q) {
    C.syncFromQuery(q);
    var n = C.splitName(r.nameEn);
    var o = C.buildOrder(r, S.party, S.diet);
    var h = head('#/r/' + r.id) +
      '<section class="r-hero"><p class="sc">' + esc(n.main) + '</p><h1 class="display">Your <em>order</em></h1><p class="orn" aria-hidden="true"></p></section>';
    h += '<section class="blk">' + label('Guests') + '<div class="step"><button type="button" class="st-b" data-act="party" data-v="' + (S.party - 1) + '"' + (S.party <= 1 ? ' disabled' : '') + ' aria-label="One fewer">−</button>' +
      '<p class="st-n" aria-live="polite"><span>' + S.party + '</span><i>' + (S.party === 1 ? 'guest' : 'guests') + '</i></p>' +
      '<button type="button" class="st-b" data-act="party" data-v="' + (S.party + 1) + '"' + (S.party >= 6 ? ' disabled' : '') + ' aria-label="One more">+</button></div></section>';
    h += '<section class="blk">' + label('Dietary') + '<div class="dts">' + C.DIET_OPTS.map(function (x) {
      return '<button type="button" class="dt" data-act="diet" data-v="' + x[0] + '" aria-pressed="' + (S.diet.indexOf(x[0]) >= 0) + '">' + x[1] + '</button>';
    }).join('') + '</div></section>';
    var item = function (it) {
      return '<li class="course"><p class="c-zh" lang="zh-Hans">' + esc(it.d.nameZh) + '</p><p class="c-en">' + esc(it.d.nameEn) + '</p><p class="sc sc-c">' + esc(it.qty.en) + '</p>' +
        (it.qty.src ? '<p class="fine">' + esc(it.qty.src) + '</p>' : '') +
        (it.why ? '<div class="warn"><p class="warn-k">Ask first</p><p>' + esc(it.why) + '</p></div>' : '') +
        it.notes.map(function (x) { return '<p class="fine">' + esc(x) + '</p>'; }).join('') + '</li>';
    };
    var b = '';
    if (o.order.length) b += '<ol class="courses">' + o.order.map(item).join('') + '</ol>';
    if (o.ask.length) b += '<p class="sc sc-c">To ask about before ordering</p><ol class="courses">' + o.ask.map(item).join('') + '</ol>';
    if (!o.order.length && !o.ask.length) b += '<p class="center r-why">Nothing on the verified dish list here suits this table. The card asks the staff for a recommendation.</p>';
    if (o.out.length) b += '<p class="sc sc-c">Left out</p><ul class="outs">' + o.out.map(function (x) { return '<li>' + zh(x.d.nameZh) + ' ' + esc(x.d.nameEn) + ': <i>' + esc(x.why) + '</i></li>'; }).join('') + '</ul>';
    if (o.single.length) b += '<p class="fine center">' + C.cap(o.single.length === 1 ? 'one dish' : WORDS[o.single.length - 1].toLowerCase() + ' dishes') + ' named by one source only ' + (o.single.length === 1 ? 'is' : 'are') + ' left out.</p>';
    h += '<section class="blk">' + label('Suggested') + b + '</section>';
    h += '<section class="blk go"><a class="btn btn-brass" href="' + C.cardHash(r.id) + '">Present the card to staff</a><p class="fine center">A scripted demo: rules choose only from dishes two sources name here. No model is connected.</p></section>';
    return h;
  }

  /* ---------- Staff card ---------- */
  function card(r, q) {
    C.syncFromQuery(q);
    var c = C.card(r, S.party, S.diet), one = c.cards.length === 1;
    var zhSide = '<div class="cd-side cd-zh" lang="zh-Hans"><p class="cd-g">' + esc(P.cardGreeting.zh) + '</p>' +
      (c.lines.length ? '<ul class="cd-lines">' + c.lines.map(function (l) { return '<li><span>' + esc(l.zh) + '</span><span class="cd-q">' + esc(l.qtyZh) + '</span></li>'; }).join('') + '</ul>' : '') +
      c.cards.map(function (k) {
        return '<div class="cd-d"><p class="cd-t">' + esc(k.titleZh) + '</p><p class="cd-s">' + esc(k.statement.zh) + '</p><p class="cd-p">' + esc(k.avoid.zh) + '</p>' +
          (one ? '<p class="cd-p">' + esc(k.crossContact.zh) + '</p>' : '') + (c.askAlt ? '<p class="cd-p">' + esc(k.askAlternative.zh) + '</p>' : '') + '</div>';
      }).join('') + '<p class="cd-c">' + esc(P.cardClosing.zh) + '</p></div>';
    var enSide = '<div class="cd-side cd-en" lang="en"><p class="cd-k">The reverse, for you</p><p>' + esc(P.cardGreeting.en) + '</p>' +
      (c.lines.length ? '<ul class="cd-el">' + c.lines.map(function (l) { return '<li>' + esc(l.en) + ': ' + esc(l.qtyEn) + (l.ask ? '. Ask first.' : '') + '</li>'; }).join('') + '</ul>' : '') +
      c.cards.map(function (k) { return '<p>' + esc(k.statement.en) + ' ' + esc(k.avoid.en) + (one ? ' ' + esc(k.crossContact.en) : '') + (c.askAlt ? ' ' + esc(k.askAlternative.en) : '') + '</p>'; }).join('') +
      '<p>' + esc(P.cardClosing.en) + '</p></div>';
    var h = '<header class="hd hd-card"><p class="proto">Prototype · draft data</p><div class="hd-row"><a class="hd-back" href="' + C.orderHash(r.id) + '">Close</a><span class="wm">For the staff</span><span class="hd-sp"></span></div></header>' +
      '<div class="stage"><article class="cardx ' + (ui.side === 'en' ? 'show-en' : '') + '" data-card aria-label="Card for the staff">' + zhSide + enSide + '</article>' +
      '<button type="button" class="btn btn-line turn" data-act="turn">' + (ui.side === 'en' ? 'Turn back to Chinese' : 'Turn over for English') + '</button></div>' +
      '<section class="blk after">' + c.cards.filter(function (k) { return k.noteEn; }).map(function (k) { return '<p>' + esc(k.noteEn) + '</p>'; }).join('') +
      '<div class="warn"><p class="warn-k">Please note</p><p>' + esc(P.cardsDisclaimer) + '</p></div>' +
      (c.cards.length ? '' : '<p class="fine center">No dietary need is set, so the card lists the order only.</p>') + '</section>';
    return h;
  }

  function taxi(r) {
    return '<div class="panel taxi" role="dialog" aria-modal="true" aria-label="Address for the driver"><div class="pn-top"><p class="proto">Prototype · draft data</p><button type="button" class="hd-back" data-act="close">Close</button></div>' +
      '<p class="sc center">For your driver</p><div class="ivory big" lang="zh-Hans"><span class="iv-zh">' + esc(r.addressZh) + '</span><span class="iv-sm">' + esc(r.nameZh) + '</span></div><p class="addr-en center">' + esc(r.addressEn) + '</p></div>';
  }

  /* ---------- router ---------- */
  function render() {
    var rt = C.route();
    var r = rt.id ? C.rest(rt.id) : null;
    closeOv(true);
    if (rt.name !== 'card') ui.side = 'zh';
    var page = rt.name;
    if (page === 'discover') app.innerHTML = discover(rt.q);
    else if (page === 'r' && r) app.innerHTML = restaurant(r);
    else if (page === 'order' && r) app.innerHTML = order(r, rt.q);
    else if (page === 'card' && r) app.innerHTML = card(r, rt.q);
    else app.innerHTML = head('#/') + '<p class="center">Not found.</p>';
    document.body.setAttribute('data-page', page);
    cur = r;
    var key = page + '/' + (rt.id || '');
    if (key !== lastKey) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); lastKey = key; }
    var ta = app.querySelector('textarea');
    if (ta) { var fit = function () { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }; fit(); ta.addEventListener('input', fit); }
    if (page === 'r' && r && rt.q.ask) openAsk(r, rt.q.ask === '1' ? null : rt.q.ask, rt.q.t || 'what');
    if (page === 'r' && r && rt.q.taxi) openOv(taxi(r));
  }
  function openOv(html) { ov.innerHTML = html; document.body.classList.add('locked'); requestAnimationFrame(function () { var p = ov.firstChild; if (p) p.classList.add('in'); }); }
  function closeOv(now) {
    var p = ov.firstChild;
    document.body.classList.remove('locked');
    if (!p) return;
    if (now || reduce()) { ov.innerHTML = ''; return; }
    p.classList.remove('in'); setTimeout(function () { if (ov.firstChild === p) ov.innerHTML = ''; }, 400);
  }
  function openAsk(r, slug, topic) {
    var libs = C.libDishes(r);
    if (!slug && libs.length === 1) slug = libs[0].slug;
    var html = askPanel(r, slug, topic || 'what');
    if (ov.firstChild && ov.firstChild.classList.contains('panel') && !ov.firstChild.classList.contains('taxi')) { ov.firstChild.outerHTML = html.replace('class="panel"', 'class="panel in"'); }
    else openOv(html);
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form="say"]');
    if (!f) return;
    e.preventDefault();
    S.said = f.querySelector('textarea').value.trim() || C.SAMPLE;
    var p = C.parse(S.said);
    S.chips = p.chips; if (p.party) S.party = p.party;
    S.diet = C.dietFromChips(S.chips);
    ui.page = 0; ui.editing = false;
    location.hash = C.discoverHash();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (a === 'rm' || a === 'add') {
      var i = S.chips.indexOf(v);
      if (i >= 0) S.chips.splice(i, 1); else S.chips.push(v);
      S.chips = C.sortChips(S.chips); S.diet = C.dietFromChips(S.chips); ui.page = 0;
      history.replaceState(null, '', C.discoverHash()); render();
    } else if (a === 'edit') { ui.editing = true; render(); var ta = app.querySelector('textarea'); if (ta) ta.focus(); }
    else if (a === 'next') swapPage(ui.page + 1);
    else if (a === 'prev') swapPage(ui.page - 1);
    else if (a === 'go') swapPage(Number(v));
    else if (a === 'party') { S.party = Math.max(1, Math.min(6, Number(v))); history.replaceState(null, '', C.orderHash(cur.id)); render(); }
    else if (a === 'diet') { var j = S.diet.indexOf(v); if (j >= 0) S.diet.splice(j, 1); else S.diet.push(v); history.replaceState(null, '', C.orderHash(cur.id)); render(); }
    else if (a === 'ask') openAsk(cur, v, 'what');
    else if (a === 'topic') openAsk(cur, t.getAttribute('data-s'), v);
    else if (a === 'taxi') openOv(taxi(cur));
    else if (a === 'close') closeOv();
    else if (a === 'turn') {
      ui.side = ui.side === 'en' ? 'zh' : 'en';
      var cd = app.querySelector('.cardx'); cd.classList.toggle('show-en', ui.side === 'en');
      t.textContent = ui.side === 'en' ? 'Turn back to Chinese' : 'Turn over for English';
    }
  });
  /* swipe between pages */
  var sx = null, sy = null;
  document.addEventListener('touchstart', function (e) { if (!e.target.closest('.pg-stage')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) swapPage(ui.page + (dx < 0 ? 1 : -1));
  }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOv();
    if (document.body.getAttribute('data-page') === 'discover' && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) {
      if (e.key === 'ArrowRight') swapPage(ui.page + 1);
      if (e.key === 'ArrowLeft') swapPage(ui.page - 1);
    }
  });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  render();
})();
