import { cn } from '@/lib/cn';
import { formatEUR } from '@/lib/format';
import type { NiveauConfiance } from '@/types/database';

export interface CelluleMatrice {
  ligne: string;
  colonne: string;
  valeur: number | null;
  n: number;
  confiance: NiveauConfiance;
}

/**
 * Matrice de rentabilite.
 *
 * L'intensite de fond encode le CA horaire relatif, ce qui fait ressortir les
 * segments d'un coup d'oeil. Les cellules sous cinq observations restent
 * GRISES quelle que soit leur valeur : une couleur forte sur deux chantiers
 * dirigerait le regard vers du bruit.
 */
export function Matrice({
  cellules,
  lignes,
  colonnes,
  libelleLigne,
  libelleColonne,
}: {
  cellules: CelluleMatrice[];
  lignes: { cle: string; libelle: string }[];
  colonnes: { cle: string; libelle: string }[];
  libelleLigne: string;
  libelleColonne: string;
}) {
  const fiables = cellules.filter((c) => c.n >= 5 && c.valeur !== null);
  const min = fiables.length > 0 ? Math.min(...fiables.map((c) => c.valeur as number)) : 0;
  const max = fiables.length > 0 ? Math.max(...fiables.map((c) => c.valeur as number)) : 1;

  const intensite = (c: CelluleMatrice): number => {
    if (c.valeur === null || c.n < 5 || max === min) return 0;
    return (c.valeur - min) / (max - min);
  };

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0" tabIndex={0} role="region">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="text-ardoise px-3 py-2 text-left text-[0.6875rem] font-semibold tracking-wide uppercase"
            >
              {libelleLigne} \ {libelleColonne}
            </th>
            {colonnes.map((c) => (
              <th
                key={c.cle}
                scope="col"
                className="text-ardoise px-3 py-2 text-center text-[0.6875rem] font-semibold tracking-wide uppercase"
              >
                {c.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle}>
              <th
                scope="row"
                className="px-3 py-2 text-left text-[0.8125rem] font-medium whitespace-nowrap"
              >
                {l.libelle}
              </th>
              {colonnes.map((col) => {
                const cellule = cellules.find(
                  (x) => x.ligne === l.cle && x.colonne === col.cle,
                );

                if (!cellule || cellule.valeur === null) {
                  return (
                    <td key={col.cle} className="p-1">
                      <div className="rounded-suiton border-mineral-dark flex h-14 items-center justify-center border border-dashed">
                        <span className="text-ardoise-clair text-[0.75rem]">—</span>
                      </div>
                    </td>
                  );
                }

                const fiable = cellule.n >= 5;
                const i = intensite(cellule);

                return (
                  <td key={col.cle} className="p-1">
                    <div
                      className={cn(
                        'rounded-suiton flex h-14 flex-col items-center justify-center border',
                        fiable ? 'border-transparent' : 'border-mineral-dark bg-mineral',
                      )}
                      style={
                        fiable
                          ? { backgroundColor: `rgba(30, 110, 120, ${0.1 + i * 0.55})` }
                          : undefined
                      }
                      title={`${cellule.n} chantier${cellule.n > 1 ? 's' : ''}`}
                    >
                      <span
                        className={cn(
                          'tabular text-[0.8125rem] font-semibold',
                          fiable && i > 0.55 ? 'text-white' : 'text-abysse',
                        )}
                      >
                        {formatEUR(cellule.valeur)}
                      </span>
                      <span
                        className={cn(
                          'tabular text-[0.6875rem]',
                          fiable && i > 0.55 ? 'text-white/75' : 'text-ardoise',
                        )}
                      >
                        {cellule.n} chantier{cellule.n > 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-ardoise mt-2 px-3 text-[0.75rem] sm:px-0">
        Chiffre d&apos;affaires horaire médian. Les cellules sous cinq chantiers restent grises
        : une couleur forte sur deux chantiers dirigerait le regard vers du bruit.
      </p>
    </div>
  );
}
