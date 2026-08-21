import EmbeddedPostgres from 'embedded-postgres';

/**
 * PostgreSQL embarque, pour verifier le schema sans Docker.
 *
 * Les journaux sont coupes : les messages de checkpoint noient la sortie des
 * assertions, et un audit illisible n'est pas un audit.
 */
export const DATA = '/tmp/pgdata-prod';
export const PORT = 55432;
export const DSN_ADMIN = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
export const DSN = `postgres://postgres:postgres@127.0.0.1:${PORT}/suiton`;

export async function demarrer() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  try {
    await pg.initialise();
  } catch {
    /* cluster deja initialise */
  }
  await pg.start();
  return pg;
}
