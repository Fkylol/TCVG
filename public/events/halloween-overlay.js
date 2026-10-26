/*!
 * halloween-overlay.js — overlay Halloween autonome (aucune dépendance)
 * Sorcière + chauves-souris, bonbons qui tombent, toiles d'araignée avec
 * araignées qui descendent, brume, vignette, citrouilles.
 *
 * Intégration : <script src="halloween-overlay.js" defer></script>
 *
 * Options (avant le script) :
 *   window.HALLOWEEN_OVERLAY = { force: true, candies: true, witch: true,
 *                                bats: true, spiders: true, fog: true,
 *                                zIndex: 9999 };
 *   force: true  -> actif toute l'année (sinon seulement du 15 oct. au 2 nov.)
 *
 * Booster (clic sur la sorcière, 1 par heure) :
 *   boosterEndpoint: '/api/halloween/booster'   // POST, cookies de session envoyés
 *     -> succès : 200 { ok:true, booster:{ name:'Booster Halloween' } }
 *     -> trop tôt : 429 { ok:false, retryAfterMs: 1234567 }
 *   onClaim: function () { return Promise<{ok, booster?, retryAfterMs?}> }  // alternative
 *   boosterCooldownMs: 3600000
 *   Événement émis au succès : window.addEventListener('halloween:booster', e => e.detail)
 *   Sans endpoint ni onClaim : mode démo (rien n'est donné).
 *   IMPORTANT : la limite d'1 booster/heure et l'attribution doivent être
 *   appliquées par le SERVEUR (le navigateur n'est qu'un confort d'affichage).
 *
 * Effet torche (zone assombrie + lampe qui suit la souris + coupures de batterie) :
 *   torch: true, torchTarget: '.ma-zone-cartes'   // sélecteur CSS de la zone
 *   torchRadius: 170 (px), torchDarkness: 0.86 (0 à 1), torchPadding: 12 (px),
 *   torchFlicker: true, torchTouch: false (inactif sur écrans tactiles)
 *   Test manuel d'une coupure : HalloweenOverlay.flicker() (ou flicker(0..3) pour un scénario précis)
 */
(function () {
  'use strict';

  var opts = Object.assign(
    { force: false, candies: true, witch: true, bats: true, spiders: true,
      fog: true, pumpkins: true, vignette: true, zIndex: 9999, toggle: true,
      boosterPumpkin: false,
      boosterEndpoint: null, boosterCooldownMs: 3600000, onClaim: null,
      torch: false, torchTarget: null, torchRadius: 170, torchDarkness: 0.86,
      torchPadding: 12, torchFlicker: true, torchTouch: false },
    window.HALLOWEEN_OVERLAY || {}
  );

  var STORAGE_KEY = 'halloween-overlay-off';
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Période d'activation : 15 octobre -> 2 novembre -----------------
  function inSeason() {
    var d = new Date(), m = d.getMonth(), day = d.getDate();
    return (m === 9 && day >= 15) || (m === 10 && day <= 2);
  }
  if (!opts.force && !inSeason()) return;

  var userOff = false;
  try { userOff = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}


  // --- Toile d'araignée détaillée (générée) ------------------------------
  // Moyeu décentré, fils radiaux irréguliers, cercles qui s'affaissent
  // entre les rayons, découpée en triangle dans le coin de l'écran.
  function webSVG() {
    var cx = 62, cy = 62, n = 14, i, k;
    var seed = 7;
    function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var ang = [];
    for (i = 0; i < n; i++) ang.push((i * 360 / n) + (r() - 0.5) * 12);
    ang.sort(function (a, b) { return a - b; });
    function pt(a, rad) {
      var t = a * Math.PI / 180;
      return [cx + Math.cos(t) * rad, cy + Math.sin(t) * rad];
    }
    function f(v) { return v.toFixed(1); }
    var out = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="hw-wc"><path d="M0 0 H200 L0 200 Z"/></clipPath></defs>' +
      '<g clip-path="url(#hw-wc)" fill="none" stroke="#ffd98a" stroke-linecap="round">';
    // fils radiaux
    var rad = '';
    for (i = 0; i < n; i++) {
      var p = pt(ang[i], 320);
      rad += 'M' + cx + ' ' + cy + 'L' + f(p[0]) + ' ' + f(p[1]);
    }
    out += '<path d="' + rad + '" stroke-width="1" stroke-opacity=".9"/>';
    // cercles concentriques avec affaissement
    var radii = [7, 13, 20, 28, 37, 47, 58, 71, 85, 101, 118, 137, 158, 181, 206];
    for (k = 0; k < radii.length; k++) {
      var d = '';
      for (i = 0; i < n; i++) {
        var a1 = ang[i], a2 = (i === n - 1) ? ang[0] + 360 : ang[i + 1];
        var r1 = radii[k] * (1 + (r() - 0.5) * 0.05);
        var r2 = radii[k] * (1 + (r() - 0.5) * 0.05);
        var p1 = pt(a1, r1), p2 = pt(a2, r2);
        if ((p1[0] < -30 && p2[0] < -30) || (p1[1] < -30 && p2[1] < -30) ||
            (p1[0] + p1[1] > 250 && p2[0] + p2[1] > 250)) continue;
        var half = (a2 - a1) / 2 * Math.PI / 180;
        var c = pt((a1 + a2) / 2, radii[k] * Math.cos(half) * (0.86 + r() * 0.04));
        d += 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'Q' + f(c[0]) + ' ' + f(c[1]) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
      }
      out += '<path d="' + d + '" stroke-width="' + (k < 4 ? 0.7 : 0.9) + '" stroke-opacity="' + (k < 4 ? 0.8 : 0.9) + '"/>';
    }
    // fil de cadre (diagonale) + petit noeud au centre
    out += '<path d="M200 0 L0 200" stroke-width="1.6"/></g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="1.6" fill="#fff3cf"/></svg>';
    return out;
  }

  // --- SVG originaux ----------------------------------------------------
  var SVG = {
    witch:
      '<svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="hw-broom" x1="0" x2="1"><stop offset="0" stop-color="#8b5a2b"/><stop offset="1" stop-color="#c58a4a"/></linearGradient></defs>' +
      // balai
      '<rect x="40" y="78" width="150" height="5" rx="2.5" fill="url(#hw-broom)"/>' +
      '<path d="M40 80 L8 64 L12 80 L8 96 Z" fill="#e8b33a"/>' +
      '<path d="M40 80 L14 72 M40 80 L14 88" stroke="#b9801d" stroke-width="2"/>' +
      // robe
      '<path d="M100 78 C96 52 118 40 134 50 C146 58 146 70 150 78 Z" fill="#5b2a86"/>' +
      // tête
      '<circle cx="138" cy="42" r="10" fill="#9bd16b"/>' +
      '<path d="M146 42 q6 3 3 8" stroke="#7fb352" stroke-width="2" fill="none"/>' +
      // cheveux
      '<path d="M128 40 C118 44 116 56 122 62 C124 52 130 46 134 44 Z" fill="#f08a24"/>' +
      // chapeau
      '<ellipse cx="136" cy="34" rx="22" ry="5" fill="#2a1442"/>' +
      '<path d="M122 34 L140 4 L150 34 Z" fill="#3b1c5e"/>' +
      '<rect x="124" y="28" width="24" height="5" fill="#e8b33a"/>' +
      // jambe
      '<path d="M118 78 q-4 14 6 18" stroke="#2a1442" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      // bras
      '<path d="M140 58 L172 74" stroke="#5b2a86" stroke-width="6" stroke-linecap="round"/>' +
      '</svg>',

    bat:
      '<svg viewBox="0 0 64 32" xmlns="http://www.w3.org/2000/svg">' +
      '<path fill="#3a1d5c" stroke="#9b6bff" stroke-opacity=".5" stroke-width=".8" d="M32 10 C28 4 20 2 6 6 C12 10 12 16 10 22 C16 18 20 20 24 28 C26 22 29 20 32 24 C35 20 38 22 40 28 C44 20 48 18 54 22 C52 16 52 10 58 6 C44 2 36 4 32 10 Z"/>' +
      '<circle cx="29.5" cy="12" r="1" fill="#ff8a1f"/><circle cx="34.5" cy="12" r="1" fill="#ff8a1f"/>' +
      '</svg>',

    candy: function (c1, c2) {
      return '<svg viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3 L16 12 L2 21 Z" fill="' + c2 + '"/>' +
        '<path d="M46 3 L32 12 L46 21 Z" fill="' + c2 + '"/>' +
        '<ellipse cx="24" cy="12" rx="13" ry="9" fill="' + c1 + '"/>' +
        '<path d="M16 8 Q24 14 32 8 M16 15 Q24 21 32 15" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none"/>' +
        '</svg>';
    },

    spider:
      '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
      '<g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">' +
      '<path d="M20 22 L6 12 L2 20 M20 22 L5 24 L3 33 M20 22 L8 34 L11 39 M20 22 L34 12 L38 20 M20 22 L35 24 L37 33 M20 22 L32 34 L29 39"/>' +
      '</g><circle cx="20" cy="20" r="7" fill="currentColor"/><circle cx="20" cy="12" r="4.5" fill="currentColor"/>' +
      '<circle cx="18.2" cy="11" r="1.2" fill="#fff"/><circle cx="21.8" cy="11" r="1.2" fill="#fff"/></svg>',

    web: webSVG(),

    dead_tree:
      '<svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg">' +
      '<g stroke="#07030c" stroke-linecap="round" fill="none">' +
      '<path stroke-width="10" d="M60 200 L58 120 L62 60"/>' +
      '<path stroke-width="6" d="M58 130 L24 96 L10 60 M58 110 L96 82 L112 40 M61 70 L40 40 L36 8 M61 64 L84 30 L82 6"/>' +
      '<path stroke-width="3" d="M24 96 L6 100 M96 82 L110 98 M40 40 L22 36 M84 30 L100 20"/>' +
      '</g></svg>'
  };

  // --- CSS --------------------------------------------------------------
  var css = [
    '#hw-layer{--ww:min(10vw,150px);position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:' + opts.zIndex + '}',
    '#hw-layer *{pointer-events:none;box-sizing:border-box}',
    '#hw-layer.hw-off{display:none}',

    // vignette orange/violette
    '.hw-vignette{position:absolute;inset:0;background:' +
      'radial-gradient(ellipse at 50% 40%,transparent 55%,rgba(60,10,90,.35) 100%),' +
      'radial-gradient(ellipse at 0% 100%,rgba(255,120,0,.22),transparent 45%),' +
      'radial-gradient(ellipse at 100% 100%,rgba(130,60,255,.25),transparent 45%)}',

    // brume
    '.hw-fog{position:absolute;left:0;right:0;bottom:0;height:34vh;opacity:.55;' +
      'background:' +
      'radial-gradient(ellipse 40% 60% at 20% 80%,rgba(220,210,240,.35),transparent 70%),' +
      'radial-gradient(ellipse 45% 55% at 55% 90%,rgba(220,210,240,.30),transparent 70%),' +
      'radial-gradient(ellipse 40% 60% at 85% 80%,rgba(220,210,240,.35),transparent 70%);' +
      'background-size:200% 100%;animation:hw-fog 40s linear infinite;filter:blur(14px)}',
    '@keyframes hw-fog{from{background-position:0 0}to{background-position:200% 0}}',

    // toiles
    '.hw-web{position:absolute;top:0;width:var(--ww);aspect-ratio:1;filter:drop-shadow(0 0 5px rgba(255,170,60,.6)) drop-shadow(0 0 14px rgba(255,120,20,.3))}',
    '.hw-web svg{width:100%;height:100%;display:block}',
    '.hw-web.left{left:0}',
    '.hw-web.right{right:0;transform:scaleX(-1)}',

    // araignées + fil
    '.hw-thread{position:absolute;top:0;width:1.5px;transform-origin:top;background:linear-gradient(rgba(255,255,255,.75),rgba(255,255,255,.25));' +
      'animation:hw-drop var(--d,7s) ease-in-out infinite alternate}',
    '.hw-thread .sp{position:absolute;left:50%;bottom:-16px;width:22px;height:22px;margin-left:-11px;color:var(--c,#ff8a1f);' +
      'filter:drop-shadow(0 0 6px var(--c,#ff8a1f))}',
    '@keyframes hw-drop{from{transform:scaleY(.45)}to{transform:scaleY(1)}}',

    // sorcière / chauves-souris
    '.hw-witch{position:absolute;left:0;top:0;width:min(22vw,200px);will-change:transform;filter:drop-shadow(0 0 8px rgba(160,80,255,.55))}',
    '.hw-bat{position:absolute;left:0;top:0;will-change:transform}',
    '.hw-bat svg{width:100%;display:block;animation:hw-flap .35s ease-in-out infinite alternate;transform-origin:center}',
    '@keyframes hw-flap{from{transform:scaleY(1)}to{transform:scaleY(.55)}}',

    // bonbons
    '.hw-candy{position:absolute;top:-40px;will-change:transform;opacity:.95;animation:hw-fall linear forwards}',
    '@keyframes hw-fall{to{transform:translate3d(var(--dx,0),115vh,0) rotate(var(--rot,360deg))}}',

    // décor
    '.hw-tree{position:absolute;bottom:0;left:0;width:min(14vw,130px);opacity:.9}',
    '.hw-tree.r{left:auto;right:0;transform:scaleX(-1)}',
    '.hw-pumpkin{position:absolute;bottom:-6px;font-size:min(9vw,84px);line-height:1;filter:drop-shadow(0 0 14px rgba(255,130,0,.8));animation:hw-glow 3s ease-in-out infinite alternate}',
    '.hw-pumpkin.a{left:10px}.hw-pumpkin.b{right:10px;font-size:min(7vw,64px)}',
    '@keyframes hw-glow{from{filter:drop-shadow(0 0 8px rgba(255,130,0,.5))}to{filter:drop-shadow(0 0 22px rgba(255,170,30,.95))}}',

    // bouton on/off (seul élément cliquable)
    '#hw-toggle{position:fixed;left:12px;bottom:120px;z-index:' + (opts.zIndex + 1) + ';pointer-events:auto;' +
      'width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,140,0,.6);background:rgba(20,8,30,.85);' +
      'font-size:20px;cursor:pointer;line-height:1;color:#fff;opacity:.75;transition:opacity .2s}',
    '#hw-toggle:hover{opacity:1}',

    // citrouille à booster (remplace la sorcière quand witch:false)
    '#hw-booster{position:fixed;right:18px;bottom:96px;z-index:' + (opts.zIndex + 1) + ';pointer-events:auto;' +
      'width:64px;height:64px;border:0;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,180,60,.22),transparent 70%);' +
      'font-size:42px;line-height:1;cursor:pointer;filter:drop-shadow(0 0 10px rgba(255,150,0,.7));' +
      'transition:transform .2s,filter .2s;-webkit-tap-highlight-color:transparent}',
    '#hw-booster:hover{transform:scale(1.06)}',
    '#hw-booster.hw-ready{animation:hw-ready 1.4s ease-in-out infinite alternate}',
    '#hw-booster:disabled{opacity:.7;cursor:wait;animation:none}',

    // zone assombrie + torche
    '.hw-dark{position:absolute;left:0;top:0;width:0;height:0;border-radius:14px;opacity:0;transition:opacity .4s;--r:1px;--tx:-999px;--ty:-999px;--glow:0;--lit:1;--dk:.86;' +
      'background:' +
      // halo chaud : blanc chaud à pleine puissance, orange quand la pile faiblit
      'radial-gradient(circle calc(var(--r) * .9) at var(--tx) var(--ty),rgba(255,calc(130 + 100 * var(--lit)),calc(50 + 140 * var(--lit)),calc(.17 * var(--glow) * var(--lit))),rgba(255,160,80,0) 70%),' +
      // obscurité : au centre elle recule selon l'intensité ; faisceau plus flou quand il faiblit
      'radial-gradient(circle var(--r) at var(--tx) var(--ty),' +
        'rgba(6,3,12,calc(var(--dk) * (1 - var(--lit)))) 0%,' +
        'rgba(6,3,12,calc(var(--dk) * (1 - var(--lit)))) calc(12% + 26% * var(--lit)),' +
        'rgba(6,3,12,calc(var(--dk) * (1 - .5 * var(--lit)))) 64%,' +
        'rgba(6,3,12,var(--dk)) 100%)}',
    '.hw-dark.on{opacity:1}',

    // sorcière cliquable (booster)
    '#hw-layer .hw-witch{pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#hw-layer .hw-witch.hw-ready{animation:hw-ready 1.4s ease-in-out infinite alternate}',
    '@keyframes hw-ready{from{filter:drop-shadow(0 0 6px rgba(255,210,80,.7))}to{filter:drop-shadow(0 0 16px rgba(255,220,100,1)) drop-shadow(0 0 30px rgba(255,150,0,.75))}}',
    '.hw-pop{position:absolute;pointer-events:none;will-change:transform,opacity;animation:hw-pop .9s ease-out forwards}',
    '@keyframes hw-pop{from{transform:translate(0,0) scale(.5) rotate(0);opacity:1}to{transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--rot));opacity:0}}',
    '#hw-toast{position:fixed;left:50%;bottom:28px;z-index:' + (opts.zIndex + 1) + ';max-width:90vw;transform:translate(-50%,20px);opacity:0;pointer-events:none;' +
      'padding:10px 16px;border-radius:12px;border:1px solid rgba(255,140,0,.65);background:rgba(20,8,30,.93);color:#fff;' +
      'font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 0 22px rgba(255,120,0,.35);transition:opacity .25s,transform .25s}',
    '#hw-toast.show{opacity:1;transform:translate(-50%,0)}',

    '@media (prefers-reduced-motion:reduce){.hw-fog,.hw-thread,.hw-bat svg,.hw-pumpkin,#hw-layer .hw-witch.hw-ready{animation:none!important}}'
  ].join('\n');

  // --- Construction du DOM ----------------------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var layer, started = false, rafId = null, candyTimer = null;
  var witchNode = null, witchFlyer = null, boosterNode = null, claiming = false, toastNode = null, toastTimer = null;
  var darkNode = null, flickerTimer = null, tgtEl = null, tgtAt = 0, boxKey = '';
  var torch = { x: 0, y: 0, r: 0, mx: -9999, my: -9999, inside: false,
                lit: 1, targetLit: 1, tau: 300, noise: 0, noiseTo: 0, noiseAt: 0 };
  var flyers = []; // sorcière + chauves-souris

  function build() {
    var style = document.createElement('style');
    style.id = 'hw-style';
    style.textContent = css;
    document.head.appendChild(style);

    layer = el('div');
    layer.id = 'hw-layer';
    layer.setAttribute('aria-hidden', 'true');

    if (opts.vignette) layer.appendChild(el('div', 'hw-vignette'));
    if (opts.fog) layer.appendChild(el('div', 'hw-fog'));
    if (torchEnabled()) {
      darkNode = el('div', 'hw-dark');
      darkNode.style.setProperty('--dk', String(opts.torchDarkness));
      layer.appendChild(darkNode);
    }

    if (opts.spiders) {
      layer.appendChild(el('div', 'hw-web left', SVG.web));
      layer.appendChild(el('div', 'hw-web right', SVG.web));
      [
        { left: 'calc(var(--ww) * .22)',  top: 'calc(var(--ww) * .78)',  h: '20vh', c: '#ff8a1f', d: '7s' },
        { left: 'calc(var(--ww) + 3vw)',  top: '0',                      h: '13vh', c: '#9b6bff', d: '9s' },
        { right: 'calc(var(--ww) * .22)', top: 'calc(var(--ww) * .78)',  h: '22vh', c: '#9b6bff', d: '8s' },
        { right: 'calc(var(--ww) + 3vw)', top: '0',                      h: '11vh', c: '#ff8a1f', d: '10s' }
      ].forEach(function (s) {
        var t = el('div', 'hw-thread', '<div class="sp">' + SVG.spider + '</div>');
        if (s.left) t.style.left = s.left;
        if (s.right) t.style.right = s.right;
        t.style.height = s.h;
        if (s.top) t.style.top = s.top;
        t.style.setProperty('--c', s.c);
        t.style.setProperty('--d', s.d);
        layer.appendChild(t);
      });
    }

    if (opts.pumpkins) {
      layer.appendChild(el('div', 'hw-tree', SVG.dead_tree));
      layer.appendChild(el('div', 'hw-tree r', SVG.dead_tree));
      layer.appendChild(el('div', 'hw-pumpkin a', '🎃'));
      layer.appendChild(el('div', 'hw-pumpkin b', '🎃'));
    }

    if (opts.boosterPumpkin) {
      var b = el('button', 'hw-booster', '🎃');
      b.id = 'hw-booster';
      b.type = 'button';
      b.title = 'Réclamer le booster Halloween';
      b.setAttribute('aria-label', 'Réclamer le booster Halloween');
      b.addEventListener('click', onWitchClick);
      document.body.appendChild(b);
      boosterNode = b;
    }

    if (opts.witch) {
      var w = el('div', 'hw-witch', SVG.witch);
      w.style.visibility = 'hidden';
      w.addEventListener('click', onWitchClick);
      layer.appendChild(w);
      witchNode = w;
      witchFlyer = { node: w, kind: 'witch', x: -300, y: 0, t: 0, speed: 110, wait: 2, first: false };
      flyers.push(witchFlyer);
    }
    if (opts.bats) {
      for (var i = 0; i < 4; i++) {
        var b = el('div', 'hw-bat', SVG.bat);
        b.style.width = Math.round(rnd(26, 46)) + 'px';
        b.style.visibility = 'hidden';
        layer.appendChild(b);
        flyers.push({ node: b, kind: 'bat', x: -100, y: 0, t: rnd(0, 6), speed: rnd(90, 170), wait: rnd(0, 8) });
      }
    }

    document.body.appendChild(layer);

    if (opts.toggle) {
      var btn = el('button', null, '🎃');
      btn.id = 'hw-toggle';
      btn.type = 'button';
      btn.title = "Activer / désactiver l'ambiance Halloween";
      btn.setAttribute('aria-label', "Activer ou désactiver l'ambiance Halloween");
      btn.addEventListener('click', function () { setOn(layer.classList.contains('hw-off')); });
      document.body.appendChild(btn);
    }
  }

  // --- Animation de vol (sorcière + chauves-souris) ----------------------
  function resetFlyer(f) {
    var vw = window.innerWidth, vh = window.innerHeight;
    f.t = 0;
    f.dir = Math.random() < 0.5 ? 1 : -1;
    if (f.kind === 'witch') f.dir = 1;
    f.baseY = f.kind === 'witch' ? rnd(vh * 0.2, vh * 0.55) : rnd(vh * 0.05, vh * 0.6);
    f.x = f.dir === 1 ? -320 : vw + 120;
    f.amp = f.kind === 'witch' ? 30 : rnd(20, 60);
    f.freq = f.kind === 'witch' ? 0.9 : rnd(2, 4);
    f.wait = f.kind === 'witch' ? (f.first ? rnd(4, 10) : 1.2) : rnd(1, 7);
    f.first = true;
    f.node.style.visibility = 'hidden';
  }

  var last = 0;
  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    var vw = window.innerWidth;
    torchStep(dt, false);
    flyers.forEach(function (f) {
      if (f.wait > 0) { f.wait -= dt; return; }
      f.node.style.visibility = 'visible';
      f.t += dt;
      f.x += f.dir * f.speed * dt;
      var y = f.baseY + Math.sin(f.t * f.freq) * f.amp;
      var flip = f.dir === -1 ? ' scaleX(-1)' : '';
      f.node.style.transform = 'translate3d(' + f.x + 'px,' + y + 'px,0)' + flip;
      if ((f.dir === 1 && f.x > vw + 160) || (f.dir === -1 && f.x < -360)) resetFlyer(f);
    });
    rafId = requestAnimationFrame(loop);
  }

  // --- Bonbons ----------------------------------------------------------
  var PALETTE = [['#ff4d8d', '#ffd23f'], ['#7c5cff', '#ff8a1f'], ['#2ecc71', '#fff'], ['#ff8a1f', '#7c5cff'], ['#00c2ff', '#ff4d8d']];
  function spawnCandy() {
    if (document.hidden || !layer || layer.classList.contains('hw-off')) return;
    var p = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    var c = el('div', 'hw-candy', SVG.candy(p[0], p[1]));
    var size = rnd(18, 34);
    c.style.width = size + 'px';
    c.style.left = rnd(0, 100) + 'vw';
    c.style.animationDuration = rnd(7, 13) + 's';
    c.style.setProperty('--dx', rnd(-80, 80) + 'px');
    c.style.setProperty('--rot', (Math.random() < 0.5 ? -1 : 1) * rnd(180, 540) + 'deg');
    layer.appendChild(c);
    setTimeout(function () { c.remove(); }, 14000);
  }

  // --- Effet torche -----------------------------------------------------
  // Zone assombrie ; seule une lampe qui suit la souris l'éclaire. De temps en
  // temps la batterie "flanche" (baisse, coupure, retour). Les coupures sont
  // lentes (>= ~300 ms par étape) et peu contrastées : pas de flash agressif.
  function torchEnabled() {
    if (!opts.torch) return false;
    var noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
    return opts.torchTouch || !noHover;
  }

  function torchRect(now) {
    if (!opts.torchTarget) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    if (!tgtEl || !tgtEl.isConnected || now - tgtAt > 800) { tgtEl = document.querySelector(opts.torchTarget); tgtAt = now; }
    return tgtEl ? tgtEl.getBoundingClientRect() : null;
  }

  function torchStep(dt, snap) {
    if (!darkNode) return;
    var rc = torchRect(performance.now());
    if (!rc || rc.width < 2 || rc.height < 2 || rc.bottom < 0 || rc.top > window.innerHeight) {
      darkNode.classList.remove('on');
      return;
    }
    var pad = opts.torchPadding;
    var L = rc.left - pad, T = rc.top - pad, W = rc.width + pad * 2, H = rc.height + pad * 2;
    var key = Math.round(L) + ',' + Math.round(T) + ',' + Math.round(W) + ',' + Math.round(H);
    if (key !== boxKey) {
      boxKey = key;
      darkNode.style.transform = 'translate(' + L + 'px,' + T + 'px)';
      darkNode.style.width = W + 'px';
      darkNode.style.height = H + 'px';
    }
    darkNode.classList.add('on');

    var inside = torch.mx >= rc.left && torch.mx <= rc.right && torch.my >= rc.top && torch.my <= rc.bottom;
    if (inside && (!torch.inside || snap)) { torch.x = torch.mx; torch.y = torch.my; }
    torch.inside = inside;

    var targetR = inside ? opts.torchRadius : 0;
    if (snap) {
      torch.r = targetR;
    } else {
      if (inside) {
        var k = Math.min(1, dt * 16);
        torch.x += (torch.mx - torch.x) * k;
        torch.y += (torch.my - torch.y) * k;
      }
      torch.r += (targetR - torch.r) * Math.min(1, dt * (targetR < torch.r ? 24 : 9));
    }
    darkNode.style.setProperty('--tx', (torch.x - L) + 'px');
    darkNode.style.setProperty('--ty', (torch.y - T) + 'px');
    // intensité de la lampe : suit la consigne avec de l'inertie
    // (chute rapide d'une LED, extinction plus traînante d'une ampoule)
    if (snap) torch.lit = torch.targetLit;
    else torch.lit += (torch.targetLit - torch.lit) * (1 - Math.exp(-dt * 1000 / torch.tau));
    // micro-scintillement irrégulier, de faible amplitude, seulement quand la pile faiblit
    var nowMs = performance.now();
    if (nowMs > torch.noiseAt) { torch.noiseTo = Math.random() * 2 - 1; torch.noiseAt = nowMs + rnd(40, 110); }
    torch.noise += (torch.noiseTo - torch.noise) * Math.min(1, (snap ? 1 : dt * 30));
    var amp = torch.lit < 0.98 ? 0.16 + 0.22 * (1 - torch.lit) : 0;
    var eff = Math.max(0, Math.min(1, torch.lit * (1 + torch.noise * amp)));
    var shrink = 0.82 + 0.18 * eff; // le faisceau reste presque de la même taille
    darkNode.style.setProperty('--r', Math.max(1, torch.r * shrink) + 'px');
    darkNode.style.setProperty('--glow', Math.min(1, torch.r / opts.torchRadius).toFixed(3));
    darkNode.style.setProperty('--lit', eff.toFixed(3));
  }

  // Scénarios de panne : [intensité visée 0..1, maintien en ms, inertie en ms]
  // (inertie courte = chute nette d'une LED ; longue = extinction qui traîne,
  // la lumière devient orange avant de disparaître). Le dernier pas ramène à 1.
  // Au plus ~2 creux par seconde : pas de flash agressif.
  var FLICKERS = [
    // pile faible -> petits creux -> coupure -> reprise capricieuse
    [[0.82, 700, 400], [0.9, 450, 120], [0.6, 900, 350], [0.75, 240, 60], [0.3, 110, 50], [0.7, 380, 80],
     [0.4, 600, 300], [0.12, 160, 60], [0.5, 140, 50], [0.25, 500, 200], [0, 1600, 230], [0.55, 120, 40],
     [0, 380, 90], [0.9, 300, 100], [0.5, 450, 250], [1, 0, 400]],
    // coup de torche contre la main : elle repart, puis retombe
    [[0.7, 500, 300], [0.35, 700, 300], [0, 900, 200], [0.95, 160, 40], [0.2, 420, 120], [0, 700, 150],
     [0.8, 200, 50], [1, 0, 500]],
    // agonie lente : elle baisse, vire à l'orange, s'éteint, puis revient doucement
    [[0.85, 900, 500], [0.6, 1200, 600], [0.42, 900, 500], [0.28, 800, 500], [0.05, 700, 400], [0, 1200, 300], [1, 0, 900]],
    // clignotements nerveux, courts
    [[0.55, 260, 50], [1, 360, 60], [0.4, 180, 50], [0.95, 520, 80], [0.1, 140, 40], [0.8, 300, 60], [1, 0, 200]]
  ];
  function playFlicker(pattern, i) {
    var s = pattern[i];
    torch.targetLit = s[0];
    torch.tau = s[2];
    if (i === pattern.length - 1) { scheduleFlicker(); return; }
    flickerTimer = setTimeout(function () { playFlicker(pattern, i + 1); }, s[1] * (0.85 + Math.random() * 0.3));
  }
  function scheduleFlicker() {
    clearTimeout(flickerTimer);
    if (!opts.torchFlicker) return;
    flickerTimer = setTimeout(function () {
      playFlicker(FLICKERS[Math.floor(Math.random() * FLICKERS.length)], 0);
    }, rnd(7000, 16000));
  }

  // --- Booster : clic sur la citrouille (1 par heure) ----------------------
  var NEXT_KEY = 'halloween-booster-next';
  function nextAt() { try { return parseInt(localStorage.getItem(NEXT_KEY) || '0', 10) || 0; } catch { return 0; } }
  function setNext(t) { try { localStorage.setItem(NEXT_KEY, String(t)); } catch {} refreshReady(); }
  function refreshReady() {
    var ready = Date.now() >= nextAt();
    if (witchNode) witchNode.classList.toggle('hw-ready', ready);
    if (boosterNode) boosterNode.classList.toggle('hw-ready', ready);
  }
  function fmtWait(ms) {
    var m = Math.ceil(ms / 60000);
    if (m <= 1) return 'moins d’une minute';
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '');
  }

  function toast(msg) {
    if (!toastNode) {
      toastNode = el('div');
      toastNode.id = 'hw-toast';
      toastNode.setAttribute('role', 'status');
      toastNode.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = msg;
    toastNode.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastNode.classList.remove('show'); }, 4200);
  }

  function burst() {
    var source = boosterNode || witchNode;
    if (!layer || !source || reduceMotion) return;
    var rect = source.getBoundingClientRect();
    var cx = rect.left + rect.width * 0.6, cy = rect.top + rect.height * 0.5;
    for (var i = 0; i < 16; i++) {
      var p = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      var c = el('div', 'hw-pop', SVG.candy(p[0], p[1]));
      var ang = rnd(0, Math.PI * 2), dist = rnd(50, 140);
      c.style.width = rnd(18, 30) + 'px';
      c.style.left = cx + 'px';
      c.style.top = cy + 'px';
      c.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      c.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      c.style.setProperty('--rot', rnd(-360, 360) + 'deg');
      layer.appendChild(c);
      setTimeout((function (n) { return function () { n.remove(); }; })(c), 1000);
    }
  }

  function requestClaim() {
    if (typeof opts.onClaim === 'function') return Promise.resolve(opts.onClaim());
    if (opts.boosterEndpoint) {
      return fetch(opts.boosterEndpoint, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}'
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          j = j || {};
          if (r.status === 429 && j.retryAfterMs == null) {
            var ra = parseInt(r.headers.get('Retry-After'), 10);
            if (ra > 0) j.retryAfterMs = ra * 1000;
          }
          j.ok = r.ok && j.ok !== false;
          return j;
        });
      });
    }
    if (window.console) console.info('[halloween-overlay] mode démo : aucun booster réellement attribué (définis boosterEndpoint ou onClaim).');
    return Promise.resolve({ ok: true, demo: true, booster: { name: 'Booster (démo)' } });
  }

  function onWitchClick(e) {
    if (e) e.preventDefault();
    if (claiming) return;
    var wait = nextAt() - Date.now();
    if (wait > 0) { toast('🎃 Reviens dans ' + fmtWait(wait) + ' pour un nouveau booster !'); return; }
    claiming = true;
    if (boosterNode) boosterNode.disabled = true;
    requestClaim().then(function (res) {
      if (res && res.ok) {
        setNext(Date.now() + opts.boosterCooldownMs);
        burst();
        toast('🎁 ' + ((res.booster && res.booster.name) || 'Booster') + ' gagné !');
        try { window.dispatchEvent(new CustomEvent('halloween:booster', { detail: res })); } catch {}
        if (witchFlyer) resetFlyer(witchFlyer);
      } else if (res && res.retryAfterMs > 0) {
        setNext(Date.now() + res.retryAfterMs);
        toast('🎃 Reviens dans ' + fmtWait(res.retryAfterMs) + ' pour un nouveau booster !');
      } else {
        toast((res && res.message) || 'Oups, impossible de récupérer le booster pour le moment.');
      }
    }).catch(function () {
      toast('Oups, erreur réseau. Réessaie dans un instant.');
    }).then(function () { claiming = false; if (boosterNode) boosterNode.disabled = false; refreshReady(); });
  }

  // --- Start / Stop -------------------------------------------------------
  function start() {
    if (!reduceMotion) {
      flyers.forEach(resetFlyer);
      last = performance.now();
      rafId = requestAnimationFrame(loop);
      if (opts.candies) candyTimer = setInterval(spawnCandy, 1100);
      if (darkNode) scheduleFlicker();
    } else if (witchNode) {
      // animations réduites : la sorcière reste fixe (mais cliquable) dans un coin
      witchNode.style.visibility = 'visible';
      witchNode.style.left = 'auto';
      witchNode.style.right = '14px';
      witchNode.style.top = '90px';
      witchNode.style.width = '110px';
    }
    started = true;
  }
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (candyTimer) clearInterval(candyTimer);
    candyTimer = null;
    clearTimeout(flickerTimer);
    torch.targetLit = 1; torch.tau = 300;
    started = false;
  }
  function setOn(on) {
    layer.classList.toggle('hw-off', !on);
    if (boosterNode) boosterNode.style.display = on ? '' : 'none';
    try { localStorage.setItem(STORAGE_KEY, on ? '0' : '1'); } catch {}
    if (on && !started) start();
    if (!on && started) stop();
  }

  document.addEventListener('visibilitychange', function () {
    if (!layer || layer.classList.contains('hw-off')) return;
    if (document.hidden) stop(); else if (!started) start();
  });

  function init() {
    build();
    if (darkNode) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' && !opts.torchTouch) return;
        torch.mx = e.clientX; torch.my = e.clientY;
        if (reduceMotion) torchStep(1, true);
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', function () {
        torch.mx = -9999; torch.my = -9999;
        if (reduceMotion) torchStep(1, true);
      });
      if (reduceMotion) {
        window.addEventListener('scroll', function () { torchStep(1, true); }, { passive: true, capture: true });
        window.addEventListener('resize', function () { torchStep(1, true); });
        torchStep(1, true);
      }
    }
    refreshReady();
    setInterval(refreshReady, 10000);
    if (userOff) { layer.classList.add('hw-off'); if (boosterNode) boosterNode.style.display = 'none'; } else start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // API publique minimale
  window.HalloweenOverlay = {
    enable: function () { setOn(true); },
    disable: function () { setOn(false); },
    flicker: function (n) { if (!darkNode) return; clearTimeout(flickerTimer); playFlicker(FLICKERS[(n >= 0 && n < FLICKERS.length) ? n : Math.floor(Math.random() * FLICKERS.length)], 0); }
  };
})();
