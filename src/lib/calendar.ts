import 'server-only';
import { serverEnv } from '@/lib/env';

/**
 * Google Calendar — client minimal en REST.
 *
 * Le paquet `googleapis` pese plus de 50 Mo une fois installe et fait
 * exploser la taille des fonctions Vercel. Trois appels REST suffisent :
 * creation, mise a jour, suppression.
 *
 * ABSENCE DE CONFIGURATION = MODE DEGRADE, PAS ERREUR.
 * Tant que les identifiants Google ne sont pas renseignes, `estConfigure()`
 * renvoie false et les interventions restent planifiees dans Supabase seule.
 * Le calendrier est un miroir : sa panne ne doit jamais bloquer une
 * reservation, car Supabase reste la source de verite.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

export function estConfigure(): boolean {
  const env = serverEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
}

let cache: { token: string; expire: number } | null = null;

async function accessToken(): Promise<string> {
  if (cache && cache.expire > Date.now() + 60_000) return cache.token;

  const env = serverEnv();
  const reponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: env.GOOGLE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    }),
  });

  if (!reponse.ok) {
    throw new Error(`Google OAuth a repondu ${reponse.status}`);
  }

  const data = (await reponse.json()) as { access_token: string; expires_in: number };
  cache = { token: data.access_token, expire: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export interface EvenementCalendrier {
  titre: string;
  description: string;
  lieu: string;
  debut: Date;
  fin: Date;
  /** Provisoire tant que le devis n'est pas accepte. */
  provisoire: boolean;
}

function corps(e: EvenementCalendrier) {
  return {
    summary: e.provisoire ? `[Provisoire] ${e.titre}` : e.titre,
    description: e.description,
    location: e.lieu,
    start: { dateTime: e.debut.toISOString(), timeZone: 'Europe/Brussels' },
    end: { dateTime: e.fin.toISOString(), timeZone: 'Europe/Brussels' },
    transparency: e.provisoire ? 'transparent' : 'opaque',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
  };
}

const calendrier = () => serverEnv().GOOGLE_CALENDAR_ID ?? 'primary';

export async function creerEvenement(e: EvenementCalendrier): Promise<string | null> {
  if (!estConfigure()) return null;

  const reponse = await fetch(`${API}/calendars/${encodeURIComponent(calendrier())}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corps(e)),
  });

  if (!reponse.ok) {
    throw new Error(`Google Calendar a repondu ${reponse.status} : ${await reponse.text()}`);
  }

  const data = (await reponse.json()) as { id: string };
  return data.id;
}

export async function majEvenement(id: string, e: EvenementCalendrier): Promise<void> {
  if (!estConfigure()) return;

  const reponse = await fetch(
    `${API}/calendars/${encodeURIComponent(calendrier())}/events/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corps(e)),
    },
  );

  if (!reponse.ok && reponse.status !== 404) {
    throw new Error(`Google Calendar a repondu ${reponse.status}`);
  }
}

export async function supprimerEvenement(id: string): Promise<void> {
  if (!estConfigure()) return;

  const reponse = await fetch(
    `${API}/calendars/${encodeURIComponent(calendrier())}/events/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${await accessToken()}` } },
  );

  // 404 et 410 : l'evenement n'existe deja plus. C'est le resultat voulu.
  if (!reponse.ok && ![404, 410].includes(reponse.status)) {
    throw new Error(`Google Calendar a repondu ${reponse.status}`);
  }
}

/**
 * Synchronisation tolerante a la panne.
 *
 * Renvoie l'identifiant d'evenement, ou null si Google est indisponible.
 * L'appelant journalise et poursuit : l'intervention existe en base, c'est
 * ce qui compte. Un rattrapage manuel est toujours possible ; une
 * reservation perdue ne se rattrape pas.
 */
export async function synchroniserSansEchec(
  e: EvenementCalendrier,
  existant: string | null,
): Promise<{ id: string | null; erreur: string | null }> {
  if (!estConfigure()) return { id: existant, erreur: null };

  try {
    if (existant) {
      await majEvenement(existant, e);
      return { id: existant, erreur: null };
    }
    return { id: await creerEvenement(e), erreur: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    console.error('[calendar] synchronisation impossible', message);
    return { id: existant, erreur: message };
  }
}
