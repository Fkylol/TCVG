# TCVG — état des lieux et reste à faire

_Mis à jour le 23 octobre 2026._

## Où en est le site

- Production : <https://tcvg.fkylol.workers.dev> — version déployée `69a52339` (marché + visuels de boosters).
- En local, non déployé : révélation des boosters carte par carte et visuels recadrés sur le sachet.
- Base : projet Supabase `jvmozjfibkbkzzpafoos`, migrations `002` à `011` appliquées.
- Code : `tsc` propre, `lint` propre, `npm test` 9/9, `npm run build` OK.

### Étapes livrées

| Étape | État | Détail |
|---|---|---|
| 1 · Franchises et genres | fait | 32 franchises, 10 genres, 96 liaisons, `cards.franchise_id` NOT NULL |
| 2 · Pixels | fait | Solde dans l'en-tête, bonus quotidien de **10 Pixels / 24 h**, registre `pixel_transactions` |
| 3 · Boosters payants | fait | Mix 20 P · 5 cartes, 3 boosters de genre à 30 P, pity 10 / 50, holo 2 % |
| 4 · Recyclage des doublons | fait | `recycle_card` / `recycle_all_duplicates`, boutons collection + fiche carte, 21/21 vérifications en base |
| 5 · Marché entre joueurs | fait | Annonces normales et holos, achat atomique, commission 5 %, bornes dynamiques, `/marche` + vente depuis la fiche carte |
| Connexion Discord | fait | Discord seul : plus de formulaire email, `/login` et `/signup` limités à l'OAuth |
| Pied de page | fait | Six entrées : Raretés, Règles, Infos, Nouveautés, Classement, Avis et bugs |
| Pages publiques | fait | `/regles`, `/infos`, `/nouveautes`, `/classement`, `/avis-et-bugs` |
| Visuels des boosters | fait | 11 visuels recadrés sur le sachet (520 × 760) dans `public/booster/`, Mix en pack vitrine, un visuel par thème dans la boutique |
| Ouverture carte par carte | fait | Dos de carte (`dos-carte.jpg`) dont la lueur change de couleur et d'intensité selon la rareté, retournement au clic, récapitulatif ; boosters gratuits et payants |
| Avis et bugs par email | fait | Message enregistré dans `public.feedback`, puis notification Resend (`src/lib/email.ts`). Clé dans `.env` en local, secret Cloudflare en production ; destinataire à régler avec `FEEDBACK_EMAIL_TO` |
| Puissance, aura et qualité | fait | Barème central `STAT_BANDS` + coefficient 0–1 par carte dans `src/lib/stats.ts`, qualité 60/40 (Standard → Relique), affichage fiche + vignette, score de collection sur `/profil`, section dans `/regles`, 9 tests |

### Choses à faire côté tableaux de bord (pas dans le code)

1. **Supabase → Authentication → URL Configuration** : Site URL = `https://tcvg.fkylol.workers.dev`, Redirect URLs = `https://tcvg.fkylol.workers.dev/**`. Tant que `localhost:3000` est la Site URL, la connexion renvoie sur `localhost:3000/?code=…` et la session n'est jamais créée.
2. **Discord Developer Portal** : redirect `https://jvmozjfibkbkzzpafoos.supabase.co/auth/v1/callback`, puis fournisseur activé dans Supabase (déjà fait, l'erreur `Unsupported provider` a disparu).
3. **Supabase → Authentication → Providers → Email** : fait — vérifié (« Email logins are disabled »). Seule la connexion Discord fonctionne.
4. Vérifier après reconnexion que le solde `◆ N` apparaît dans l'en-tête.

---

## Ce qui reste

### A. Étape 5 — marché entre joueurs · livrée et déployée

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

### B. Suite des stats

- **Classement** : `/classement` classe encore par nombre de cartes uniques. Passer au score de collection demande une migration (fonction `leaderboard` avec la somme des qualités).
- **Cadres** : les paliers actuels (10 / 25 cartes, une Légendaire, une Mythique) doivent être remplacés par des conditions multiples, avec le score de collection et la progression affichée.
- **Duel** : `duelScore()` est figé dans `src/lib/stats.ts` (70 % puissance, 30 % aura), aucun mode de combat ne l'utilise encore.
- Le coefficient d'une carte se règle dans `CARD_COEFFICIENTS` ; un ajout de carte sans coefficient retombe à 0,5 et fait échouer le test de couverture.

### C. Email des avis et bugs

- **Destinataire manquant** : `FEEDBACK_EMAIL_TO` n'est pas encore défini. Sans domaine vérifié chez Resend, l'expéditeur est `onboarding@resend.dev` et le destinataire doit être l'adresse du compte Resend.
- **Production** : `npx wrangler secret put RESEND_API_KEY` puis `npx wrangler secret put FEEDBACK_EMAIL_TO`. La clé ne doit jamais figurer dans `wrangler.jsonc`.
- `FEEDBACK_EMAIL_FROM` permettra plus tard d'envoyer depuis un domaine vérifié.
- Testé : clé valide (aucun domaine vérifié), envoi Resend 200 et `sendFeedbackEmail()` à `true`.

### D. À déployer

- `npm run build` passe, aucune migration nécessaire : cette livraison ne touche que l'interface (révélation et visuels).
- Ajouter l'entrée de changelog « Ouverture carte par carte » au moment de la mise en ligne, pas avant.
- Vérifié sur le serveur de dev avec une session réelle : ouverture gratuite et achat du Mix, dos de carte, lueur des 5 raretés, retournement, carte suivante, récapitulatif.

### E. Points mineurs laissés de côté

- Les holos ne sont visibles que dans la révélation d'achat et par un `✦n` dans la collection (pas sur la fiche de la carte).
- Pas de compteur de pity affiché à l'acheteur (la garantie existe en base, elle n'est pas montrée).
- Le bonus quotidien est réclamé automatiquement mais rien ne l'annonce visuellement.
- `open_boosters()` (boosters gratuits) reçoit encore les cartes du client ; `buy_booster()` ne fait plus confiance au client. À aligner plus tard.
- Le marché n'a ni expiration d'annonce ni édition de prix ; les holos se vendent dans le même formulaire que les normales. `/nouveautes` est à jour pour les étapes 2, 3 et 5.
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
