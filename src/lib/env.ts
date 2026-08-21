import { z } from 'zod';

/**
 * Validation des variables d'environnement au demarrage.
 *
 * Une variable manquante doit faire echouer le boot, pas la premiere requete
 * d'un client un vendredi soir a 22 h. C'est la seule raison d'etre de ce
 * fichier.
 */

/**
 * Environnement applicatif — a ne pas confondre avec NODE_ENV.
 *
 * NODE_ENV dit comment le code est COMPILE ; APP_ENV dit a quoi il est
 * BRANCHE. Une preview Vercel tourne en NODE_ENV=production tout en devant
 * rester non indexable, ne jamais envoyer de courriel reel et n'utiliser que
 * des donnees de demonstration. Sans cette distinction, on ne peut pas
 * exprimer « build de production, environnement de test » — et c'est
 * exactement la situation d'une preview.
 */
export type AppEnv = 'development' | 'preview' | 'production';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),

  /**
   * Mode d'envoi des courriels.
   *   preview     — rien ne part, tout est ecrit sur disque et consultable
   *   production  — envoi reel via Resend
   *
   * Le defaut est `preview`. Un oubli de configuration doit produire un
   * courriel non envoye, jamais un courriel parti chez un vrai client.
   */
  EMAIL_MODE: z.enum(['preview', 'production']).default('preview'),

  // Obligatoires des le Sprint 1
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY manquante'),
  PORTAL_TOKEN_PEPPER: z
    .string()
    .min(16, 'PORTAL_TOKEN_PEPPER trop court (32 octets attendus)'),

  // Integrations activees au fil des sprints — optionnelles ici.
  RESEND_API_KEY: z.string().optional(),
  /** Expediteur des courriers transactionnels. Doit etre un domaine verifie chez Resend. */
  RESEND_FROM: z.string().default('SUITON <no-reply@suiton.be>'),
  /** Destinataire des notifications internes (nouvelle demande, erreur). */
  NOTIFY_EMAIL: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  MAKE_WEBHOOK_SECRET: z.string().optional(),
  BILLIT_API_KEY: z.string().optional(),
  BILLIT_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  PIPEDRIVE_API_TOKEN: z.string().optional(),
  PIPEDRIVE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const publicSchema = z.object({
  /** Repris cote navigateur : le bandeau d'environnement en depend. */
  NEXT_PUBLIC_APP_ENV: z
    .enum(['development', 'preview', 'production'])
    .default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL invalide'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY manquante'),
  NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL invalide'),
  /** Google Analytics. Absent = desactive, et aucune banniere de cookies. */
  NEXT_PUBLIC_GA_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/, 'NEXT_PUBLIC_GA_ID doit ressembler a G-XXXXXXXXXX')
    .optional(),
});

function fail(prefix: string, error: z.ZodError): never {
  const details = error.issues.map(
    (i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`,
  );
  throw new Error(`${prefix}\n${details.join('\n')}\n\nVoir .env.example.`);
}

/**
 * Variables publiques. Lisibles cote serveur ET cote navigateur.
 * Next.js remplace ces acces a la compilation : ils doivent etre litteraux.
 */
export const publicEnv = (() => {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID || undefined,
  });
  if (!parsed.success) fail('Variables d’environnement publiques invalides :', parsed.error);
  return parsed.data;
})();

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/**
 * Variables serveur. Fonction et non constante : appeler ceci depuis un
 * composant client doit echouer bruyamment, pas silencieusement.
 */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv() a ete appele cote navigateur. Ces secrets ne sortent pas du serveur.',
    );
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) fail('Variables d’environnement serveur invalides :', parsed.error);

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/* -------------------------------------------------------------------------- */
/* Aides d'environnement                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Environnement applicatif, lisible partout — serveur comme navigateur.
 *
 * Utilise la variable publique : le bandeau d'environnement et les liens de
 * demonstration doivent pouvoir la lire cote client.
 */
export function appEnv(): AppEnv {
  return publicEnv.NEXT_PUBLIC_APP_ENV;
}

/** Vrai uniquement sur l'environnement branche au domaine reel. */
export function estProduction(): boolean {
  return appEnv() === 'production';
}

/**
 * Le site n'est indexable QUE en production.
 *
 * Une preview indexee est un doublon integral de suiton.be dans l'index de
 * Google : deux domaines, le meme contenu, et une cannibalisation qu'on met
 * des mois a defaire. Cette fonction est la source unique de cette decision ;
 * les metadonnees, robots.txt et l'en-tete X-Robots-Tag s'y referent tous.
 */
export function siteIndexable(): boolean {
  return estProduction();
}

/**
 * Garde-fou d'execution.
 *
 * Refuse de demarrer si un environnement non-production porte une
 * configuration de production, ou l'inverse. La verification est volontairement
 * bruyante : une preview qui ecrit dans la base reelle ne se remarque pas
 * avant d'avoir fait des degats.
 */
export function verifierCoherenceEnvironnement(): string[] {
  const anomalies: string[] = [];
  const app = publicEnv.NEXT_PUBLIC_APP_ENV;
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const courriel = typeof window === 'undefined' ? serverEnv().EMAIL_MODE : 'preview';

  if (app !== 'production' && /^https:\/\/(www\.)?suiton\.be\/?$/.test(site)) {
    anomalies.push(
      `NEXT_PUBLIC_SITE_URL pointe sur le domaine de production alors que APP_ENV vaut « ${app} ». ` +
        'Les liens de portail envoyes aux clients mèneraient sur le mauvais site.',
    );
  }

  if (app === 'production' && !/^https:\/\/suiton\.be$/.test(site.replace(/\/+$/, ''))) {
    anomalies.push(
      `APP_ENV vaut « production » mais NEXT_PUBLIC_SITE_URL vaut « ${site} ». ` +
        'Les URL canoniques et le sitemap en derivent : elles seraient fausses.',
    );
  }

  if (app !== 'production' && courriel === 'production') {
    anomalies.push(
      `EMAIL_MODE vaut « production » alors que APP_ENV vaut « ${app} ». ` +
        'Des courriels de test partiraient vers de vraies adresses.',
    );
  }

  return anomalies;
}
