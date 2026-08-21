import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const LIBELLES = {
  devis: 'Devis',
  rapport: 'Rapport d’intervention',
  facture: 'Facture',
} as const;

/**
 * Documents du dossier.
 *
 * Les liens sont signes et expirent en quinze minutes : un client qui
 * transfere ce courriel ne transfere pas un acces permanent a ses documents.
 * Il lui suffit de recharger son dossier pour en obtenir de nouveaux.
 */
export function BlocDocuments({
  documents,
}: {
  documents: {
    type: 'devis' | 'rapport' | 'facture';
    numero: string;
    url: string;
    date: string;
  }[];
}) {
  if (documents.length === 0) return null;

  return (
    <Card>
      <CardHeader titre="Vos documents" description="Téléchargeables à tout moment" />
      <CardBody className="flex flex-col gap-1">
        {documents.map((d) => (
          <a
            key={`${d.type}-${d.numero}`}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-touch border-mineral-dark flex items-center justify-between gap-3 border-b py-2 last:border-0 hover:opacity-80"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{LIBELLES[d.type]}</span>
              <span className="tabular text-ardoise block text-[0.8125rem]">
                {d.numero} · {formatDate(d.date)}
              </span>
            </span>
            <span className="text-ocean shrink-0 text-[0.8125rem] font-medium">PDF</span>
          </a>
        ))}
      </CardBody>
    </Card>
  );
}
