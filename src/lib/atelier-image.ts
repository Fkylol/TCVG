/**
 * Affichage des visuels dans l'atelier.
 *
 * Les hébergeurs d'images (CDN de Fandom, Wikimedia, sites de fan art) filtrent
 * les requêtes : sans le `Referer` du site, ils répondent 403 ou une page
 * anti-robot. Un navigateur qui affiche la page depuis `localhost` n'envoie pas
 * ce referer-là, et l'aperçu reste vide alors que le serveur, lui, a bien
 * vérifié l'image.
 *
 * L'atelier fait donc passer l'affichage par son propre serveur
 * (`/atelier/image`), qui joint les en-têtes attendus. Le jour où la carte est
 * enregistrée, c'est toujours l'URL d'origine qui est conservée.
 */

/** URL à donner à `<img>` : la même image, servie par l'atelier. */
export function atelierImageSrc(url: string): string {
  if (!url) return "";
  // Une URL relative (fichier local du site) n'a pas besoin du relais.
  if (!/^https?:\/\//i.test(url)) return url;
  return `/atelier/image?u=${encodeURIComponent(url)}`;
}
