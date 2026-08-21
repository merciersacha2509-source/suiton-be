/**
 * Erreurs metier typees.
 *
 * Elles portent le code HTTP a renvoyer, ce qui evite d'eparpiller des
 * `status: 409` dans les routes et de finir avec deux endroits qui ne sont
 * pas d'accord sur le code d'une meme situation.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 403 — authentifie, mais pas autorise. */
export class ForbiddenError extends AppError {
  constructor(message = 'Acces refuse.') {
    super(message, 403, 'forbidden');
  }
}

/** 401 — pas de session valide. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise.') {
    super(message, 401, 'unauthorized');
  }
}

/**
 * 404 — utilise aussi pour un jeton invalide. Repondre 401 confirmerait
 * l'existence de la ressource ; 404 ne dit rien.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Introuvable.') {
    super(message, 404, 'not_found');
  }
}

/** 409 — creneau deja pris, verrou optimiste, doublon. */
export class ConflictError extends AppError {
  constructor(message = 'Conflit.', code = 'conflict') {
    super(message, 409, code);
  }
}

/** 429 */
export class RateLimitError extends AppError {
  constructor(
    message = 'Trop de requetes. Reessayez dans un instant.',
    readonly retryAfterSeconds = 60,
  ) {
    super(message, 429, 'rate_limited');
  }
}
