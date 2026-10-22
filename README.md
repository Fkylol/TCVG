# TCVG — Trading Card Video Game

Un jeu de collection de cartes façon Kyara / WikiMasters, mais avec les personnages de jeux vidéo :
Kratos, Mario, Spyro, Link, Samus, Ganon… Ouvre des boosters gratuits, complète ton album de
**84 cartes** réparties en 5 raretés, et consulte la fiche de chaque personnage.

> ⚠️ **Projet de fan.** Non officiel et non affilié à Nintendo, Sony, Microsoft, Sega, Square Enix,
> Capcom, Bandai Namco, Activision ou leurs ayants droit. Les personnages et marques cités
> appartiennent à leurs propriétaires respectifs. 64 des 84 cartes affichent le visuel de la fiche
> Wikipédia du personnage, **hotlinké** depuis `upload.wikimedia.org` (aucun fichier copié ni servi par
> le site) : la grande majorité de ces images est en **fair use** sur Wikipédia, donc prévue pour
> l'article uniquement. Les 20 autres cartes utilisent un visuel généré (dégradé + emoji). Reste
> gratuit et sans pub si tu veux rester dans la même zone de tolérance que les projets du genre — et
> ne monétise pas.

## Stack

- **Next.js 16** (App Router, Server Actions), React 19, TypeScript
- **Tailwind CSS 4**
- **Supabase** (Auth email/mot de passe + Postgres + RLS)

## Démarrage

```bash
npm install
```

### 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project** (le plan gratuit suffit).
2. Dans **SQL Editor** → **New query** : colle tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) puis **Run**.
   Cela crée `profiles`, `collection`, les policies RLS, le trigger de création de profil et la
   fonction `open_booster()`.

### 2. Renseigner les variables d'environnement

**Project Settings → API** :

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

La clé `anon` suffit : toute la sécurité repose sur les policies RLS et sur la fonction serveur.
Ne mets **jamais** la clé `service_role` ici.

### 3. Lancer

```bash
npm run dev
```

→ http://localhost:3000

### 4. (Optionnel) Confirmation d'email

Par défaut Supabase exige de confirmer son adresse avant de pouvoir se connecter.
Deux choix :

- **Pour tester tout de suite** : Authentication → Sign In / Providers → Email → désactive
  *Confirm email*.
- **Pour garder la confirmation** : Authentication → Emails → *Confirm signup*, remplace le lien par
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
  (la route `src/app/auth/confirm/route.ts` échange le token contre une session).

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production + typecheck |
| `npm test` | Tests de la logique de jeu (tirages, poids, cooldown, catalogue) |
| `npm run lint` | ESLint |

## Comment ça marche

- **Booster** : 3 cartes, une rareté tirée par carte selon des poids (60 % / 25 % / 10 % / 4 % / 1 %),
  puis une carte au hasard dans cette rareté, sans doublon dans le pack.
- **Cooldown** : 10 minutes entre deux boosters, vérifié **en base** par `open_booster()` dans une
  transaction avec verrou de ligne — impossible à contourner en rejouant la requête.
- **Collection** : une ligne par personnage possédé (`quantity` pour les doublons). La table est en
  lecture seule côté client : la seule écriture possible passe par la fonction SQL.
- **Fiche perso** : stats, pouvoir, citation, bio, et les autres cartes du même univers.

## Visuels des personnages

Les visuels viennent de la fiche Wikipédia anglophone de chaque personnage :

```bash
npm run portraits   # réécrit src/data/portraits.json
```

- Le script interroge l'API Wikipédia par lots, avec un throttle de 1,2 s et des reprises sur 429.
- Il **ne télécharge rien** : il ne stocke que l'URL `upload.wikimedia.org`, la licence et le crédit.
  `CardFace` la charge en direct (`unoptimized`), donc Next ne recopie pas l'image.
- La correspondance carte → article est la table `WIKI_TITLES` en haut de
  `scripts/fetch-portraits.ts`. Elle est **volontairement explicite** : la recherche plein texte
  ramenait des pages hors sujet (Baldur → *Baldur's Gate*, le Chevalier → *Cagliostro*). Une carte
  absente de la table garde le dégradé + emoji.
- Le crédit du fichier s'affiche sous la carte, sur la fiche du personnage.
- Si un visuel casse (fichier renommé, page supprimée), il suffit d'éditer `src/data/portraits.json`
  pour retirer l'entrée : la carte retombe automatiquement sur le rendu généré.

## Structure

```
src/
  app/
    page.tsx              landing publique
    login/ signup/        auth (Server Actions + useActionState)
    actions.ts            signIn, signUp, signOut, openBooster
    auth/confirm/route.ts confirmation email -> session
    (game)/               routes protégées (layout = garde de session)
      boosters/           ouverture de booster
      collection/         album filtrable
      card/[id]/          fiche wiki d'un personnage
  components/             cartes, booster, filtres, formulaires
  lib/
    cards.ts              ← catalogue des personnages (source de vérité)
    game.ts               raretés, poids, tirage, cooldown
    auth.ts data.ts       accès session / données
    supabase/             clients navigateur et serveur
supabase/schema.sql       schéma + RLS + fonction open_booster()
tests/game.test.ts        tests de la logique
```

## Modifier le jeu

- **Ajouter / retirer un personnage** : une entrée dans `CARDS` (`src/lib/cards.ts`). Pour un nouvel
  univers, ajoute-le d'abord dans `UNIVERSES` (couleurs du dégradé).
- **Changer les raretés ou les chances** : `RARITY` et `BOOSTER_COOLDOWN_MS` dans `src/lib/game.ts`.
  Les libellés de classes Tailwind (`ring-amber-300/60`, etc.) sont dans ce même fichier.
- **Changer le nombre de cartes par booster** : `CARDS_PER_BOOSTER`. Si tu passes au-delà de 5,
  relève aussi la limite dans `open_booster()` (`array_length(p_cards, 1) > 5`).

## Limites connues (avant d'aller plus loin)

- La **sélection** des cartes est faite côté serveur Next.js, pas en base : quelqu'un qui appellerait
  `open_booster()` directement avec des identifiants de cartes mythiques pourrait se les offrir. Sans
  échange ni marché, ça ne lèse personne — mais avant d'ajouter du **trade entre joueurs**, il faudra
  soit valider les ids dans la fonction SQL (table `cards` + tirage en PL/pgSQL), soit déplacer le
  tirage dans une API avec la clé `service_role`.
- Pas encore de : échange de cartes, duels, monnaie, pages de profil publiques.

## Déploiement

Dans les deux cas, ajoute les variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
et, dans Supabase (Authentication → URL Configuration), l'URL de production dans *Site URL* et
`https://ton-domaine/auth/confirm` dans *Redirect URLs*.

**Vercel** — import du repo, variables d'environnement, c'est tout.

**Cloudflare** — Cloudflare ne sert pas Next.js nativement : il faut l'adaptateur OpenNext
(`@opennextjs/cloudflare`) et Wrangler ≥ 3.99. En résumé :

```bash
npm i -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

Le fichier `wrangler.jsonc` doit activer `nodejs_compat` et fixer une `compatibility_date` récente
(Supabase et les Server Actions ont besoin du runtime Node). Le projet n'utilise pas `proxy.ts` / le
middleware, ce qui évite les limitations connues de l'adaptateur sur Next.js 16.
