import Image from 'next/image';
import { Section, TitreSection } from '@/components/site/blocs';
import { CHANTIERS_RECENTS } from '@/lib/site/chantiers-recents';

/**
 * Chantiers recents : grille de cartes avec photo avant et photo apres.
 * Rend `null` tant que `CHANTIERS_RECENTS` est vide.
 */
export function ChantiersRecents() {
  if (CHANTIERS_RECENTS.length === 0) return null;

  return (
    <Section>
      <TitreSection surtitre="Chantiers récents" titre="Avant et après" />
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CHANTIERS_RECENTS.map((c) => (
          <li
            key={c.id}
            className="rounded-suiton border-mineral-dark flex flex-col overflow-hidden border bg-white shadow-sm"
          >
            <div className="grid grid-cols-2 gap-px bg-white">
              {[
                { legende: 'Avant', photo: c.avant },
                { legende: 'Après', photo: c.apres },
              ].map(({ legende, photo }) => (
                <figure key={legende} className="relative aspect-[4/3]">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(min-width: 1024px) 192px, (min-width: 640px) 25vw, 45vw"
                    className="object-cover"
                  />
                  <figcaption className="bg-abysse/80 text-mineral absolute bottom-0 left-0 px-2 py-1 text-[0.6875rem] font-medium tracking-wide uppercase">
                    {legende}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-aqua-deep text-xs font-medium tracking-[0.1em] uppercase">
                {c.prestation} · {c.commune}
              </p>
              <p className="text-ardoise mt-2 text-sm leading-relaxed">{c.phrase}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
