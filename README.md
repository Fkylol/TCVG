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
- **Supabase** (Auth Discord + Postgres + RLS)

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

### 4. Activer la connexion Discord

Le site ne propose que la connexion Discord : un compte est créé automatiquement à la première
connexion.

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** →
   **OAuth2** → ajoute l'URL de retour
   `https://<reference-projet>.supabase.co/auth/v1/callback`, puis récupère le **Client ID** et le
   **Client Secret**.
2. Supabase → **Authentication → Providers → Discord** : active le fournisseur et colle les deux
   valeurs.
3. Supabase → **Authentication → URL Configuration** : Site URL = l'URL publique du site, et
   Redirect URLs = `<url-du-site>/**` (dont `<url-du-site>/auth/confirm`).
4. Supabase → **Authentication → Providers → Email** : désactive le fournisseur pour n'autoriser
   que Discord côté serveur aussi.

La route `src/app/auth/confirm/route.ts` échange le code OAuth contre une session.

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
- **Stock** : un booster toutes les 10 minutes, **cumulables jusqu'à 10** (ouverts un par un ou tous
  d'un coup). L'accumulation et la consommation sont calculées **en base** par `open_boosters()` dans
  une transaction avec verrou de ligne — impossible à contourner en rejouant la requête.
- **Collection** : une ligne par personnage possédé (`quantity` pour les doublons). La table est en
  lecture seule côté client : la seule écriture possible passe par la fonction SQL.
- **Fiche perso** : stats, pouvoir, citation, bio, et les autres cartes du même univers.
- **Marché** : annonces de doublons (normales ou holos), achat atomique en Pixels avec 5 % de
  commission, prix encadrés par les ventes récentes et les garde-fous de rareté.

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
- Les **20 cartes sans visuel** (Ripto, Hunter, Gruntilda, Artorias, Yennefer…) n'ont pas
  d'article Wikipédia avec image dédié. Les wikis **Fandom** ont été testés puis écartés : leur CDN
  (`static.wikia.nocookie.net`) est derrière un challenge Cloudflare et renvoie **403 sans `Referer`
  du domaine Fandom**, donc le hotlink depuis le site est impossible. Ces cartes gardent le rendu
  généré (dégradé, anneaux, emoji). Pour du 84/84, il faudrait télécharger ces 20 fichiers dans
  `public/` — ce qui revient à héberger des copies, donc à assumer le risque correspondant.
- Si un visuel casse (fichier renommé, page supprimée), il suffit d'éditer `src/data/portraits.json`
  pour retirer l'entrée : la carte retombe automatiquement sur le rendu généré.

## Structure

```
src/
  app/
    page.tsx              landing publique
    login/ signup/        connexion Discord uniquement (Server Action OAuth)
    actions.ts            signInWithDiscord, signOut, achats, recyclage
    auth/confirm/route.ts code OAuth -> session
    (game)/               routes protégées (layout = garde de session)
      boosters/           ouverture de booster
      collection/         album filtrable
      card/[id]/          fiche wiki + mise en vente
      marche/             annonces et achats entre joueurs
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

**Cloudflare** — l'adaptateur est déjà installé et configuré (`wrangler.jsonc`, `open-next.config.ts`,
`nodejs_compat`). Il ne reste que l'authentification :

```bash
npx wrangler login     # une seule fois, ouvre le navigateur
npm run cf:build       # bundle le worker (relance next build)
npm run cf:deploy      # publie sur Workers
```

Sans navigateur (CI), exporte `CLOUDFLARE_API_TOKEN` (template « Edit Cloudflare Workers ») et
`CLOUDFLARE_ACCOUNT_ID` puis lance `npm run cf:deploy`.

⚠️ Les `NEXT_PUBLIC_*` sont **inlinées au build** : elles doivent être présentes dans l'environnement
au moment de `cf:build`, pas seulement au runtime.
