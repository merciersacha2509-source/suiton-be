import { courrielsCaptures } from '@/lib/emails/capture';
import { appEnv, serverEnv } from '@/lib/env';
import { SuitonLogo } from '@/components/brand/suiton-mark';

/**
 * Visualiseur des courriels captures.
 *
 * Affiche le HTML reellement produit, dans une iframe en bac a sable : c'est
 * la seule maniere de voir ce que verra le client, avec ses styles en ligne
 * et ses tableaux. Un rendu approximatif ne servirait a rien — les clients
 * de messagerie sont precisement l'endroit ou le HTML se comporte mal.
 *
 * `sandbox` sans `allow-scripts` : le contenu affiche vient de nos gabarits,
 * mais il porte des donnees client. Autant ne rien laisser s'executer.
 */
export const dynamic = 'force-dynamic';

export default async function PageCourriels() {
  const courriels = await courrielsCaptures();
  const mode = serverEnv().EMAIL_MODE;

  return (
    <div className="min-h-dvh bg-mineral">
      <header className="border-b border-mineral-dark bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4">
          <SuitonLogo />
          <div className="flex-1">
            <h1 className="font-heading text-lg font-semibold">Courriels capturés</h1>
            <p className="text-xs text-ardoise">
              Environnement « {appEnv()} » · EMAIL_MODE = {mode}
            </p>
          </div>
          <span
            className={
              mode === 'production'
                ? 'rounded-full bg-danger-wash px-3 py-1 text-xs font-medium text-danger'
                : 'rounded-full bg-succes-wash px-3 py-1 text-xs font-medium text-succes'
            }
          >
            {mode === 'production'
              ? 'ENVOI RÉEL — les courriels partent'
              : 'Aucun courriel ne part'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {courriels.length === 0 ? (
          <div className="rounded-suiton border border-mineral-dark bg-white p-8 text-center">
            <h2 className="font-heading text-base font-semibold">Aucun courriel capturé</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ardoise">
              Déclenchez une action qui en produit : une réservation depuis <code>/reservation</code>,
              une demande de rappel depuis <code>/contact</code>, ou l&apos;envoi d&apos;un devis
              depuis un chantier. Le message apparaîtra ici sans quitter votre machine.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-ardoise">
              {courriels.length} message{courriels.length > 1 ? 's' : ''}, du plus récent au plus
              ancien. Rien n&apos;a été envoyé.
            </p>
            <ul className="space-y-6">
              {courriels.map((c) => (
                <li
                  key={c.fichier}
                  className="overflow-hidden rounded-suiton border border-mineral-dark bg-white"
                >
                  <div className="border-b border-mineral-dark p-4">
                    <h2 className="font-heading text-base font-semibold">{c.sujet}</h2>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ardoise">
                      <div className="flex gap-1.5">
                        <dt>À</dt>
                        <dd className="font-medium text-abysse">{c.destinataire}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Le</dt>
                        <dd className="tabular">
                          {new Date(c.horodatage).toLocaleString('fr-BE')}
                        </dd>
                      </div>
                      {c.piecesJointes.length > 0 ? (
                        <div className="flex gap-1.5">
                          <dt>Pièces jointes</dt>
                          <dd className="font-medium text-abysse">
                            {c.piecesJointes.join(', ')}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  <iframe
                    title={`Aperçu — ${c.sujet}`}
                    srcDoc={c.html}
                    sandbox=""
                    className="h-[32rem] w-full border-0 bg-white"
                  />

                  <details className="border-t border-mineral-dark">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-medium">
                      Version texte — celle que voient les clients de messagerie sans HTML
                    </summary>
                    <pre className="overflow-x-auto whitespace-pre-wrap border-t border-mineral-dark bg-mineral p-4 text-xs leading-relaxed">
                      {c.texte}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
