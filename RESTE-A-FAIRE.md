# TCVG — état des lieux et reste à faire

_Mis à jour le 23 octobre 2026._

## Où en est le site

- Production : <https://tcvg.fkylol.workers.dev> — version déployée `b1b39a8c` (recyclage + Discord uniquement).
- Base : projet Supabase `jvmozjfibkbkzzpafoos`, migrations `002` à `011` appliquées.
- Code local : `tsc` propre, `lint` propre, `npm test` 9/9, `npm run build` OK.
- **Pas encore déployé** : marché entre joueurs et visuels de boosters par thème.

### Étapes livrées

| Étape | État | Détail |
|---|---|---|
| 1 · Franchises et genres | fait | 32 franchises, 10 genres, 96 liaisons, `cards.franchise_id` NOT NULL |
| 2 · Pixels | fait | Solde dans l'en-tête, bonus quotidien de **10 Pixels / 24 h**, registre `pixel_transactions` |
| 3 · Boosters payants | fait | Mix 20 P · 5 cartes, 3 boosters de genre à 30 P, pity 10 / 50, holo 2 % |
| 4 · Recyclage des doublons | fait | `recycle_card` / `recycle_all_duplicates`, boutons collection + fiche carte, 21/21 vérifications en base |
| 5 · Marché entre joueurs | fait (code) | Annonces normales et holos, achat atomique, commission 5 %, bornes dynamiques, `/marche` + vente depuis la fiche carte |
| Connexion Discord | fait | Discord seul : plus de formulaire email, `/login` et `/signup` limités à l'OAuth |
| Pied de page | fait | Six entrées : Raretés, Règles, Infos, Nouveautés, Classement, Avis et bugs |
| Pages publiques | fait | `/regles`, `/infos`, `/nouveautes`, `/classement`, `/avis-et-bugs` |
| Visuels des boosters | fait (code) | 11 visuels dans `public/booster/`, Mix en pack vitrine, un visuel par thème dans la boutique |

### Choses à faire côté tableaux de bord (pas dans le code)

1. **Supabase → Authentication → URL Configuration** : Site URL = `https://tcvg.fkylol.workers.dev`, Redirect URLs = `https://tcvg.fkylol.workers.dev/**`. Tant que `localhost:3000` est la Site URL, la connexion renvoie sur `localhost:3000/?code=…` et la session n'est jamais créée.
2. **Discord Developer Portal** : redirect `https://jvmozjfibkbkzzpafoos.supabase.co/auth/v1/callback`, puis fournisseur activé dans Supabase (déjà fait, l'erreur `Unsupported provider` a disparu).
3. **Supabase → Authentication → Providers → Email** : fait — vérifié (« Email logins are disabled »). Seule la connexion Discord fonctionne.
4. Vérifier après reconnexion que le solde `◆ N` apparaît dans l'en-tête.

---

## Ce qui reste

### A. Étape 5 — marché entre joueurs · livrée (code, pas déployée)

Migration `supabase/migrations/011_marche.sql` appliquée et testée le 23 octobre 2026 (39/39).

- `market_listings` : une ligne par copie mise en vente, statut active / sold / cancelled, traces de commission (`fee_pixels`) et du net vendeur (`seller_payout`).
- **Escrow** : une copie quitte la collection à la mise en vente et y revient à l'annulation. Une normale reste toujours au vendeur ; une holo ne part que s'il reste une autre copie.
- **Achat atomique** (`buy_listing`) : verrou de l'annonce, verrous de profils ordonnés, débit acheteur, crédit vendeur, transfert de la copie, deux lignes `pixel_transactions` (`achat_marche`, `vente_marche`). Achat de sa propre annonce interdit.
- **Commission** : 5 % arrondis au supérieur, versés à personne (puits). Exemple : 400 P → 20 de commission, 380 au vendeur.
- **Prix dynamiques** (`market_quote`) : médiane des ventes des 30 derniers jours dès 3 ventes, sinon base de la rareté. Fourchette = référence × 0,5 à × 2, encadrée par un plancher/plafond par rareté (`market_prices` : C 2–25 · R 5–75 · SR 15–250 · UR 60–1000 · L 200–3000). Holos : base et garde-fous × 3.
- Limite : 10 annonces actives par joueur (`market_max_active`), annulation réservée au vendeur.
- Interface : `/marche` (filtres rareté / genre / prix, tri, onglets « Annonces » et « Mes annonces »), formulaire de mise en vente sur `/card/[id]` avec prix conseillé, fourchette et net vendeur.
- Vérifié en base sur des comptes de test : crédit unique, achat holo, commission, annulation, double achat concurrent (une seule réussite), devis dynamique après 3 ventes, visibilité des annonces. Comptes supprimés ensuite.
- Vérifié sur le serveur de dev avec une session réelle : `/marche` affiche l'annonce et le bouton d'achat, `/card/kratos` affiche le formulaire, `/boosters` sert les 11 visuels.

### B. Points mineurs laissés de côté

- Les holos ne sont visibles que dans la révélation d'achat et par un `✦n` dans la collection (pas sur la fiche de la carte).
- Pas de compteur de pity affiché à l'acheteur (la garantie existe en base, elle n'est pas montrée).
- Le bonus quotidien est réclamé automatiquement mais rien ne l'annonce visuellement.
- `open_boosters()` (boosters gratuits) reçoit encore les cartes du client ; `buy_booster()` ne fait plus confiance au client. À aligner plus tard.
- Les étapes 2 (Pixels), 3 (boosters payants) et 5 (marché) restent à ajouter à `/nouveautes` au moment du déploiement. Le marché n'a ni expiration d'annonce ni édition de prix ; les holos se vendent dans le même formulaire que les normales.
- Les prix dynamiques restent plafonnés par la rareté : une carte SR ne peut pas dépasser 250 P, même si ses ventes montent.

---

## Commandes utiles

```bash
npm run dev                                   # site local
npm run db:migrate supabase/migrations/XXX.sql # appliquer une migration
npm run db:cards                              # resynchroniser le catalogue en base
npx tsc --noEmit && npm run lint && npm test  # vérifications
npm run cf:build && npm run cf:deploy         # mise en ligne
```

**Ordre à respecter** : migration d'abord, déploiement ensuite. Le code lit des colonnes ajoutées par les migrations ; l'inverse casse `/collection` et `/boosters`.

## Fichiers de référence

- Migrations : `supabase/migrations/` (`005` franchises, `007` pixels, `009` boosters, `010` recyclage, `011` marché).
- Catalogue des cartes : `src/lib/cards.ts` (seule source de vérité du contenu).
- Raretés et poids : `src/lib/game.ts`.
- Accès base côté serveur : `src/lib/data.ts` ; actions : `src/app/actions.ts`.
- Textes des pages publiques : `src/app/(pages)/`.
