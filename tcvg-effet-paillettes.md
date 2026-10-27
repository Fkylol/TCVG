# Effet « paillettes » pour les cartes TCVG

## Consigne à donner à l'IA

Ajoute un effet de paillettes et de petites étoiles sur les cartes des raretés U, R, E, L et M. La rareté C (Commune) n'a aucun effet. Ne modifie pas le design existant des cartes : l'effet est un calque supplémentaire placé au-dessus de l'illustration et sous le texte. Désactive l'animation si `prefers-reduced-motion` est activé.

## Règles de l'effet

- Un calque `.fx` en `position:absolute; inset:0`, `pointer-events:none`, `overflow:hidden`, `border-radius:inherit`, avec `z-index:1` (le texte de la carte doit être en `z-index:2`).
- Deux types de particules : des points (0,8 à 1,9 px) et quelques petites étoiles à 4 branches (3 à 6 px). Elles doivent rester très petites et fines, comme de la poussière de lumière.
- Positions pseudo-aléatoires, **jamais en grille** (suite de Kronecker, voir le code).
- Chaque particule scintille à son propre rythme : durée de 1,6 à 3,8 s, délai négatif aléatoire.
- Les particules sont générées côté client après le montage du composant (sinon erreur d'hydratation avec Next.js à cause de `Math.random`).
- Optionnel : inclinaison 3D de la carte et léger décalage des particules selon la position du pointeur (souris ou doigt).

## Quantité et couleurs par rareté

| Rareté | Points | Étoiles | Couleurs des particules |
|---|---|---|---|
| U (Peu commune) | 20 | 1 | `#fff`, `#9bf5d4` |
| R (Rare) | 30 | 2 | `#fff`, `#8fe3ff` |
| E (Épique) | 45 | 4 | `#fff`, `#e3d6ff` |
| L (Légendaire) | 60 | 5 | `#fff`, `#ffe9a3`, `#ffd36b` |
| M (Mythique) | 120 | 14 | `#fff`, `#ffb3f0`, `#ff8ae6` |

Le nombre « Points » est le nombre de petits points, « Étoiles » le nombre d'étoiles en plus.

## CSS

```css
.wrap { perspective: 800px; }

.card {
  --mx: 50; --my: 50; --rx: 0; --ry: 0; --o: .4;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  transform: rotateX(calc(var(--ry) * 1deg)) rotateY(calc(var(--rx) * 1deg));
  transition: transform .25s ease-out;
  touch-action: none;
}
.card.live { transition: transform .05s linear; }

/* Calque de paillettes */
.fx {
  position: absolute; inset: 0; z-index: 1;
  pointer-events: none;
  border-radius: inherit;
  overflow: hidden;
  filter: drop-shadow(0 0 1px rgba(255,255,255,.6));
  opacity: calc(.55 + var(--o) * .45);
}
.sp {
  position: absolute;
  background: var(--c);
  border-radius: 50%;
  opacity: 0;
  animation: tw 2.4s ease-in-out infinite;
  translate: calc((var(--mx) - 50) * .08px) calc((var(--my) - 50) * .08px);
}
.sp.st {
  border-radius: 0;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  translate: calc((var(--mx) - 50) * .2px) calc((var(--my) - 50) * .2px);
}
@keyframes tw {
  0%, 100% { opacity: 0; scale: .3; }
  50%      { opacity: 1; scale: 1; }
}

/* Reflet doux qui suit le pointeur (optionnel) */
.glare {
  position: absolute; inset: 0; z-index: 1;
  pointer-events: none; border-radius: inherit;
  background: radial-gradient(circle at calc(var(--mx) * 1%) calc(var(--my) * 1%), rgba(255,255,255,.35), rgba(255,255,255,0) 40%);
  mix-blend-mode: overlay;
  opacity: var(--o);
}

@media (prefers-reduced-motion: reduce) {
  .sp { animation: none; opacity: .8; }
  .card { transition: none; }
}
```

## JavaScript (version simple)

```js
const PAL = {
  U: { n: 20, s: 1, c: ['#fff', '#9bf5d4'] },
  R: { n: 30, s: 2, c: ['#fff', '#8fe3ff'] },
  E: { n: 45, s: 4, c: ['#fff', '#e3d6ff'] },
  L: { n: 60, s: 5, c: ['#fff', '#ffe9a3', '#ffd36b'] },
  M: { n: 120, s: 14, k: 1.7, c: ['#fff', '#ffb3f0', '#ff8ae6'] },
};

function addSparkles(card, rarity) {
  const p = PAL[rarity];
  if (!p) return; // Commune : rien
  const fx = card.querySelector('.fx');
  const a = Math.random(), b = Math.random();
  for (let i = 0; i < p.n + p.s; i++) {
    const star = i < p.s;
    const el = document.createElement('span');
    el.className = 'sp' + (star ? ' st' : '');
    const size = (star ? 3 + Math.random() * 3 : .8 + Math.random() * 1.1) * (p.k || 1);
    el.style.cssText =
      `left:${((i * .6180339 + a) % 1) * 96 + 2}%;` +
      `top:${((i * .7548777 + b) % 1) * 96 + 2}%;` +
      `width:${size}px;height:${size}px;--c:${p.c[i % p.c.length]};` +
      `animation-duration:${1.6 + Math.random() * 2.2}s;` +
      `animation-delay:-${Math.random() * 3}s`;
    fx.appendChild(el);
  }
}

function addPointerTilt(card) {
  const set = (x, y, o) => {
    card.style.setProperty('--mx', (x * 100).toFixed(1));
    card.style.setProperty('--my', (y * 100).toFixed(1));
    card.style.setProperty('--rx', ((x - .5) * 30).toFixed(1));
    card.style.setProperty('--ry', ((.5 - y) * 30).toFixed(1));
    card.style.setProperty('--o', o);
  };
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.classList.add('live');
    set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1);
  });
  const reset = () => { card.classList.remove('live'); set(.5, .5, .4); };
  card.addEventListener('pointerleave', reset);
  card.addEventListener('pointercancel', reset);
}
```

## React / Next.js (si le site est en React)

```tsx
'use client';
import { useEffect, useState } from 'react';

type Rarity = 'U' | 'R' | 'E' | 'L' | 'M';
type Particle = { x: number; y: number; size: number; star: boolean; color: string; dur: number; delay: number };

const PAL: Record<Rarity, { n: number; s: number; k?: number; c: string[] }> = {
  U: { n: 20, s: 1, c: ['#fff', '#9bf5d4'] },
  R: { n: 30, s: 2, c: ['#fff', '#8fe3ff'] },
  E: { n: 45, s: 4, c: ['#fff', '#e3d6ff'] },
  L: { n: 60, s: 5, c: ['#fff', '#ffe9a3', '#ffd36b'] },
  M: { n: 120, s: 14, k: 1.7, c: ['#fff', '#ffb3f0', '#ff8ae6'] },
};

export function Sparkles({ rarity }: { rarity: string }) {
  const [items, setItems] = useState<Particle[]>([]);

  useEffect(() => {
    const p = PAL[rarity as Rarity];
    if (!p) { setItems([]); return; }
    const a = Math.random(), b = Math.random();
    setItems(
      Array.from({ length: p.n + p.s }, (_, i) => {
        const star = i < p.s;
        return {
          x: ((i * 0.6180339 + a) % 1) * 96 + 2,
          y: ((i * 0.7548777 + b) % 1) * 96 + 2,
          size: (star ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.1) * (p.k ?? 1),
          star,
          color: p.c[i % p.c.length],
          dur: 1.6 + Math.random() * 2.2,
          delay: Math.random() * 3,
        };
      })
    );
  }, [rarity]);

  if (!items.length) return null;
  return (
    <div className="fx" aria-hidden="true">
      {items.map((p, i) => (
        <span
          key={i}
          className={'sp' + (p.star ? ' st' : '')}
          style={{
            left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size,
            ['--c' as string]: p.color,
            animationDuration: `${p.dur}s`, animationDelay: `-${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
```

Utilisation : placer `<Sparkles rarity={card.rarity} />` à l'intérieur de la carte, juste après l'illustration. Pour l'inclinaison au pointeur, appeler la logique de `addPointerTilt` sur l'élément de la carte (via `ref` et `useEffect`).

## Mythique : effet renforcé

La Mythique doit se voir nettement plus que les autres raretés : 120 points et 14 étoiles, particules 1,7 fois plus grandes (`k: 1.7` dans le code ci-dessus, 1 par défaut pour les autres), halo rose et reflet rose qui suit le pointeur. Ajouter ce CSS :

```css
.m .fx {
  filter: drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 0 6px rgba(255,120,235,.7));
  opacity: calc(.8 + var(--o) * .2);
}
.m .glare {
  background: radial-gradient(circle at calc(var(--mx) * 1%) calc(var(--my) * 1%), rgba(255,170,240,.5), rgba(255,170,240,0) 45%);
}
```
