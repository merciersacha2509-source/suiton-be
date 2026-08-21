'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COULEURS as C } from '@/lib/pdf/tokens';
import { formatDuration } from '@/lib/format';

export interface DonneeEtape {
  ordre: number;
  libelle: string;
  mediane: number;
  p90: number;
  observations: number;
}

/**
 * Ou part le temps.
 *
 * Mediane ET p90 sur la meme barre : la mediane dit le cas courant, le p90
 * dit ce qui derape. Afficher la seule moyenne masquerait precisement les
 * etapes qui explosent de temps en temps — celles qu'il faut corriger.
 */
export function GraphiqueEtapes({ donnees }: { donnees: DonneeEtape[] }) {
  const maximum = Math.max(...donnees.map((d) => d.p90), 10);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, donnees.length * 46)}>
      <BarChart
        data={donnees}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke={C.mineralSombre} strokeDasharray="2 4" />
        <XAxis
          type="number"
          domain={[0, Math.ceil(maximum / 30) * 30]}
          tickFormatter={(v: number) => `${Math.round(v / 60)} h`}
          tick={{ fontSize: 11, fill: C.ardoise }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="libelle"
          width={148}
          tick={{ fontSize: 11, fill: C.abysse }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: C.mineral }}
          contentStyle={{
            border: `1px solid ${C.mineralSombre}`,
            borderRadius: 8,
            fontSize: 12,
            padding: '8px 10px',
          }}
          formatter={(valeur: number, nom: string) => [
            formatDuration(valeur),
            nom === 'p90' ? '9 chantiers sur 10 sous' : 'Médiane',
          ]}
          labelFormatter={(l: string) => l}
        />
        {/* Le p90 est dessine EN PREMIER, donc en arriere-plan : la mediane se
            superpose dessus et la comparaison se lit d'un coup d'oeil. */}
        <Bar
          dataKey="p90"
          fill={C.mineralSombre}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="mediane"
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
          // Superposition : la barre médiane occupe la même piste que le p90.
          stackId={undefined}
          barSize={14}
        >
          {donnees.map((d) => (
            <Cell key={d.ordre} fill={C.aquaDeep} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
