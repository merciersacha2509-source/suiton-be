import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Jetons de portail client.
 *
 * Le jeton circule dans une URL envoyee par e-mail. Il n'est JAMAIS stocke
 * en clair : la base ne garde que sha256(jeton || poivre). Une fuite du
 * dump de la base ne donne alors acces a aucun dossier.
 *
 * Consequence assumee : un jeton perdu ne se retrouve pas. On en regenere
 * un et on revoque l'ancien.
 *
 * 32 octets aleatoires = 2^256 possibilites. La limitation de debit sur le
 * portail (60 requetes/heure/jeton) rend la force brute sans objet, mais
 * l'entropie reste la vraie defense.
 */

const LONGUEUR_OCTETS = 32;

export function genererJetonPortail(): string {
  return randomBytes(LONGUEUR_OCTETS).toString('base64url');
}

export function hacherJeton(jeton: string): string {
  return createHash('sha256')
    .update(`${jeton}${serverEnv().PORTAL_TOKEN_PEPPER}`)
    .digest('hex');
}

/**
 * Comparaison a temps constant.
 *
 * `a === b` sur une chaine s'arrete au premier caractere different : le
 * temps de reponse fuit alors la longueur du prefixe correct. Sur un hash
 * hexadecimal de longueur fixe, timingSafeEqual supprime cette fuite.
 */
export function comparerHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** URL complete du portail. */
export function urlPortail(jeton: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/portail/${jeton}`;
}

/**
 * Le jeton d'un lien doit ressembler a un base64url de 32 octets.
 * Ce filtre evite d'interroger la base pour des chaines manifestement
 * fabriquees.
 */
export function jetonPlausible(valeur: string): boolean {
  return /^[A-Za-z0-9_-]{40,50}$/.test(valeur);
}
