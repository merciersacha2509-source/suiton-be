/**
 * `server-only` est un marqueur resolu par le bundler Next.js : il fait
 * echouer la compilation si un module serveur est importe depuis un composant
 * client. Vitest ne connait pas cette resolution, d'ou ce stub vide.
 *
 * Il ne desactive rien : la garantie reste assuree au build par Next.js.
 */
export {};
