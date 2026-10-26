/**
 * xmas-overlay.js — overlay de Noël autonome (aucune dépendance)
 *
 * Chute de neige douce (Canvas) + guirlande lumineuse en haut de page.
 * Actif du 1er décembre au 5 janvier inclus, heure de Paris.
 *
 * Intégration : <script src="/events/xmas-overlay.js" defer></script>
 * Réglages facultatifs avant le chargement :
 *   window.XMAS_OVERLAY = { force: true, zIndex: 45 };
 */
(function () {
  if (document.getElementById('xmas-snow-canvas')) return;

  var OPTIONS = window.XMAS_OVERLAY || {};

  function isXmasPeriod() {
    if (OPTIONS.force) return true;

    var parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date());
    var month = Number(parts.find(function (part) { return part.type === 'month'; }).value);
    var day = Number(parts.find(function (part) { return part.type === 'day'; }).value);

    return (month === 12 && day >= 1) || (month === 1 && day <= 5);
  }

  if (!isXmasPeriod()) return;

  var zIndex = Number(OPTIONS.zIndex) || 45;

  // ========================================================
  // 1. STYLES CSS
  // ========================================================
  if (document.getElementById('xmas-overlay-style')) return;

  var css = `
    /* Guirlande lumineuse topbar */
    #xmas-lights {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 20px;
      z-index: ${zIndex + 1};
      pointer-events: none;
      display: flex;
      justify-content: space-around;
      padding: 0;
      margin: 0;
      list-style: none;
      overflow: hidden;
    }
    #xmas-lights::before {
      content: "";
      position: absolute;
      top: 2px;
      left: 0;
      width: 100%;
      height: 2px;
      background: #111;
      z-index: -1;
    }
    #xmas-lights li {
      position: relative;
      top: -5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin: 0 4px;
      animation-duration: 1.5s;
      animation-iteration-count: infinite;
    }
    #xmas-lights li:nth-child(4n+1) {
      background: #ff5252;
      box-shadow: 0 2px 8px #ff5252;
      animation-name: lightGlowRed;
    }
    #xmas-lights li:nth-child(4n+2) {
      background: #ffd700;
      box-shadow: 0 2px 8px #ffd700;
      animation-name: lightGlowYellow;
      animation-delay: 0.4s;
    }
    #xmas-lights li:nth-child(4n+3) {
      background: #4caf50;
      box-shadow: 0 2px 8px #4caf50;
      animation-name: lightGlowGreen;
      animation-delay: 0.8s;
    }
    #xmas-lights li:nth-child(4n+4) {
      background: #2196f3;
      box-shadow: 0 2px 8px #2196f3;
      animation-name: lightGlowBlue;
      animation-delay: 1.2s;
    }
    @keyframes lightGlowRed {
      0%, 100% { opacity: 1; box-shadow: 0 2px 10px #ff5252; }
      50% { opacity: 0.3; box-shadow: 0 1px 2px #ff5252; }
    }
    @keyframes lightGlowYellow {
      0%, 100% { opacity: 1; box-shadow: 0 2px 10px #ffd700; }
      50% { opacity: 0.3; box-shadow: 0 1px 2px #ffd700; }
    }
    @keyframes lightGlowGreen {
      0%, 100% { opacity: 1; box-shadow: 0 2px 10px #4caf50; }
      50% { opacity: 0.3; box-shadow: 0 1px 2px #4caf50; }
    }
    @keyframes lightGlowBlue {
      0%, 100% { opacity: 1; box-shadow: 0 2px 10px #2196f3; }
      50% { opacity: 0.3; box-shadow: 0 1px 2px #2196f3; }
    }

    /* Canvas Neige */
    #xmas-snow-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: ${zIndex};
      pointer-events: none;
    }
  `;

  var styleEl = document.createElement('style');
  styleEl.id = 'xmas-overlay-style';
  styleEl.type = 'text/css';
  styleEl.appendChild(document.createTextNode(css));
  document.head.appendChild(styleEl);

  // ========================================================
  // 2. INJECTION DES ÉLÉMENTS HTML ET LOGIQUE DE NEIGE
  // ========================================================
  var initOverlay = function () {
    if (document.getElementById('xmas-snow-canvas')) return;

    // Création du Canvas de neige
    var canvas = document.createElement('canvas');
    canvas.id = 'xmas-snow-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    // Création de la guirlande
    var lightsUl = document.createElement('ul');
    lightsUl.id = 'xmas-lights';
    lightsUl.setAttribute('aria-hidden', 'true');
    var lightCount = Math.floor(window.innerWidth / 25);
    for (var i = 0; i < lightCount; i++) {
      lightsUl.appendChild(document.createElement('li'));
    }
    document.body.appendChild(lightsUl);

    // Animation Canvas
    var ctx = canvas.getContext('2d');
    var width = (canvas.width = window.innerWidth);
    var height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', function () {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    var snowflakeCount = Math.floor((width * height) / 25000);
    var snowflakes = [];

    for (var j = 0; j < snowflakeCount; j++) {
      snowflakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.5 + 1,
        speedY: Math.random() * 0.8 + 0.4,
        speedX: Math.random() * 0.4 - 0.2,
        opacity: Math.random() * 0.5 + 0.3
      });
    }

    function drawSnow() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';

      for (var k = 0; k < snowflakes.length; k++) {
        var flake = snowflakes[k];
        ctx.save();
        ctx.globalAlpha = flake.opacity;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        flake.y += flake.speedY;
        flake.x += flake.speedX;

        if (flake.y > height) {
          flake.y = -5;
          flake.x = Math.random() * width;
        }
        if (flake.x > width) flake.x = 0;
        if (flake.x < 0) flake.x = width;
      }

      requestAnimationFrame(drawSnow);
    }

    drawSnow();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
  } else {
    initOverlay();
  }
})();
