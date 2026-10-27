/**
 * Lanceur de l'atelier d'ajout de cartes (`/atelier/cartes`).
 *
 *   npm run atelier
 *
 * Démarre le serveur de développement s'il ne tourne pas déjà, puis ouvre la
 * page dans le navigateur par défaut. L'atelier écrit dans `src/data` et lance
 * `db:cards` : il n'existe qu'en local, jamais en production.
 */

import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT ?? 3000);
const PATHNAME = "/atelier/cartes";
const URL = `http://localhost:${PORT}${PATHNAME}`;

async function responds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500), redirect: "manual" });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 120_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await responds(`http://localhost:${PORT}/`)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? { file: "cmd", args: ["/c", "start", "", url] }
      : process.platform === "darwin"
        ? { file: "open", args: [url] }
        : { file: "xdg-open", args: [url] };

  const child = spawn(command.file, command.args, { stdio: "ignore", detached: true });
  child.on("error", () => {
    console.log(`Ouvre ${url} dans ton navigateur.`);
  });
  child.unref();
}

async function main() {
  const running = await responds(`http://localhost:${PORT}/`);

  if (!running) {
    console.log(`Démarrage du serveur de développement sur le port ${PORT}…`);
    const server = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
      stdio: "ignore",
      shell: true,
      detached: true,
    });
    server.unref();

    if (!(await waitForServer())) {
      console.error(
        "Le serveur de développement n'a pas répondu. Lance `npm run dev` dans un terminal, puis `npm run atelier`.",
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(`Atelier prêt : ${URL}`);
  // `ATELIER_NO_OPEN=1` : utile pour vérifier le lanceur sans ouvrir de fenêtre.
  if (!process.env.ATELIER_NO_OPEN) openBrowser(URL);
}

void main();
