/**
 * Gère les administrateurs du marché (`profiles.is_admin`).
 *
 * Le drapeau n'est jamais modifiable depuis le site : la promotion passe par
 * ce script (ou le SQL Editor). L'email n'est pas stocké dans `profiles` : on
 * désigne un joueur par son pseudo.
 *
 * Usage :
 *   npm run db:admin -- --list
 *   npm run db:admin -- <pseudo>            → promeut
 *   npm run db:admin -- --revoke <pseudo>   → révoque
 */

import { openRunner } from "./lib/db-runner";

/** Échappe une valeur pour l'inclure dans un littéral SQL. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const revoke = args.includes("--revoke");
  const list = args.length === 0 || args.includes("--list");
  const pseudo = args.find((arg) => !arg.startsWith("--"))?.trim();

  if (list && !pseudo) {
    const runner = await openRunner();
    try {
      const admins = await runner.query(
        `select username from public.profiles where is_admin order by username`,
      );
      console.log(
        admins.length === 0
          ? "Aucun administrateur. Promeus-en un : npm run db:admin -- <pseudo>"
          : `Administrateurs : ${admins.map((row) => row.username).join(", ")}`,
      );
    } finally {
      await runner.close();
    }
    return;
  }

  if (!pseudo) {
    throw new Error("Indique un pseudo : npm run db:admin -- <pseudo>");
  }

  const runner = await openRunner();
  try {
    const found = await runner.query(
      `select id, username, is_admin from public.profiles where lower(username) = lower(${quote(pseudo)})`,
    );

    if (found.length === 0) {
      throw new Error(`Aucun joueur nommé « ${pseudo} ».`);
    }
    if (found.length > 1) {
      throw new Error(`Plusieurs joueurs portent « ${pseudo} » : renomme-les d'abord.`);
    }

    const player = found[0];
    if (Boolean(player.is_admin) === !revoke) {
      console.log(
        revoke
          ? `${player.username} n'était pas administrateur.`
          : `${player.username} est déjà administrateur.`,
      );
      return;
    }

    await runner.query(
      `update public.profiles set is_admin = ${revoke ? "false" : "true"}
        where id = ${quote(String(player.id))}`,
    );

    console.log(
      revoke
        ? `✓ ${player.username} n'est plus administrateur.`
        : `✓ ${player.username} peut ouvrir /admin/marche.`,
    );
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
