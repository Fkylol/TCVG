# Rapport — refonte des cadres d'avatar

Date : 25 octobre 2026. Site : TCVG (Next.js App Router, TypeScript, Supabase).
Migration appliquée : `supabase/migrations/047_cadres.sql`.
Rollback : `supabase/migrations/047_cadres.down.sql`.

## 1. Ce qui a été fait

### Configuration et moteur

- `src/lib/frames.config.ts` contient **28 cadres** : 7 d'album, 3 de rareté,
  11 de genre, 2 d'activité, 2 sociaux, 3 spéciaux.
- Seuils relatifs uniquement : pourcentage de l'album actif, part des
  Légendaires/Mythiques actives, 100 % d'un genre actif, jours consécutifs,
  nombre d'ouvertures, de parrainages payés et de ventes.
- L'évaluation (`evaluateFrameSet`) est une fonction pure, sans accès base.
  Elle calcule chaque progression, les déblocages, les maintiens 24 h et les
  cadres à retirer de l'attente.
- `MAX`/minimums de genre viennent de `MIN_POOL_SIZE` (15), jamais d'un nombre
  de cartes du catalogue.
- Les identifiants des anciens cadres et les textes « 10 personnages », « une
  Légendaire », etc. ont été supprimés de l'interface et de `src/lib/profile.ts`.

### Base de données

- `user_frames` (clé `(user_id, frame_id)`), `frame_settings`,
  `frame_pending`, `frame_audit`, `frame_eval_queue`.
- `profiles.selected_frame_id` (nullable), avec un alias généré `frame` pour ne
  pas casser les fonctions SQL existantes (classement, chat, marché, échanges).
- `frame_stats(user_id)` agrège en une requête : album actif distinct, raretés,
  genres, franchises, ventes, parrainages payés, ouvertures, série de jours,
  cadres débloqués/en attente/désactivés.
- `frame_apply(user_id, unlocks, pending_add, pending_remove)` applique en une
  transaction ; l'insertion avec unicité garantit un seul déblocage même avec
  deux sessions simultanées. Réservé au service_role.
- Triggers de file : collection (ajout/modification/suppression), ventes du
  marché, ouvertures de boosters, parrainages payés, connexion du jour.
- Un ban (`suspended_at`) efface les cadres du joueur et journalise l'action.
- `set_profile_style()` ne lève plus `frame_locked` : il retombe sur un cadre
  acquis.
- `market_listings()` renvoie maintenant l'avatar et le cadre du vendeur.
- `referral_referred_avatars()` renvoie les avatars des filleuls en une requête.
- Notification `frame_unlocked` avec référence `frame_id`.

### Application

- `<AvatarFrame />` : anneau CSS, dégradé linéaire ou conique, épaisseur et lueur
  selon le prestige, double anneau aux prestiges 4–5, reflet fixe, emblème du
  pack pour les cadres de genre, taille minimale 24 px.
- Animations : rotation du dégradé par `transform` uniquement, visible via
  `IntersectionObserver`, budget de 4 cadres simultanés, rendu statique avec
  `prefers-reduced-motion` (CSS et JavaScript).
- Remplacé dans l'en-tête, le classement, le chat, les offres d'échange, le
  marché, le profil et la liste des filleuls du parrainage.
- Section « Cadre » refaite : aperçu en direct (avatar + cadre avant
  enregistrement), onglets par voie, mentions « Débloqué + date », conditions en
  toutes lettres, barre + chiffre actuel + pourcentage restant, état « Bientôt »
  ou « Indisponible », secrets « ??? » avec indication vague, compteur
  `N / M` et prochain cadre le plus proche.
- Notifications de déblocage avec bouton **Équiper** (`/profil?cadre=…`).
- Chaque visite authentifiée marque le jour d'activité (série « Assidu ») ; la
  file d'évaluation n'est alimentée qu'une fois par jour, pas à chaque page.
- Page `/admin/cadres` : nombre de joueurs par cadre, activation/désactivation,
  attribution et retrait avec motif, recalcul global, journal des 30 dernières
  actions.
- Page `/dev/frames` : tous les cadres sur 3 avatars et 3 tailles, interrupteurs
  « débloqué / verrouillé » et « animations réduites ».
- Tâche `/api/cron/frames` : file puis recalcul des joueurs les plus anciens à
  évaluer, protégée par `CRON_SECRET` et la clé de service.
- Scripts `npm run db:frames` (recalcul avec la config) et
  `npm run db:frames:verify` (vérifications en base, transaction annulée).

### Données et recalcul

- 5 profils existants, 588 personnages actifs au moment du recalcul.
- Anciens déblocages non repris, conformément à la demande.
- Deux sélections invalides ont été remplacées par le meilleur cadre acquis.
- Répartition après recalcul :

| Cadre | Joueurs |
|---|---:|
| Acier `steel` | 5 |
| Pionnier `pioneer` | 5 |
| Jade `jade` | 3 |
| Améthyste `amethyst` | 2 |
| Tous les autres cadres | 0 |

Détail par joueur :

| Joueur | Cadres débloqués | Cadre équipé |
|---|---:|---|
| asperge | 4 | Pionnier |
| fkyzu | 4 | Pionnier |
| deathsky74 | 3 | Acier |
| mobile-test | 2 | Acier |
| TestAgora | 2 | Acier |

## 2. Cadres « bientôt » et pourquoi

| Cadre | Personnages actifs | Raison |
|---|---:|---|
| Maîtrise Stratégie | 9 | Sous `MIN_POOL_SIZE` (15). Le pool doit grandir avant que le cadre soit obtainable. |
| Maîtrise Course | 0 | Le genre existe dans la configuration mais aucune carte active n'y est rattachée (et aucun pack Course dans `PACKS`). |
| Maîtrise Sport | 0 | Même raison. |

Les autres cadres de genre ont au moins 18 personnages actifs : ils sont
obtainables, mais aucun joueur ne possède encore 100 % du genre. Le cadre de
saison « Estival » est **désactivé** (exemple), ce n'est pas un « bientôt » : il
apparaît « Indisponible » et le restera tant que la configuration ne l'active
pas.

## 3. Vérifications

- `npm test` : **295 tests**, dont 19 nouveaux pour les cadres et la mise à jour
  du test de classement.
- `npm run db:frames:verify` : **23/23** vérifications en base :
  - Acier à la création, agrégats sur les actifs uniquement ;
  - visite du jour : une activité, une mise en file ; seconde visite sans
    doublon ni nouvelle file ;
  - doublons ignorés, cartes retirées exclues ;
  - `user_frames` inaccessible en direct ;
  - Complétiste, Prisme et les cadres de rareté éligibles aux seuils ;
  - **deux sessions simultanées → un seul déblocage** ;
  - une seule notification par cadre ;
  - permanence après suppression de la collection ;
  - genre sous `MIN_POOL_SIZE` → « bientôt » ;
  - sélection d'un cadre verrouillé → repli sans erreur ;
  - rapport et activation d'administration.
- `npm run db:frames` après recalcul : 0 nouveau cadre, 0 sélection corrigée.
- `npx tsc --noEmit`, `npm run lint` (seul warning préexistant dans
  `scripts/images/lib/sources.ts`), `npm run build` : OK.

## 4. Ce qui n'est pas fait / limites

- **La clé de service n'est pas dans le `.env` local.** Les évaluations
  immédiates des Server Actions sont donc ignorées en local ; le recalcul
  `npm run db:frames` et la tâche planifiée prennent le relais. En production,
  `SUPABASE_SERVICE_ROLE_KEY` est nécessaire pour les déblocages instantanés.
- **Pas de test visuel navigateur** : la page `/dev/frames` est livrée et
  compilée, les composants sont testés par le build et les tests unitaires. Le
  rendu final (couleurs, animations) reste à juger à l'œil sur cette page.
- **Pas d'administrateur dans la base de développement** (`is_admin = false`
  pour les cinq comptes). Les RPC d'administration sont vérifiés en base, mais
  la page `/admin/cadres` n'a pas été parcourue avec un vrai compte admin.
- **Le maintien de 24 h est désactivé** (`FRAME_FEATURES`), comme demandé par
  défaut ; l'option est testée mais pas active.
- **Le grandfathering est désactivé** et ne couvre que les quatre anciens
  identifiants Acier/Jade/Améthyste/Or ; l'ancien « Mythique » n'a pas
  d'équivalent.
- **Pionnier** : tous les comptes créés avant le 1er novembre 2026 sont
  éligibles. Le cadre est attribué une fois par la contrainte d'unicité ; un
  retrait manuel d'administrateur pourrait le faire réapparaître au recalcul
  suivant (comportement volontairement simple).
- **Tâche planifiée** : elle traite au plus 300 joueurs par exécution (file +
  balayage). Sur une base plus grande, le recalcul complet s'étale sur plusieurs
  jours ; c'est volontaire pour rester dans le temps d'une fonction serverless.
- **Retrait d'un cadre par admin** : la permanence est la règle joueur, mais
  l'outil d'administration peut retirer un cadre (correction/sanction), avec
  motif journalisé. La sélection retombe alors sur l'Acier côté en-tête jusqu'à
  l'ouverture du profil, qui résout le meilleur cadre.
- **Genres Course/Sport** : les cadres sont prêts, mais il n'existe ni cartes ni
  pack correspondants dans le catalogue actuel.

## 5. À configurer en production

1. Appliquer `supabase/migrations/047_cadres.sql`, puis `npm run db:frames`.
2. Renseigner `SUPABASE_SERVICE_ROLE_KEY` (déblocages immédiats, file, cron).
3. Renseigner `CRON_SECRET`, puis planifier quotidiennement
   `GET /api/cron/frames` avec `Authorization: Bearer $CRON_SECRET`.
4. Vérifier `/dev/frames` et, avec un compte `is_admin`, `/admin/cadres`.

## 6. Fichiers principaux

- `src/lib/frames.config.ts` — configuration et moteur pur.
- `src/lib/frames.ts` — lecture des stats, évaluation runtime, vue et rapport.
- `supabase/migrations/047_cadres.sql` / `.down.sql`.
- `src/components/avatar-frame.tsx`, `src/components/frame-gallery.tsx`,
  `src/components/profile-editor.tsx`.
- `src/app/(game)/profil/page.tsx`, `src/app/(game)/admin/cadres/page.tsx`,
  `src/app/dev/frames/*`.
- `src/app/api/cron/frames/route.ts`.
- `scripts/db-frames.ts`, `scripts/db-frames-verify.ts`.
- `tests/cadres.test.ts`, `tests/classement.test.ts`.
