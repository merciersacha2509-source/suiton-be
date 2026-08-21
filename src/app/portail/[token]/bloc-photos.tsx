import Image from 'next/image';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

const LIBELLES_PHASE: Record<string, string> = {
  avant: 'Avant',
  apres: 'Après',
  contexte: 'Contexte',
  incident: 'Point signalé',
};

export function BlocPhotos({
  photos,
}: {
  photos: { id: string; url: string | null; phase: string; legende: string | null }[];
}) {
  if (photos.length === 0) return null;

  const avant = photos.filter((p) => p.phase === 'avant');
  const apres = photos.filter((p) => p.phase === 'apres');
  const autres = photos.filter((p) => p.phase !== 'avant' && p.phase !== 'apres');

  return (
    <Card>
      <CardHeader
        titre="Photos"
        description={
          apres.length > 0
            ? 'Avant et après votre chantier'
            : 'Les photos que vous nous avez transmises'
        }
      />
      <CardBody className="flex flex-col gap-4">
        {[
          { titre: 'Avant', liste: avant },
          { titre: 'Après', liste: apres },
          { titre: 'Contexte', liste: autres },
        ]
          .filter((g) => g.liste.length > 0)
          .map((groupe) => (
            <div key={groupe.titre}>
              {avant.length > 0 && apres.length > 0 ? (
                <p className="mb-2 text-[0.8125rem] font-medium">{groupe.titre}</p>
              ) : null}
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {groupe.liste.map((photo) => (
                  <li
                    key={photo.id}
                    className="rounded-suiton border-mineral-dark bg-mineral aspect-square overflow-hidden border"
                  >
                    {photo.url ? (
                      <Image
                        src={photo.url}
                        alt={photo.legende ?? LIBELLES_PHASE[photo.phase] ?? ''}
                        width={300}
                        height={300}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </CardBody>
    </Card>
  );
}
