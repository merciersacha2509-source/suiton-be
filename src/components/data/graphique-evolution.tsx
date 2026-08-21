'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COULEURS as C } from '@/lib/pdf/tokens';

export interface PointEvolution {
  periode: string;
  chantiers: number;
  cadence: number | null;
  caHoraire: number | null;
  panier: number | null;
}

const TRIMESTRE = (iso: string) => {
  const d = new Date(iso);
  return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
};

/**
 * Evolution trimestrielle.
 *
 * Par trimestre et non par mois : a trois chantiers par mois, une courbe
 * mensuelle ne montre que du bruit et invite a sur-interpreter.
 */
export function GraphiqueEvolution({
  donnees,
  serie,
}: {
  donnees: PointEvolution[];
  serie: 'cadence' | 'caHoraire' | 'panier';
}) {
  const libelles = {
    cadence: 'Cadence (min/m²)',
    caHoraire: 'CA horaire (€)',
    panier: 'Panier médian (€)',
  } as const;

  const data = donnees.map((d) => ({ ...d, label: TRIMESTRE(d.periode) }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke={C.mineralSombre} strokeDasharray="2 4" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: C.ardoise }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: C.ardoise }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            border: `1px solid ${C.mineralSombre}`,
            borderRadius: 8,
            fontSize: 12,
            padding: '8px 10px',
          }}
          formatter={(v: number) => [v.toLocaleString('fr-BE'), libelles[serie]]}
        />
        <Line
          type="monotone"
          dataKey={serie}
          stroke={C.aquaDeep}
          strokeWidth={2}
          dot={{ r: 3, fill: C.aquaDeep }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
