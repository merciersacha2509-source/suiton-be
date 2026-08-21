'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { deposerPhotoAction, supprimerPhotoAction, type TerrainState } from './actions';

export interface PhotoTerrain {
  id: string;
  phase: string;
  piece: string;
  paire: number | null;
  url: string | null;
}

function Envoyer({ phase }: { phase: 'avant' | 'apres' }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={phase === 'apres' ? 'preuve' : 'primary'}
      size="lg"
      block
      disabled={pending}
    >
      {pending ? 'Envoi…' : phase === 'avant' ? 'Photo AVANT' : 'Photo APRÈS'}
    </Button>
  );
}

/**
 * Photos de chantier, appariees.
 *
 * Le principe : une paire = une piece, photographiee avant puis apres, sous
 * le meme numero. C'est ce qui permet au rapport de les afficher cote a cote
 * — et c'est la comparaison, pas la photo isolee, qui prouve le resultat.
 *
 * `capture="environment"` ouvre directement l'appareil arriere : le
 * technicien est sur place, il ne va pas chercher dans sa galerie.
 */
export function PhotosTerrain({
  interventionId,
  jobId,
  photos,
  verrouille,
}: {
  interventionId: string;
  jobId: string;
  photos: PhotoTerrain[];
  verrouille: boolean;
}) {
  const [etat, action] = useActionState<TerrainState, FormData>(deposerPhotoAction, {});
  const [suppression, supprimer] = useActionState<TerrainState, FormData>(
    supprimerPhotoAction,
    {},
  );
  const [piece, setPiece] = useState('Séjour');
  const [paire, setPaire] = useState(1);
  const champAvant = useRef<HTMLInputElement>(null);
  const champApres = useRef<HTMLInputElement>(null);

  const parPaire = new Map<number, PhotoTerrain[]>();
  for (const p of photos) {
    if (p.paire === null) continue;
    const l = parPaire.get(p.paire);
    if (l) l.push(p);
    else parPaire.set(p.paire, [p]);
  }

  const prochaineLibre = (() => {
    let n = 1;
    while (parPaire.has(n) && parPaire.get(n)!.length >= 2) n += 1;
    return n;
  })();

  return (
    <div className="flex flex-col gap-4">
      {etat.error ? <Alert ton="danger">{etat.error}</Alert> : null}
      {suppression.error ? <Alert ton="danger">{suppression.error}</Alert> : null}

      {!verrouille ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <Field label="Pièce">
              {(p) => (
                <Select {...p} value={piece} onChange={(e) => setPiece(e.target.value)}>
                  {[
                    'Séjour',
                    'Cuisine',
                    'Chambre',
                    'Salle de bain',
                    'WC',
                    'Couloir',
                    'Escalier',
                    'Garage',
                    'Extérieur',
                    'Général',
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Paire n°" hint={`Libre : ${prochaineLibre}`}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={40}
                  inputMode="numeric"
                  value={paire}
                  onChange={(e) => setPaire(Number(e.target.value))}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {(['avant', 'apres'] as const).map((phase) => (
              <form key={phase} action={action}>
                <input type="hidden" name="interventionId" value={interventionId} />
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="phase" value={phase} />
                <input type="hidden" name="piece" value={piece} />
                <input type="hidden" name="paire" value={paire} />
                <input
                  ref={phase === 'avant' ? champAvant : champApres}
                  type="file"
                  name="fichier"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                />
                <Button
                  variant={phase === 'apres' ? 'preuve' : 'secondaire'}
                  size="lg"
                  block
                  onClick={() => (phase === 'avant' ? champAvant : champApres).current?.click()}
                >
                  {phase === 'avant' ? 'Photo AVANT' : 'Photo APRÈS'}
                </Button>
                <span className="sr-only">
                  <Envoyer phase={phase} />
                </span>
              </form>
            ))}
          </div>
        </>
      ) : null}

      {parPaire.size === 0 ? (
        <p className="text-ardoise py-4 text-center text-sm">
          Aucune paire. Une comparaison avant/après vaut mieux qu&apos;une longue explication.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {Array.from(parPaire.entries())
            .sort(([a], [b]) => a - b)
            .map(([numero, liste]) => {
              const avant = liste.find((p) => p.phase === 'avant');
              const apres = liste.find((p) => p.phase === 'apres');
              const complete = Boolean(avant && apres);

              return (
                <li key={numero} className="rounded-suiton border-mineral-dark border p-3">
                  <p className="mb-2 flex items-center justify-between text-[0.8125rem] font-medium">
                    <span>
                      {numero}. {liste[0]?.piece}
                    </span>
                    {!complete ? (
                      <span className="text-alerte text-[0.75rem] font-normal">
                        {avant ? 'Il manque l’après' : 'Il manque l’avant'}
                      </span>
                    ) : null}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { titre: 'Avant', photo: avant },
                      { titre: 'Après', photo: apres },
                    ].map((cote) => (
                      <div key={cote.titre}>
                        <p
                          className={cn(
                            'mb-1 text-[0.6875rem] font-medium tracking-wide uppercase',
                            cote.titre === 'Après' ? 'text-aqua-deep' : 'text-ardoise',
                          )}
                        >
                          {cote.titre}
                        </p>
                        <div className="rounded-suiton bg-mineral relative aspect-[4/3] overflow-hidden">
                          {cote.photo?.url ? (
                            <>
                              <Image
                                src={cote.photo.url}
                                alt={`${cote.titre} — ${liste[0]?.piece}`}
                                width={400}
                                height={300}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                              {!verrouille ? (
                                <form action={supprimer} className="absolute top-1 right-1">
                                  <input type="hidden" name="photoId" value={cote.photo.id} />
                                  <input
                                    type="hidden"
                                    name="interventionId"
                                    value={interventionId}
                                  />
                                  <button
                                    type="submit"
                                    className="bg-abysse/85 text-mineral flex h-7 w-7 items-center justify-center rounded-full"
                                  >
                                    <span className="sr-only">Retirer cette photo</span>
                                    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                                      <path
                                        d="M2 2l8 8M10 2l-8 8"
                                        stroke="currentColor"
                                        strokeWidth="1.7"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </button>
                                </form>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-ardoise-clair flex h-full items-center justify-center text-[0.75rem]">
                              À prendre
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
