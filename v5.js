/* v5.js: prototype screens. Vanilla JS, no libraries. Reads window.PROTO from data.js. */
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
/* ---- V5 Lookbook: screens ---- */
(function () {
  'use strict';
  var C = window.CORE, P = C.P, S = C.S, esc = C.esc, zh = C.zh;
  var app = document.getElementById('app');
  var ov = document.getElementById('ov');
  var cur = null, popChips = false, lastKey = '';

  function edit() { return S.chips ? C.rank(S.chips) : P.restaurants.map(function (r) { return C.evaluate(r, []); }); }
  function lookNo(r) { var e = edit(); for (var i = 0; i < e.length; i++) if (e[i].r === r) return C.pad(i + 1); return C.pad(C.index(r) + 1); }
  function tag() { return '<p class="tag">Prototype · draft data</p>'; }
  function strip(back, label) {
    return '<header class="strip"><a class="strip-back" href="' + back + '">' + (label || 'Back') + '</a><a class="strip-wm" href="#/">China Food Guide</a>' + tag() + '</header>';
  }
  function glyph(r, cls) { return '<span class="glyph ' + (cls || '') + '" lang="zh-Hans" aria-hidden="true">' + esc(C.glyph(r)) + '</span>'; }
  function firstSentence(t) { return C.sentences(t)[0]; }

  /* ---------- Discover: the cover ---------- */
  function fitLine(ev) {
    if (!ev || !ev.parts.length) return '';
    if (ev.all) return '<p class="fit fit-all">Fits everything' + (ev.parts.some(function (p) { return p.state === 'ask'; }) ? '. ' + ev.parts.filter(function (p) { return p.state === 'ask'; }).map(function (p) { return esc(p.label) + ': ask staff'; }).join('. ') : '') + '</p>';
    var yes = ev.parts.filter(function (p) { return p.state === 'yes' || p.state === 'ask'; }).map(function (p) { return esc(p.label) + (p.state === 'ask' ? ' (ask staff)' : ''); });
    var no = ev.parts.filter(function (p) { return p.state === 'no' || p.state === 'unknown'; }).map(function (p) { return esc(p.label) + ' (' + esc(p.state === 'unknown' ? 'not verified' : p.text) + ')'; });
    return '<p class="fit">' + (yes.length ? '<b>Fits</b> ' + yes.join(', ') + '. ' : '') + (no.length ? '<b>Misses</b> ' + no.join(', ') + '.' : '') + '</p>';
  }
  function look(e, i) {
    var r = e.r, n = C.splitName(r.nameEn);
    var tone = ['acid', 'ink'][i % 2];
    return '<li class="look look-' + tone + '" id="look-' + i + '"><a class="look-a" href="#/r/' + r.id + '" aria-label="No. ' + C.pad(i + 1) + ', ' + esc(r.nameEn) + '">' +
      '<span class="look-block">' + glyph(r) + '<span class="look-no"><em>No.</em>' + C.pad(i + 1) + '</span>' + (e.all && S.chips && S.chips.length ? '<span class="look-hit">Fits all</span>' : '') + '</span>' +
      '<span class="look-name"><span>' + esc(n.main) + '</span></span>' + (n.branch ? '<span class="look-br"><em>' + esc(n.branch) + '</em></span>' : '') +
      '<span class="look-zh" lang="zh-Hans">' + esc(r.nameZh) + '</span>' +
      '<span class="look-why">' + esc(firstSentence(r.why)) + '</span></a>' +
      (S.chips && S.chips.length ? fitLine(e) : '') + '</li>';
  }
  function discover(q) {
    C.syncFromQuery(q);
    if (q.f == null) S.chips = null;
    var e = edit();
    var h = '<header class="cover">' + tag() +
      '<div class="cover-block" aria-hidden="true"><span class="glyph" lang="zh-Hans">京</span></div>' +
      '<h1 class="mast"><span>China</span><br><span>Food</span><br><span>Guide</span></h1>' +
      '<p class="issue"><em>The Beijing issue.</em> Six tables, no ratings, every fact from two sources.</p></header>';
    h += '<section class="brief"><form data-form="say"><label for="say" class="brief-k">Tell us the table</label>' +
      '<textarea id="say" rows="4">' + esc(S.said) + '</textarea>' +
      '<button type="submit" class="go go-acid">Make my edit</button></form>' +
      '<p class="brief-note">Scripted demo. Keyword rules, no model connected.</p></section>';
    if (S.chips) {
      h += '<section class="stickers' + (popChips ? ' pop' : '') + '"><p class="k">Your edit</p><ul class="chips">' + S.chips.map(function (id, i) {
        return '<li style="--i:' + i + '"><button type="button" class="chip" data-act="rm" data-v="' + id + '" aria-label="Remove ' + esc(C.opt(id).en) + '">' + esc(C.opt(id).en) + '<span aria-hidden="true">×</span></button></li>';
      }).join('') + '</ul><details class="add"><summary>Add to the edit</summary><ul class="chips">' + C.OPTS.filter(function (o) { return S.chips.indexOf(o.id) < 0; }).map(function (o) {
        return '<li><button type="button" class="chip chip-add" data-act="add" data-v="' + o.id + '">' + esc(o.en) + '</button></li>';
      }).join('') + '</ul></details>' + (S.party ? '<p class="party-note"><em>Party of ' + S.party + ', carried to the order.</em></p>' : '') + '</section>';
      popChips = false;
    }
    var hits = e.filter(function (x) { return x.all; }).length;
    h += '<section class="edit"><div class="edit-head"><h2 class="edit-t">The edit</h2><p class="edit-sub"><em>' +
      (S.chips && S.chips.length ? (hits ? (hits === 1 ? 'One look fits it all, the rest follow, closest first.' : hits + ' looks fit it all, the rest follow.') : 'Nothing fits it all. Closest first.') : 'All six, in guide order.') +
      ' Swipe.</em></p></div>' +
      '<ol class="gallery" data-scroll-x aria-label="Six restaurants, swipe sideways">' + e.map(look).join('') + '</ol>' +
      '<div class="g-nav"><button type="button" class="g-b" data-act="gprev" aria-label="Previous look">Prev</button><p class="g-count" aria-live="polite"><span id="gc">01</span> / 06</p><button type="button" class="g-b" data-act="gnext" aria-label="Next look">Next</button></div></section>';
    h += '<section class="index"><p class="k">Index</p><ol>' + e.map(function (x, i) {
      return '<li><a href="#/r/' + x.r.id + '"><span class="ix-n">' + C.pad(i + 1) + '</span><span class="ix-t">' + esc(C.splitName(x.r.nameEn).main) + '</span>' + zh(x.r.nameZh.replace(/（.*）/, ''), 'ix-z') + '</a></li>';
    }).join('') + '</ol></section>';
    h += foot();
    return h;
  }
  function foot() { return '<footer class="foot"><p><em>China Food Guide</em>, draft data from ' + esc(C.fmtDate(P.generatedOn)) + ', not yet reviewed by the editor. Original English, no copied reviews, no ratings.</p></footer>'; }

  /* ---------- Restaurant: the spread ---------- */
  function restaurant(r) {
    var n = C.splitName(r.nameEn), d = C.district(r);
    var ver = C.verified(r), single = C.single(r), libs = C.libDishes(r);
    var ev = S.chips && S.chips.length ? C.evaluate(r, S.chips) : null;
    var h = strip(C.discoverHash(), 'The edit') +
      '<section class="spread"><div class="sp-block">' + glyph(r) + '<p class="sp-no"><em>No.</em>' + lookNo(r) + '</p></div>' +
      '<h1 class="sp-name"><span>' + esc(n.main) + '</span></h1>' + (n.branch ? '<p class="sp-br"><em>' + esc(n.branch) + '</em></p>' : '') +
      '<p class="sp-zh" lang="zh-Hans">' + esc(r.nameZh) + '</p>' +
      '<ul class="sp-meta"><li>' + esc(d.nameEn) + '</li>' + (r.priceBand ? '<li>' + esc(C.PRICE[r.priceBand]) + '</li>' : '') + '<li>' + esc(r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ')) + '</li></ul></section>';
    h += '<p class="pull">' + esc(r.why) + '</p>';
    if (ev) h += '<section class="sec sec-fit"><p class="k">Against your edit</p>' + fitLine(ev) + '</section>';
    h += '<section class="sec cols"><div class="col col-a"><h2 class="h">Local view</h2><p>' + esc(r.localView) + '</p></div>' +
      '<div class="col col-b"><h2 class="h">Visitor view</h2><p>' + esc(r.visitorView) + '</p></div></section>';
    h += '<section class="driver"><p class="driver-k">For the driver</p><button type="button" class="driver-zh" data-act="taxi" lang="zh-Hans">' + esc(r.addressZh) + '</button>' +
      '<p class="driver-en">' + esc(r.addressEn) + '. <em>' + esc(r.areaNote) + '.</em></p>' +
      (r.addressPartial ? '<p class="driver-en dim">' + esc(r.addressPartial) + '</p>' : '') +
      '<button type="button" class="go go-acid go-sm" data-act="taxi">Full screen for the taxi</button></section>';
    var dish = function (x) {
      return '<li class="dish"><span class="d-zh" lang="zh-Hans">' + esc(x.nameZh) + '</span><span class="d-en"><em>' + esc(x.nameEn) + '</em></span>' +
        (C.lib(x) ? '<button type="button" class="d-ask" data-act="ask" data-v="' + x.slug + '">Ask about this dish</button>' : '') + '</li>';
    };
    h += '<section class="sec menu"><h2 class="h h-big">On the <em>menu</em></h2>' +
      (ver.length ? '<p class="k">Named by two or more sources</p><ul class="dishes">' + ver.map(dish).join('') + '</ul>' : '') +
      (single.length ? '<p class="k">Named by one source only</p><ul class="singles">' + single.map(function (x) { return '<li><span lang="zh-Hans">' + esc(x.nameZh) + '</span> <em>' + esc(x.nameEn) + '</em></li>'; }).join('') + '</ul>' : '') + '</section>';
    h += '<section class="sec small"><p><b>Not yet verified by two sources:</b> ' + esc(C.joinList(C.unverifiedList(r))) + '.' +
      (r.spendPerHead ? ' <b>Spend:</b> ' + esc(r.spendPerHead) + '.' : '') + (r.halalSignage ? ' <b>清真</b> (halal) is in the shop name: signage, not a certification.' : '') + '</p>' +
      '<p><b>Credits.</b> ' + r.sources.map(function (s) { return esc(s.name) + (s.pageDate ? ' (' + esc(C.fmtDate(s.pageDate)) + ')' : ''); }).join('; ') + '. Checked ' + esc(C.fmtDate(r.checkedOn)) + '.</p></section>';
    h += foot();
    h += '<nav class="dock" aria-label="Actions"><a class="dk dk-acid" href="' + C.orderHash(r.id) + '">Build my order</a><button type="button" class="dk dk-ink" data-act="ask"' + (libs.length === 1 ? ' data-v="' + libs[0].slug + '"' : '') + '>Ask about this dish</button></nav>';
    return h;
  }

  /* ---------- Ask sheet ---------- */
  function askSheet(r, slug, topic) {
    var libs = C.libDishes(r);
    var h = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t"><div class="sh-top"><p class="tag tag-dark">Prototype · draft data</p><button type="button" class="sh-x" data-act="close">Close</button></div>';
    if (!libs.length) h += '<h2 class="sh-t" id="sh-t">No notes yet</h2><p>None of the dishes here has an entry in our dish notes, so there is nothing to answer from. Ask staff, and carry the staff card for dietary needs.</p>';
    else if (!slug) h += '<h2 class="sh-t" id="sh-t">Which dish?</h2>' + libs.map(function (x) { return '<button type="button" class="go go-acid" data-act="ask" data-v="' + x.slug + '">' + esc(x.nameEn) + '</button>'; }).join('');
    else {
      var d = P.dishes[slug], a = C.answer(slug, topic);
      h += '<p class="sh-zh" lang="zh-Hans" aria-hidden="true">' + esc(d.nameZh) + '</p><h2 class="sh-t" id="sh-t">' + esc(d.nameEn) + '</h2><p class="sh-pin"><em>' + esc(d.pinyin) + '</em></p>' +
        '<div class="sh-tabs" role="tablist">' + C.TOPICS.map(function (t) { return '<button type="button" role="tab" class="sh-tab" data-act="topic" data-v="' + t[0] + '" data-s="' + slug + '" aria-selected="' + (t[0] === topic) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="sh-ans" role="tabpanel">' + answerHtml(a) + '</div><p class="sh-note"><em>Answered only from our dish notes. Scripted, no model connected.</em></p>';
    }
    return h + '</div>';
  }
  function answerHtml(a) {
    var h = '';
    if (a.lead) h += '<p class="warn"><b>Check first</b> ' + esc(a.lead) + '</p>';
    (a.paras || []).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });
    if (a.more) h += '<details class="more"><summary>Keep reading</summary><p>' + esc(a.more) + '</p></details>';
    if (a.tags && a.tags.length) h += '<p class="sh-tags">' + a.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</p>';
    if (a.alt) h += '<p>If that sounds like too much, our notes point to ' + a.alt.map(function (x) { return esc(x.en) + ' ' + zh(x.zh); }).join(', ') + ' instead.</p>';
    if (a.rows) h += '<dl class="alg">' + a.rows.map(function (x) { return '<div><dt>' + esc(x.k) + '</dt><dd><b>' + esc(x.v) + '.</b> ' + esc(x.note) + '</dd></div>'; }).join('') + '</dl>';
    if (a.diet) h += '<p><b>Diet notes:</b> ' + (a.diet.length ? esc(C.cap(a.diet.join(', '))) : 'none listed') + '.</p>';
    return h;
  }

  /* ---------- Order ---------- */
  function order(r, q) {
    C.syncFromQuery(q);
    var n = C.splitName(r.nameEn);
    var o = C.buildOrder(r, S.party, S.diet);
    var h = strip('#/r/' + r.id) + '<section class="o-head"><h1 class="o-t">Build my <em>order</em></h1><p class="o-for"><span>No.' + lookNo(r) + '</span> ' + esc(n.main) + '</p></section>';
    h += '<section class="sec"><p class="k">How many of you</p><div class="party" role="group" aria-label="Party size">' + [1, 2, 3, 4, 5, 6].map(function (k) {
      return '<button type="button" class="pk" data-act="party" data-v="' + k + '" aria-pressed="' + (k === S.party) + '">' + k + '</button>';
    }).join('') + '</div></section>';
    h += '<section class="sec"><p class="k">What the table can’t eat</p><div class="chips chips-t">' + C.DIET_OPTS.map(function (x) {
      return '<button type="button" class="chip chip-t" data-act="diet" data-v="' + x[0] + '" aria-pressed="' + (S.diet.indexOf(x[0]) >= 0) + '">' + x[1] + '</button>';
    }).join('') + '</div></section>';
    var line = function (it) {
      return '<li class="ln"><p class="ln-zh" lang="zh-Hans">' + esc(it.d.nameZh) + '</p><p class="ln-en"><em>' + esc(it.d.nameEn) + '</em></p><p class="ln-q">' + esc(it.qty.en) + '</p>' +
        (it.qty.src ? '<p class="ln-n">' + esc(it.qty.src) + '</p>' : '') + (it.why ? '<p class="warn"><b>Ask first</b> ' + esc(it.why) + '</p>' : '') +
        it.notes.map(function (x) { return '<p class="ln-n">' + esc(x) + '</p>'; }).join('') + '</li>';
    };
    var b = '';
    if (o.order.length) b += '<ol class="lines">' + o.order.map(line).join('') + '</ol>';
    if (o.ask.length) b += '<p class="k">Ask staff before ordering</p><ol class="lines">' + o.ask.map(line).join('') + '</ol>';
    if (!o.order.length && !o.ask.length) b += '<p class="pull pull-sm">Nothing on the verified dish list here fits this table. The card asks staff what they recommend.</p>';
    if (o.out.length) b += '<p class="k">Left out</p><ul class="singles">' + o.out.map(function (x) { return '<li><span lang="zh-Hans">' + esc(x.d.nameZh) + '</span> <em>' + esc(x.d.nameEn) + '</em>: ' + esc(x.why) + '</li>'; }).join('') + '</ul>';
    if (o.single.length) b += '<p class="ln-n">' + o.single.length + (o.single.length === 1 ? ' dish is' : ' dishes are') + ' named by one source only, so the order leaves ' + (o.single.length === 1 ? 'it' : 'them') + ' out.</p>';
    h += '<section class="sec"><h2 class="h h-big">The <em>order</em></h2>' + b + '</section>';
    h += '<section class="sec"><a class="go go-ink" href="' + C.cardHash(r.id) + '">Show the staff card</a><p class="brief-note brief-note-l"><em>Scripted demo: rules pick only from dishes two sources name here. No model connected.</em></p></section>';
    return h + foot();
  }

  /* ---------- Staff card ---------- */
  function card(r, q) {
    C.syncFromQuery(q);
    var c = C.card(r, S.party, S.diet), one = c.cards.length === 1;
    var h = '<header class="strip strip-card"><a class="strip-back" href="' + C.orderHash(r.id) + '">Close</a><span class="strip-wm">Show this to staff</span>' + tag() + '</header>' +
      '<article class="scard" data-card lang="zh-Hans" aria-label="Card for staff, in Chinese"><p class="sc-g">' + esc(P.cardGreeting.zh) + '</p>' +
      (c.lines.length ? '<ul class="sc-lines">' + c.lines.map(function (l) { return '<li><span>' + esc(l.zh) + '</span><span class="sc-q">' + esc(l.qtyZh) + '</span></li>'; }).join('') + '</ul>' : '') +
      c.cards.map(function (k) {
        return '<div class="sc-d"><p class="sc-t">' + esc(k.titleZh) + '</p><p class="sc-s">' + esc(k.statement.zh) + '</p><p class="sc-p">' + esc(k.avoid.zh) + '</p>' +
          (one ? '<p class="sc-p">' + esc(k.crossContact.zh) + '</p>' : '') + (c.askAlt ? '<p class="sc-p">' + esc(k.askAlternative.zh) + '</p>' : '') + '</div>';
      }).join('') + '<p class="sc-c">' + esc(P.cardClosing.zh) + '</p></article>';
    h += '<section class="gloss" lang="en"><h2 class="h">What it <em>says</em></h2><p class="ln-n">For you, not for staff.</p><ol>' +
      '<li>' + esc(P.cardGreeting.en) + '</li>' + c.lines.map(function (l) { return '<li>' + esc(l.en) + ': ' + esc(l.qtyEn) + (l.ask ? '. Ask first.' : '') + '</li>'; }).join('') +
      c.cards.map(function (k) { return '<li>' + esc(k.statement.en) + ' ' + esc(k.avoid.en) + (one ? ' ' + esc(k.crossContact.en) : '') + (c.askAlt ? ' ' + esc(k.askAlternative.en) : '') + '</li>'; }).join('') +
      '<li>' + esc(P.cardClosing.en) + '</li></ol>' + c.cards.filter(function (k) { return k.noteEn; }).map(function (k) { return '<p>' + esc(k.noteEn) + '</p>'; }).join('') +
      '<p class="warn"><b>Check first</b> ' + esc(P.cardsDisclaimer) + '</p>' + (c.cards.length ? '' : '<p class="ln-n">No dietary need is set, so the card lists the order only.</p>') + '</section>';
    return h;
  }
  function taxi(r) {
    return '<div class="taxi" role="dialog" aria-modal="true" aria-label="Address for the driver"><div class="sh-top">' + tag() + '<button type="button" class="sh-x sh-x-l" data-act="close">Close</button></div>' +
      '<p class="driver-k driver-k-l">For the driver</p><p class="tx-a" lang="zh-Hans">' + esc(r.addressZh) + '</p><p class="tx-n" lang="zh-Hans">' + esc(r.nameZh) + '</p><p class="tx-e"><em>' + esc(r.addressEn) + '</em></p></div>';
  }

  /* ---------- router ---------- */
  function render() {
    var rt = C.route();
    var r = rt.id ? C.rest(rt.id) : null;
    ov.innerHTML = ''; document.body.classList.remove('locked');
    var page = rt.name;
    if (page === 'discover') app.innerHTML = discover(rt.q);
    else if (page === 'r' && r) app.innerHTML = restaurant(r);
    else if (page === 'order' && r) app.innerHTML = order(r, rt.q);
    else if (page === 'card' && r) app.innerHTML = card(r, rt.q);
    else app.innerHTML = strip('#/') + '<p class="sec">Not found.</p>';
    document.body.setAttribute('data-page', page);
    cur = r;
    var key = page + '/' + (rt.id || '');
    if (key !== lastKey) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); lastKey = key; }
    var ta = app.querySelector('textarea');
    if (ta) { var fit = function () { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }; fit(); ta.addEventListener('input', fit); }
    var g = app.querySelector('.gallery');
    if (g) g.addEventListener('scroll', function () { var w = g.firstElementChild ? g.firstElementChild.getBoundingClientRect().width + 14 : 1; var gc = document.getElementById('gc'); if (gc) gc.textContent = C.pad(Math.min(6, Math.round(g.scrollLeft / w) + 1)); }, { passive: true });
    if (page === 'r' && r && rt.q.ask) openAsk(r, rt.q.ask === '1' ? null : rt.q.ask, rt.q.t || 'what');
    if (page === 'r' && r && rt.q.taxi) { ov.innerHTML = taxi(r); document.body.classList.add('locked'); }
  }
  function openAsk(r, slug, topic) {
    var libs = C.libDishes(r);
    if (!slug && libs.length === 1) slug = libs[0].slug;
    var fresh = !ov.querySelector('.sheet');
    ov.innerHTML = askSheet(r, slug, topic || 'what');
    if (!fresh) ov.querySelector('.sheet').classList.add('still');
    document.body.classList.add('locked');
  }
  function gstep(dir) {
    var g = app.querySelector('.gallery'); if (!g) return;
    var w = g.firstElementChild.getBoundingClientRect().width + 14;
    g.scrollBy({ left: dir * w, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form="say"]');
    if (!f) return;
    e.preventDefault();
    S.said = f.querySelector('textarea').value.trim() || C.SAMPLE;
    var p = C.parse(S.said);
    S.chips = p.chips; if (p.party) S.party = p.party;
    S.diet = C.dietFromChips(S.chips);
    popChips = true;
    location.hash = C.discoverHash();
    setTimeout(function () { var s = app.querySelector('.stickers'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (a === 'rm' || a === 'add') {
      var i = S.chips.indexOf(v);
      if (i >= 0) S.chips.splice(i, 1); else S.chips.push(v);
      S.chips = C.sortChips(S.chips); S.diet = C.dietFromChips(S.chips);
      var y = window.scrollY; history.replaceState(null, '', C.discoverHash()); render(); window.scrollTo(0, y);
    } else if (a === 'gnext') gstep(1);
    else if (a === 'gprev') gstep(-1);
    else if (a === 'party') { S.party = Number(v); var y2 = window.scrollY; history.replaceState(null, '', C.orderHash(cur.id)); render(); window.scrollTo(0, y2); }
    else if (a === 'diet') { var j = S.diet.indexOf(v); if (j >= 0) S.diet.splice(j, 1); else S.diet.push(v); var y3 = window.scrollY; history.replaceState(null, '', C.orderHash(cur.id)); render(); window.scrollTo(0, y3); }
    else if (a === 'ask') openAsk(cur, v, 'what');
    else if (a === 'topic') openAsk(cur, t.getAttribute('data-s'), v);
    else if (a === 'taxi') { ov.innerHTML = taxi(cur); document.body.classList.add('locked'); }
    else if (a === 'close') { ov.innerHTML = ''; document.body.classList.remove('locked'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { ov.innerHTML = ''; document.body.classList.remove('locked'); } });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  render();
})();
