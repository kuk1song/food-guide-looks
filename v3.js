/* v3.js: prototype screens. Vanilla JS, no libraries. Reads window.PROTO from data.js. */
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
/* ---- V3 Plain: screens ---- */
(function () {
  'use strict';
  var C = window.CORE, P = C.P, S = C.S, esc = C.esc, zh = C.zh;
  var app = document.getElementById('app');
  var ui = { edit: false };

  function num(r) { return C.pad(C.index(r) + 1); }
  function top(back) {
    return '<header class="top"><div class="top-row">' +
      (back ? '<a class="top-back" href="' + back + '">Back</a>' : '<a class="wm" href="#/">China Food Guide</a>') +
      '<span class="proto">Prototype · draft data</span></div></header>';
  }
  function row(label, body, cls, wide) {
    return '<section class="row' + (cls ? ' ' + cls : '') + '"><h2 class="lab">' + label + '</h2><div class="cell">' + body + '</div>' + (wide || '') + '</section>';
  }

  /* ---------- Discover ---------- */
  function fitLines(ev) {
    var fits = ev.parts.filter(function (p) { return p.state === 'yes' || p.state === 'ask'; })
      .map(function (p) { return esc(p.label) + (p.state === 'ask' ? ' (ask staff)' : ''); });
    var miss = ev.parts.filter(function (p) { return p.state === 'no' || p.state === 'unknown'; })
      .map(function (p) { return esc(p.label) + ' <span class="mute">(' + esc(p.state === 'unknown' ? 'not verified' : p.text) + ')</span>'; });
    return (fits.length ? '<span class="fit"><b>Fits</b> ' + fits.join(' · ') + '</span>' : '') +
      (miss.length ? '<span class="fit"><b>Misses</b> ' + miss.join(' · ') + '</span>' : '');
  }
  function item(r, ev, hit) {
    var n = C.splitName(r.nameEn);
    var meta = [C.district(r).nameEn, r.priceBand ? C.PRICE[r.priceBand] : null, r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ')].filter(Boolean).join(' · ');
    return '<li><a class="item" href="#/r/' + r.id + '">' +
      '<span class="n' + (hit ? ' hit' : '') + '">' + num(r) + '</span>' +
      '<span class="ib"><span class="nm">' + esc(n.main) + '</span>' + (n.branch ? '<span class="br">' + esc(n.branch) + '</span>' : '') +
      zh(r.nameZh, 'nz') + '<span class="meta">' + esc(meta) + '</span>' + (ev ? fitLines(ev) : '') + '</span></a></li>';
  }
  function discover(q) {
    C.syncFromQuery(q);
    if (q.f == null) S.chips = null;
    var h = top() +
      '<section class="hero"><p class="hero-n" aria-hidden="true">06</p>' +
      '<h1>Places to eat in Beijing <span lang="zh-Hans">北京</span></h1>' +
      '<p class="lede">An English guide for a first visit. A fact appears only when two different public sources agree. No ratings.</p></section>';
    h += row('Your meal',
      '<form data-form="say"><label class="vh" for="say">Describe your meal in one sentence</label>' +
      '<textarea id="say" name="say" rows="4">' + esc(S.said) + '</textarea>' +
      '<button class="btn" type="submit">Make filters</button></form>' +
      '<p class="note">Scripted demo: keyword rules turn the sentence into filters. No model is connected.</p>', 'r-say');
    if (S.chips) {
      var chips = S.chips.map(function (id) {
        return '<li><button type="button" class="chip" data-act="rm" data-v="' + id + '" aria-label="Remove ' + esc(C.opt(id).en) + '">' + esc(C.opt(id).en) + '<span class="x" aria-hidden="true">×</span></button></li>';
      }).join('');
      var table = C.GROUPS.map(function (g) {
        return '<div class="ftab"><p class="fg">' + C.GROUP_EN[g] + '</p><ul class="fopts">' + C.OPTS.filter(function (o) { return o.g === g; }).map(function (o) {
          return '<li><button type="button" class="fopt" data-act="tg" data-v="' + o.id + '" aria-pressed="' + (S.chips.indexOf(o.id) >= 0) + '">' + esc(o.en) + '</button></li>';
        }).join('') + '</ul></div>';
      }).join('');
      h += row('Filters',
        (chips ? '<ul class="chips">' + chips + '</ul>' : '<p class="note">No filters. Every restaurant is listed.</p>') +
        (S.party ? '<p class="note">Party of ' + S.party + ' noted for the order. The list does not filter by it.</p>' : '') +
        '<button type="button" class="lnk" data-act="edit" aria-expanded="' + ui.edit + '">' + (ui.edit ? 'Close filter table' : 'Edit filters') + '</button>' +
        (ui.edit ? '<div class="ftable">' + table + '</div>' : ''), 'r-filters');
      var ranked = C.rank(S.chips);
      var hits = ranked.filter(function (e) { return e.all; });
      var rest = ranked.filter(function (e) { return !e.all; });
      if (!S.chips.length) { hits = []; rest = ranked; }
      if (hits.length) h += row('Matches', '<p class="count">' + (hits.length === 1 ? 'One fits' : hits.length + ' fit') + ' every filter.</p>', 'r-list',
        '<ol class="list">' + hits.map(function (e) { return item(e.r, e, true); }).join('') + '</ol>');
      if (rest.length) h += row(hits.length ? 'Others' : 'Results', '<p class="count">' + (!S.chips.length ? 'All six, in guide order.' : hits.length ? 'The rest of the guide, closest first.' : 'Nothing fits every filter. Closest first.') + '</p>', 'r-list',
        '<ol class="list">' + rest.map(function (e) { return item(e.r, S.chips.length ? e : null, false); }).join('') + '</ol>');
    } else {
      h += row('All six', '<p class="count">In guide order. Describe your meal above to sort them.</p>', 'r-list', '<ol class="list">' + P.restaurants.map(function (r) { return item(r, null, false); }).join('') + '</ol>');
    }
    h += foot();
    return h;
  }
  function foot() {
    return '<footer class="foot"><p>China Food Guide. Draft data generated ' + esc(C.fmtDate(P.generatedOn)) + ', not yet reviewed by the editor. Original English writing, no copied reviews, no ratings.</p></footer>';
  }

  /* ---------- Restaurant ---------- */
  function restaurant(r, q) {
    var n = C.splitName(r.nameEn);
    var d = C.district(r);
    var ver = C.verified(r), single = C.single(r);
    var libs = C.libDishes(r);
    var uv = C.unverifiedList(r);
    var ev = S.chips && S.chips.length ? C.evaluate(r, S.chips) : null;
    var h = top(C.discoverHash()) +
      '<section class="rhead"><p class="r-n' + (ev && ev.all ? ' hit' : '') + '" aria-label="Number ' + num(r) + ' of 06">' + num(r) + '</p>' +
      '<h1 class="r-nm">' + esc(n.main) + '</h1>' + (n.branch ? '<p class="r-br">' + esc(n.branch) + '</p>' : '') +
      '<p class="r-zh" lang="zh-Hans">' + esc(r.nameZh) + '</p></section>';
    h += '<dl class="facts">' +
      '<div><dt>Area</dt><dd>' + esc(d.nameEn) + ' ' + zh(d.nameZh) + '. ' + esc(r.areaNote) + '</dd></div>' +
      (r.priceBand ? '<div><dt>Price</dt><dd>' + esc(C.PRICE[r.priceBand]) + (r.spendPerHead ? ', ' + esc(r.spendPerHead) : '') + '</dd></div>' : '') +
      '<div><dt>Food</dt><dd>' + esc(r.cuisines.map(function (c) { return C.CUISINE[c]; }).join(', ')) + '</dd></div>' +
      (r.halalSignage ? '<div><dt>Halal</dt><dd>清真 in the shop name. Signage, not a certification.</dd></div>' : '') +
      '</dl>';
    if (ev) h += row('Your filters', '<p class="fitbox">' + fitLines(ev) + '</p>');
    h += row('Why', '<p class="big">' + esc(r.why) + '</p>');
    h += row('Local view', '<p>' + esc(r.localView) + '</p>');
    h += row('Visitor view', '<p>' + esc(r.visitorView) + '</p>');
    h += row('Taxi', '<p class="note">Show this to the driver.</p><button type="button" class="addr" data-act="taxi" lang="zh-Hans">' + esc(r.addressZh) + '</button>' +
      '<p class="addr-en">' + esc(r.addressEn) + '</p>' + (r.addressPartial ? '<p class="note">' + esc(r.addressPartial) + '</p>' : '') +
      '<button type="button" class="lnk" data-act="taxi">Show full screen</button>', 'r-taxi');
    var dish = function (x, on) {
      var lib = C.lib(x);
      return '<li class="dish' + (on ? '' : ' off') + '"><span class="dz" lang="zh-Hans">' + esc(x.nameZh) + '</span><span class="de">' + esc(x.nameEn) + '</span>' +
        (x.note ? '<span class="dn">' + esc(x.note) + '</span>' : '') +
        (lib ? '<button type="button" class="lnk" data-act="ask" data-v="' + x.slug + '">Ask about this dish</button>' : '') + '</li>';
    };
    h += row('Dishes',
      (ver.length ? '<p class="sub">Named by two or more sources</p><ul class="dishes">' + ver.map(function (x) { return dish(x, true); }).join('') + '</ul>' : '') +
      (single.length ? '<p class="sub">Named by one source only</p><ul class="dishes">' + single.map(function (x) { return dish(x, false); }).join('') + '</ul>' : ''));
    h += row('Unverified', '<p>Not yet verified by two sources: ' + esc(C.joinList(uv)) + '.</p>');
    h += row('Sources', '<ol class="src">' + r.sources.map(function (s) { return '<li>' + esc(s.name) + (s.pageDate ? ', ' + esc(C.fmtDate(s.pageDate)) : '') + '</li>'; }).join('') + '</ol>' +
      '<p class="note">Checked ' + esc(C.fmtDate(r.checkedOn)) + '.</p>');
    h += foot();
    h += '<nav class="actions" aria-label="Actions"><a class="act act-1" href="' + C.orderHash(r.id) + '">Build my order</a>' +
      '<button type="button" class="act act-2" data-act="ask"' + (libs.length === 1 ? ' data-v="' + libs[0].slug + '"' : '') + '>Ask about this dish</button></nav>';
    return h;
  }

  /* ---------- Ask sheet ---------- */
  function askSheet(r, slug, topic) {
    var libs = C.libDishes(r);
    var h = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">' +
      '<div class="sh-top"><p class="sh-k">Ask about this dish <span class="proto">Prototype · draft data</span></p><button type="button" class="lnk" data-act="close">Close</button></div>';
    if (!libs.length) {
      h += '<h2 class="sh-t" id="sh-t">No dish notes yet</h2><p>None of the dishes here has an entry in our dish notes, so there is nothing to answer from. Ask staff, and use the staff card for dietary needs.</p>';
    } else if (!slug) {
      h += '<h2 class="sh-t" id="sh-t">Which dish?</h2><ul class="pick">' + libs.map(function (x) { return '<li><button type="button" class="pickb" data-act="ask" data-v="' + x.slug + '"><span lang="zh-Hans">' + esc(x.nameZh) + '</span> ' + esc(x.nameEn) + '</button></li>'; }).join('') + '</ul>';
    } else {
      var d = P.dishes[slug];
      var a = C.answer(slug, topic);
      h += '<h2 class="sh-t" id="sh-t"><span lang="zh-Hans">' + esc(d.nameZh) + '</span> ' + esc(d.nameEn) + '</h2><p class="pin">' + esc(d.pinyin) + '</p>' +
        '<div class="topics" role="tablist">' + C.TOPICS.map(function (t) { return '<button type="button" role="tab" class="tp" data-act="topic" data-v="' + t[0] + '" data-s="' + slug + '" aria-selected="' + (t[0] === topic) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="ans" role="tabpanel">' + answerHtml(a) + '<p class="note">Answered only from our dish notes. Scripted, no model connected.</p></div>';
    }
    return h + '</div>';
  }
  function answerHtml(a) {
    var h = '';
    if (a.lead) h += '<p class="warn"><b>Check</b> ' + esc(a.lead) + '</p>';
    (a.paras || []).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });
    if (a.more) h += '<details><summary>Read the rest</summary><p>' + esc(a.more) + '</p></details>';
    if (a.tags && a.tags.length) h += '<p class="tags">' + a.tags.map(esc).join(' · ') + '</p>';
    if (a.alt) h += '<p>If that sounds like too much, our notes suggest instead: ' + a.alt.map(function (x) { return esc(x.en) + ' ' + zh(x.zh); }).join(', ') + '.</p>';
    if (a.rows) h += '<table class="alg"><tbody>' + a.rows.map(function (x) { return '<tr><th scope="row">' + esc(x.k) + '</th><td><b>' + esc(x.v) + '</b> ' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (a.diet) h += '<p><b>Diet notes</b> ' + (a.diet.length ? esc(C.cap(a.diet.join(', '))) : 'None listed') + '.</p>';
    return h;
  }

  /* ---------- Order ---------- */
  function order(r, q) {
    C.syncFromQuery(q);
    var n = C.splitName(r.nameEn);
    var o = C.buildOrder(r, S.party, S.diet);
    var h = top('#/r/' + r.id) +
      '<section class="ohead"><h1>Build my order</h1><p class="o-for"><span class="o-n">' + num(r) + '</span> ' + esc(n.main) + '</p></section>';
    h += row('Party', '<div class="party" role="group" aria-label="How many of you">' + [1, 2, 3, 4, 5, 6].map(function (k) {
      return '<button type="button" class="pk" data-act="party" data-v="' + k + '" aria-pressed="' + (k === S.party) + '">' + k + '</button>';
    }).join('') + '</div>');
    h += row('Diet', '<ul class="tog">' + C.DIET_OPTS.map(function (x) {
      var on = S.diet.indexOf(x[0]) >= 0;
      return '<li><button type="button" class="tgb" data-act="diet" data-v="' + x[0] + '" aria-pressed="' + on + '"><span>' + x[1] + '</span><span class="st">' + (on ? 'On' : 'Off') + '</span></button></li>';
    }).join('') + '</ul>');
    var line = function (it, i) {
      return '<li class="ol"><span class="ol-i">' + (i + 1) + '</span><div><p class="ol-zh" lang="zh-Hans">' + esc(it.d.nameZh) + '</p><p class="ol-en">' + esc(it.d.nameEn) + '</p>' +
        '<p class="ol-q">' + esc(it.qty.en) + '</p>' + (it.qty.src ? '<p class="note">' + esc(it.qty.src) + '</p>' : '') +
        (it.why ? '<p class="warn"><b>Ask first</b> ' + esc(it.why) + '</p>' : '') +
        it.notes.map(function (x) { return '<p class="note">' + esc(x) + '</p>'; }).join('') + '</div></li>';
    };
    var body = '';
    if (o.order.length) body += '<ol class="olist">' + o.order.map(line).join('') + '</ol>';
    if (o.ask.length) body += '<p class="sub">Ask staff before ordering</p><ol class="olist">' + o.ask.map(function (it, i) { return line(it, o.order.length + i); }).join('') + '</ol>';
    if (!o.order.length && !o.ask.length) body += '<p class="big">Nothing on this restaurant’s verified dish list fits. The card asks staff to recommend something.</p>';
    if (o.out.length) body += '<p class="sub">Left out</p><ul class="outl">' + o.out.map(function (x) { return '<li>' + zh(x.d.nameZh) + ' ' + esc(x.d.nameEn) + ': ' + esc(x.why) + '</li>'; }).join('') + '</ul>';
    if (o.single.length) body += '<p class="note">' + o.single.length + (o.single.length === 1 ? ' dish is' : ' dishes are') + ' named by one source only, so the order leaves ' + (o.single.length === 1 ? 'it' : 'them') + ' out.</p>';
    h += row('Order', body, 'r-order');
    h += '<div class="o-go"><a class="btn btn-wide" href="' + C.cardHash(r.id) + '">Show card to staff</a>' +
      '<p class="note">Scripted demo: rules choose only from dishes two sources name here. No model is connected.</p></div>';
    return h + foot();
  }

  /* ---------- Staff card ---------- */
  function card(r, q) {
    C.syncFromQuery(q);
    var c = C.card(r, S.party, S.diet);
    var h = '<header class="top top-card"><div class="top-row"><a class="top-back" href="' + C.orderHash(r.id) + '">Close</a><span class="proto">Prototype · draft data</span></div></header>' +
      '<article class="scard" lang="zh-Hans" aria-label="Card for staff, in Chinese">' +
      '<p class="sc-g">' + esc(P.cardGreeting.zh) + '</p>';
    if (c.lines.length) h += '<ul class="sc-lines">' + c.lines.map(function (l) { return '<li><span>' + esc(l.zh) + '</span><span class="sc-q">' + esc(l.qtyZh) + '</span></li>'; }).join('') + '</ul>';
    var one = c.cards.length === 1;
    c.cards.forEach(function (k) {
      h += '<div class="sc-d"><p class="sc-t">' + esc(k.titleZh) + '</p><p class="sc-s">' + esc(k.statement.zh) + '</p><p class="sc-p">' + esc(k.avoid.zh) + '</p>' +
        (one ? '<p class="sc-p">' + esc(k.crossContact.zh) + '</p>' : '') + (c.askAlt ? '<p class="sc-p">' + esc(k.askAlternative.zh) + '</p>' : '') + '</div>';
    });
    h += '<p class="sc-c">' + esc(P.cardClosing.zh) + '</p></article>';
    h += '<section class="gloss" lang="en"><h2 class="lab">For you, not for staff</h2><p class="note">What the card says, in English.</p><ol class="gl">' +
      '<li>' + esc(P.cardGreeting.en) + '</li>' +
      c.lines.map(function (l) { return '<li>' + esc(l.en) + ': ' + esc(l.qtyEn) + (l.ask ? '. Ask first.' : '') + '</li>'; }).join('') +
      c.cards.map(function (k) { return '<li>' + esc(k.statement.en) + ' ' + esc(k.avoid.en) + (one ? ' ' + esc(k.crossContact.en) : '') + (c.askAlt ? ' ' + esc(k.askAlternative.en) : '') + '</li>'; }).join('') +
      '<li>' + esc(P.cardClosing.en) + '</li></ol>' +
      c.cards.filter(function (k) { return k.noteEn; }).map(function (k) { return '<p>' + esc(k.noteEn) + '</p>'; }).join('') +
      '<p class="warn"><b>Note</b> ' + esc(P.cardsDisclaimer) + '</p>' +
      (c.cards.length ? '' : '<p class="note">No dietary need is set, so the card only lists the order.</p>') + '</section>';
    return h;
  }

  /* ---------- taxi overlay ---------- */
  function taxi(r) {
    return '<div class="taxi" role="dialog" aria-modal="true" aria-label="Address for the driver"><div class="top-row"><button type="button" class="top-back" data-act="close">Close</button><span class="proto">Prototype · draft data</span></div>' +
      '<p class="tx-k">For the driver</p><p class="tx-a" lang="zh-Hans">' + esc(r.addressZh) + '</p><p class="tx-n" lang="zh-Hans">' + esc(r.nameZh) + '</p><p class="tx-e">' + esc(r.addressEn) + '</p></div>';
  }

  /* ---------- router + events ---------- */
  var overlay = document.getElementById('ov');
  var cur = null;
  function render() {
    var rt = C.route();
    var r = rt.id ? C.rest(rt.id) : null;
    overlay.innerHTML = '';
    document.body.classList.remove('locked');
    var page = rt.name;
    if (page === 'discover') app.innerHTML = discover(rt.q);
    else if (page === 'r' && r) app.innerHTML = restaurant(r, rt.q);
    else if (page === 'order' && r) app.innerHTML = order(r, rt.q);
    else if (page === 'card' && r) app.innerHTML = card(r, rt.q);
    else app.innerHTML = top() + '<p class="pad">Not found. <a href="#/">Discover</a></p>';
    document.body.setAttribute('data-page', page);
    cur = r;
    var ta = app.querySelector('textarea');
    if (ta) { var fit = function () { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }; fit(); ta.addEventListener('input', fit); }
    if (page === 'r' && r && rt.q.ask) openAsk(r, rt.q.ask === '1' ? null : rt.q.ask, rt.q.t || 'what');
    if (page === 'r' && r && rt.q.taxi) openTaxi(r);
  }
  function openAsk(r, slug, topic) {
    var libs = C.libDishes(r);
    if (!slug && libs.length === 1) slug = libs[0].slug;
    overlay.innerHTML = askSheet(r, slug, topic || 'what');
    document.body.classList.add('locked');
    var b = overlay.querySelector('.sheet button, .sheet a');
    if (b) b.focus({ preventScroll: true });
  }
  function openTaxi(r) { overlay.innerHTML = taxi(r); document.body.classList.add('locked'); }
  function setHash(h) { history.replaceState(null, '', h); render(); }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form="say"]');
    if (!f) return;
    e.preventDefault();
    S.said = f.querySelector('textarea').value.trim() || C.SAMPLE;
    var p = C.parse(S.said);
    S.chips = p.chips;
    if (p.party) S.party = p.party;
    S.diet = C.dietFromChips(S.chips);
    ui.jump = true;
    location.hash = C.discoverHash();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (a === 'rm' || a === 'tg') {
      var i = S.chips.indexOf(v);
      if (i >= 0) S.chips.splice(i, 1); else S.chips.push(v);
      S.chips = C.sortChips(S.chips);
      S.diet = C.dietFromChips(S.chips);
      setHash(C.discoverHash());
    } else if (a === 'edit') { ui.edit = !ui.edit; render(); }
    else if (a === 'party') { S.party = Number(v); setHash(C.orderHash(cur.id)); }
    else if (a === 'diet') {
      var j = S.diet.indexOf(v);
      if (j >= 0) S.diet.splice(j, 1); else S.diet.push(v);
      setHash(C.orderHash(cur.id));
    }
    else if (a === 'ask') openAsk(cur, v, 'what');
    else if (a === 'topic') openAsk(cur, t.getAttribute('data-s'), v);
    else if (a === 'taxi') openTaxi(cur);
    else if (a === 'close') { overlay.innerHTML = ''; document.body.classList.remove('locked'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.innerHTML) { overlay.innerHTML = ''; document.body.classList.remove('locked'); } });
  window.addEventListener('hashchange', function () {
    render();
    var f = ui.jump && app.querySelector('.r-filters');
    ui.jump = false;
    if (f) window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - app.querySelector('.top').offsetHeight); else window.scrollTo(0, 0);
  });
  render();
})();
