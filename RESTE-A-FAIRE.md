# TCVG — état des lieux et reste à faire

_Mis à jour le 23 octobre 2026._

## Où en est le site

- Production : <https://tcvg.fkylol.workers.dev> — version déployée `b1b39a8c` (recyclage + Discord uniquement).
- Base : projet Supabase `jvmozjfibkbkzzpafoos`, migrations `002` à `010` appliquées.
- Code : `tsc` propre, `lint` propre, `npm test` 9/9, `npm run build` OK.

### Étapes livrées

| Étape | État | Détail |
|---|---|---|
| 1 · Franchises et genres | fait | 32 franchises, 10 genres, 96 liaisons, `cards.franchise_id` NOT NULL |
| 2 · Pixels | fait | Solde dans l'en-tête, bonus quotidien de **10 Pixels / 24 h**, registre `pixel_transactions` |
| 3 · Boosters payants | fait | Mix 20 P · 5 cartes, 3 boosters de genre à 30 P, pity 10 / 50, holo 2 % |
| 4 · Recyclage des doublons | fait | `recycle_card` / `recycle_all_duplicates`, boutons collection + fiche carte, 21/21 vérifications en base |
| Connexion Discord | fait | Discord seul : plus de formulaire email, `/login` et `/signup` limités à l'OAuth |
| Pied de page | fait | Six entrées : Raretés, Règles, Infos, Nouveautés, Classement, Avis et bugs |
| Pages publiques | fait | `/regles`, `/infos`, `/nouveautes`, `/classement`, `/avis-et-bugs` |
| Visuel du booster | fait | Image découpée de `booster1.jpg` → `public/booster/mix.jpg` |

### Choses à faire côté tableaux de bord (pas dans le code)

1. **Supabase → Authentication → URL Configuration** : Site URL = `https://tcvg.fkylol.workers.dev`, Redirect URLs = `https://tcvg.fkylol.workers.dev/**`. Tant que `localhost:3000` est la Site URL, la connexion renvoie sur `localhost:3000/?code=…` et la session n'est jamais créée.
2. **Discord Developer Portal** : redirect `https://jvmozjfibkbkzzpafoos.supabase.co/auth/v1/callback`, puis fournisseur activé dans Supabase (déjà fait, l'erreur `Unsupported provider` a disparu).
3. **Supabase → Authentication → Providers → Email** : désactiver le fournisseur, pour que Discord soit réellement la seule connexion possible côté serveur. Les comptes créés avec un email ne pourront plus se connecter.
4. Vérifier après reconnexion que le solde `◆ N` apparaît dans l'en-tête.

---

## Ce qui reste

### A. Étape 4 — recyclage des doublons · livrée

Migration `supabase/migrations/010_recyclage.sql` appliquée et code déployé le 23 octobre 2026.

- `recycle_values` : C 1 · R 3 · SR 10 · UR 40 · L 150 (modifiable en base).
- Règle retenue : **une copie normale est toujours conservée** ; avec 1 normale + 1 holo, la normale n'est pas recyclable et l'holo l'est (3 ×).
- `recycle_card(card_id, holo)` : une copie à la fois, holo à 3 × la valeur.
- `recycle_all_duplicates()` : tous les doublons normaux en une instruction, holos intactes.
- Interface : bouton « Recycler · +N ◆ » sous chaque carte de `/collection`, bouton « Recycler les doublons » avec total et confirmation, recyclage de holo sur `/card/[id]` avec confirmation. Le solde de l'en-tête et le compteur de doublons se rafraîchissent après l'action.
- Vérifié en base sur un compte de test (21/21) : crédit unique, garde d'exemplaire, holo à 3 ×, tout-recycler sur 5 doublons, registre `pixel_transactions`, double clic simultané = un seul crédit. Compte supprimé ensuite.

### B. Étape 5 — marché entre joueurs (uniquement en Pixels)

Rien n'est commencé. Cadre déjà validé :

- `listings` (vendeur, carte, prix, statut active/sold/cancelled) ; seuls les doublons sont vendables, carte réservée pendant la vente.
- Achat atomique : débit acheteur, crédit vendeur moins 5 %, transfert, marquage, deux transactions `pixel_transactions`.
- Interdiction d'acheter sa propre annonce, prix minimum et maximum par rareté, annulation possible.
- Page Marché : filtres rareté / genre / prix, tri par prix, onglet « Mes annonces ».

### C. Points mineurs laissés de côté

- Les holos ne sont visibles que dans la révélation d'achat et par un `✦n` dans la collection (pas sur la fiche de la carte).
- Pas de compteur de pity affiché à l'acheteur (la garantie existe en base, elle n'est pas montrée).
- Le bonus quotidien est réclamé automatiquement mais rien ne l'annonce visuellement.
- `open_boosters()` (boosters gratuits) reçoit encore les cartes du client ; `buy_booster()` ne fait plus confiance au client. À aligner plus tard.
- Les étapes 2 (Pixels) et 3 (boosters payants) restent encore listées dans « en préparation » sur `/nouveautes`.

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

- Migrations : `supabase/migrations/` (`005` franchises, `007` pixels, `009` boosters, `010` recyclage).
- Catalogue des cartes : `src/lib/cards.ts` (seule source de vérité du contenu).
- Raretés et poids : `src/lib/game.ts`.
- Accès base côté serveur : `src/lib/data.ts` ; actions : `src/app/actions.ts`.
- Textes des pages publiques : `src/app/(pages)/`.
