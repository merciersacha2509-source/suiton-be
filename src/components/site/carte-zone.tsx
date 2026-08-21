import { COMMUNES } from '@/lib/site/communes';
import { ENTREPRISE } from '@/lib/site/entreprise';

/**
 * Carte de la zone d'intervention.
 *
 * Dessinee en SVG a partir des coordonnees reelles des communes, projetees
 * en Mercator. Pas de fond de carte tiers.
 *
 * POURQUOI PAS GOOGLE MAPS. Une iframe Google Maps charge un script tiers,
 * depose des cookies, impose une banniere de consentement, ouvre la CSP et
 * ajoute plusieurs centaines de kilo-octets a la page. Ce que le visiteur
 * cherche ici tient en une question : « venez-vous chez moi ? ». Un plan
 * schematique avec les huit communes situees les unes par rapport aux autres
 * y repond mieux qu'une carte routiere, et coute deux kilo-octets.
 *
 * Un lien vers Google Maps reste disponible pour qui veut l'itineraire.
 */
export function CarteZone() {
  const L = 560;
  const H = 460;
  const MARGE = 56;

  // Mercator : la latitude n'est pas lineaire. A cette echelle l'ecart avec
  // une projection naive serait faible, mais autant placer les points au bon
  // endroit — c'est le meme nombre de lignes.
  const yMerc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

  const lons = COMMUNES.map((c) => c.longitude);
  const ys = COMMUNES.map((c) => yMerc(c.latitude));
  const [lonMin, lonMax] = [Math.min(...lons), Math.max(...lons)];
  const [yMin, yMax] = [Math.min(...ys), Math.max(...ys)];

  const px = (lon: number) =>
    MARGE + ((lon - lonMin) / (lonMax - lonMin || 1)) * (L - 2 * MARGE);
  const py = (lat: number) =>
    H - MARGE - ((yMerc(lat) - yMin) / (yMax - yMin || 1)) * (H - 2 * MARGE);

  const base = COMMUNES.find((c) => c.distanceKm === 0) ?? COMMUNES[0]!;
  const bx = px(base.longitude);
  const by = py(base.latitude);

  // Rayon de 45 km rapporte a l'echelle du dessin, via la distance connue de
  // la commune la plus eloignee.
  const laPlusLoin = [...COMMUNES].sort((a, b) => b.distanceKm - a.distanceKm)[0]!;
  const distPx = Math.hypot(px(laPlusLoin.longitude) - bx, py(laPlusLoin.latitude) - by);
  const rayon =
    laPlusLoin.distanceKm > 0 ? (distPx / laPlusLoin.distanceKm) * ENTREPRISE.rayonKm : 160;

  return (
    <figure className="rounded-suiton border-mineral-dark bg-mineral overflow-hidden border">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Carte des communes desservies par SUITON dans un rayon de ${ENTREPRISE.rayonKm} kilomètres autour d'Enghien`}
      >
        <circle
          cx={bx}
          cy={by}
          r={rayon}
          fill="#5FC2CE"
          fillOpacity="0.10"
          stroke="#5FC2CE"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {COMMUNES.filter((c) => c.distanceKm > 0).map((c) => (
          <line
            key={`l-${c.slug}`}
            x1={bx}
            y1={by}
            x2={px(c.longitude)}
            y2={py(c.latitude)}
            stroke="#94A3B8"
            strokeWidth="0.75"
            strokeDasharray="2 3"
          />
        ))}

        {COMMUNES.map((c) => {
          const x = px(c.longitude);
          const y = py(c.latitude);
          const principale = c.zone === 'principale';
          const aDroite = x < L / 2;
          return (
            <g key={c.slug}>
              <circle
                cx={x}
                cy={y}
                r={principale ? 6 : 4.5}
                fill={principale ? '#0B2239' : '#14415F'}
              />
              {c.distanceKm === 0 ? (
                <circle cx={x} cy={y} r="11" fill="none" stroke="#1E6E78" strokeWidth="1.5" />
              ) : null}
              <text
                x={aDroite ? x + 12 : x - 12}
                y={y + 4}
                textAnchor={aDroite ? 'start' : 'end'}
                fontFamily="Inter, sans-serif"
                fontSize="13"
                fontWeight={principale ? 600 : 400}
                fill="#0B2239"
              >
                {c.nom}
              </text>
              <text
                x={aDroite ? x + 12 : x - 12}
                y={y + 19}
                textAnchor={aDroite ? 'start' : 'end'}
                fontFamily="Inter, sans-serif"
                fontSize="11"
                fill="#64748B"
              >
                {c.distanceKm === 0 ? 'notre base' : `${c.distanceKm} km · ${c.trajet}`}
              </text>
            </g>
          );
        })}

        <text x={MARGE} y={H - 16} fontFamily="Inter, sans-serif" fontSize="11" fill="#64748B">
          Rayon d&apos;intervention : {ENTREPRISE.rayonKm} km autour d&apos;Enghien
        </text>
      </svg>

      <figcaption className="border-mineral-dark text-ardoise flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-3 text-xs">
        <span>
          Point cerclé : notre siège. Points foncés : zone principale, sans frais de
          déplacement.
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${ENTREPRISE.adresse}, ${ENTREPRISE.codePostal} ${ENTREPRISE.commune}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean underline"
        >
          Ouvrir dans Google Maps
        </a>
      </figcaption>
    </figure>
  );
}
