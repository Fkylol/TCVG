# Rapport — Parrainage TCVG

## Ce qui a été fait

### Base de données

- **Migration `supabase/migrations/046_parrainage.sql`** (additive, rejouable) et son
  rollback `046_parrainage.down.sql`, appliqués sur le projet Supabase du jeu.
- Nouvelles colonnes `profiles` : `referral_code` (unique, généré par trigger),
  `bonus_boosters`, `discord_mfa_enabled`, `discord_mfa_checked_at`, `ip_hash`/`ip_hash_at`,
  `ua_hash`/`ua_hash_at`, `suspended_at`.
- Nouvelles tables : `referrals`, `booster_grants` (unicité `(user_id, reason, referral_id)`),
  `booster_openings` (journal serveur des ouvertures), `profile_activity_days`,
  `referral_audit`, `referral_rate_limits`. RLS activée, aucun accès direct depuis le client.
- `notifications` : colonnes `referral_id` et `message`, quatre nouveaux types
  (`referral_milestone`, `referral_pending`, `referral_paid`, `referral_refused`).
- `open_pack()` devient une enveloppe : l'ancien tirage est renommé `_open_pack_stock()`
  (inaccessible aux joueurs). L'enveloppe consomme **le stock normal d'abord**, puis le
  solde bonus, écrit une ligne de journal et réévalue le parrainage du filleul.
  Un `×10` appelle la fonction dix fois : le journal compte donc dix ouvertures.
- `evaluate_referral(id)` : évaluation unique, verrouillée et idempotente. Elle horodate le
  seuil, choisit la voie, applique les plafonds et les signaux de proximité, refuse avec un
  motif interne, et paie dans la même transaction (statut conditionnel + contrainte unique).
- `referral_cron_batch()` (paiements échus, reprise par parrainage),
  `purge_referral_fingerprints()` (empreintes > 90 jours), `referral_overview()`,
  `referral_admin_report()`, `referral_admin_decide()`, `referral_rate_hit()`.

### Application

- `src/lib/referral/config.ts` : tous les paramètres au même endroit.
- `src/lib/referral/rules.ts` : règles pures (codes, snowflake Discord, voies, plafonds,
  proximité, consommation stock/bonus), couvertes par `tests/parrainage.test.ts`.
- `src/lib/referral/service.ts` : empreintes HMAC salées, lecture de `mfa_enabled`,
  enregistrement de l'A2F, tableaux de bord.
- `src/app/invite/[code]/route.ts` : vérification serveur, limite de débit, cookie
  `tcvg_invite` (HttpOnly, 30 jours), redirection vers l'accueil.
- `src/app/auth/confirm/route.ts` : au retour OAuth — empreintes, jour d'activité, A2F,
  création du parrainage si le compte est neuf et le cookie présent. Un compte existant
  n'est jamais parrainé.
- `src/app/api/cron/referrals/route.ts` : tâche horaire protégée par `CRON_SECRET`.
- Pages `/parrainage` (lien, copie/partage, compteurs, suivi des filleuls, encart « Invité
  par », progression, A2F, revérification, aide Discord) et `/admin/parrainage` (filtres,
  approbation/refus, export CSV).
- Notifications in-site pour seuil atteint, attente (avec date), paiement et refus.
- Boosters bonus : pastille d'en-tête « stock/10 · +N », total stock + bonus pour ×1/×5/×10,
  badge sur la page Boosters, consommation atomique et jamais négative.
- Page `/confidentialite` et lien en pied de page ; texte « Infos » aligné sur le scope
  `identify` (plus d'email demandé).
- README et `DECISIONS.md` mis à jour.

## Configuration par défaut retenue

| Paramètre | Valeur |
| --- | --- |
| Boosters par côté | 3 |
| Ouvertures requises | 20 |
| Délai différé | 7 jours |
| Parrainages payés max / parrain | 20 |
| Parrainages en cours max / parrain | 50 |
| Jours d'activité pendant l'attente | 3 |
| Cookie d'invitation | 30 jours |
| Âge minimum du compte Discord | 0 (désactivé) |
| Conservation des empreintes | 90 jours |

Variables d'environnement à renseigner en production :

```bash
REFERRAL_HASH_SALT=…       # openssl rand -hex 32
CRON_SECRET=…              # en-tête Authorization: Bearer …
SUPABASE_SERVICE_ROLE_KEY=… # déjà nécessaire pour discord_links
```

## Vérifications

- `npm test` : **276 tests**, dont 24 nouveaux sur les règles du parrainage (auto-parrainage,
  compte existant, même Discord, seuil dont un ×10, immédiat/différé, A2F pendant l'attente,
  bannissement/déliaison, paiement unique, plafonds, même IP et 3 filleuls, stock avant bonus,
  solde jamais négatif, purge à 90 jours).
- `npx tsc --noEmit` : aucune erreur.
- Vérification en base (script temporaire, non versionné) : **31/31** — création/refus du
  parrainage, seuil lu depuis le journal, paiement immédiat, attente J+7, activation de l'A2F
  pendant l'attente, refus pour activité insuffisante, `a_examiner` sur 3 filleuls même IP,
  consommation stock puis bonus, refus propre quand tout est vide, tableau de bord, rapport
  admin, approbation admin, purge des empreintes, **deux évaluations simultanées = un seul
  paiement**.
- `npm run db:verify` (existant, exécuté après la migration) : **25/25** — le tirage, le stock, la concurrence et les RLS n'ont pas bougé.
- Droits SQL vérifiés : `authenticated` ne peut exécuter ni `_pay_referral`, ni
  `_refuse_referral`, ni `evaluate_referral`, ni `_open_pack_stock`, ni
  `referral_record_mfa` ; `service_role` les peut.
- Contrôles ciblés supplémentaires : approbation admin refusée hors « à examiner »
  (`not_review`), et `referral_record_mfa` écrit bien `mfa_check` dans `referral_audit`.

## Ce qui n'a pas pu être fait, et pourquoi

- **Pas de jeton Discord de rafraîchissement stocké.** Le cahier des charges l'autorisait
  *ou* demandait une nouvelle connexion Discord. Le projet ne stocke aucun jeton : l'A2F est
  relue à chaque connexion et par le bouton de revérification. Conséquence : entre deux
  connexions, `mfa_enabled` peut être ancien ; une valeur absente vaut « sans A2F » (voie
  différée), jamais une sanction. Un rafraîchissement automatique aurait exigé le
  `client_secret` Discord et un chiffrement au repos supplémentaires.
- **Pas de contrôle d'âge du compte Discord actif par défaut** (`DISCORD_MIN_ACCOUNT_AGE_DAYS = 0`),
  comme demandé ; le code le prend en charge dès qu'on passe la valeur à > 0.
- **Pas d'écran de bannissement.** Le contrôle lit `profiles.suspended_at`, à poser
  manuellement (SQL Editor) tant qu'aucune interface de modération n'existe. Les comptes
  signalés via `feedback` ne sont pas lus automatiquement : aucun champ fiable ne relie un
  signalement à un compte.
- **Limite de débit en fenêtre fixe**, en base : suffisante contre les rafales, pas contre
  un attaquant distribué.
- **La tâche horaire doit être déclenchée par un planificateur externe** (Cloudflare Cron
  Trigger, cron système, GitHub Actions…). Aucun planificateur n'est fourni par l'hébergement
  actuel.
- **Empreintes** : uniquement IP et agent utilisateur, sans fingerprinting navigateur. Les
  comptes créés avant la migration n'ont pas d'empreinte ; leurs parrainages ne bénéficient
  donc pas de la comparaison même-IP.

## Annuler un parrainage ou ajuster les paramètres

### Refuser / annuler avant paiement

```sql
update public.referrals
   set status = 'refuse', refused_reason = 'annulation_manuelle', updated_at = now()
 where id = 42;
-- Trace (facultatif mais recommandé) :
insert into public.referral_audit (referral_id, action, details)
values (42, 'admin_refuse', '{"reason":"annulation_manuelle"}');
```

### Annuler un parrainage déjà payé

Les boosters bonus sont retirés aux deux joueurs (sans descendre sous zéro), puis le
parrainage est marqué refusé. À exécuter dans une transaction :

```sql
begin;
with removed as (
  delete from public.booster_grants where referral_id = 42
  returning user_id, amount
)
update public.profiles p
   set bonus_boosters = greatest(0, p.bonus_boosters - r.amount)
  from removed r
 where p.id = r.user_id;

update public.referrals
   set status = 'refuse', refused_reason = 'annulation_manuelle',
       paid_at = null, updated_at = now()
 where id = 42;

insert into public.referral_audit (referral_id, action, details)
values (42, 'admin_revoke', '{"reason":"annulation_manuelle"}');
commit;
```

La contrainte unique de `booster_grants` étant supprimée par le `delete`, un nouveau
paiement ne peut pas se produire tant que le statut est `refuse`.

### Ajuster les paramètres

1. Modifier `src/lib/referral/config.ts` (affichage et tests).
2. Modifier les valeurs de `public.referral_config()` dans la migration 046, puis
   réappliquer la migration (`npm run db:migrate supabase/migrations/046_parrainage.sql`),
   ou exécuter directement un `create or replace function public.referral_config() …`
   avec les nouvelles valeurs. La base fait foi pour les décisions.
3. Le sel d'empreinte (`REFERRAL_HASH_SALT`) ne doit jamais changer en production : cela
   rendrait incomparables les empreintes déjà stockées.
