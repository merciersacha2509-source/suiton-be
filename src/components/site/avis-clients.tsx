import { Section, TitreSection } from '@/components/site/blocs';
import { AVIS } from '@/lib/site/avis';

/** Avis clients. Rend `null` tant que `AVIS` est vide. */
export function AvisClients() {
  if (AVIS.length === 0) return null;

  return (
    <Section fond="mineral">
      <TitreSection surtitre="Avis clients" titre="Ce que nos clients en disent" />
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {AVIS.map((a) => (
          <li
            key={a.id}
            className="rounded-suiton border-mineral-dark flex flex-col border bg-white p-6 shadow-sm"
          >
            <blockquote className="flex-1 text-sm leading-relaxed">{a.texte}</blockquote>
            <p className="border-mineral-dark mt-5 border-t pt-4 text-sm">
              <span className="font-medium">{a.auteur}</span>
              <span className="text-ardoise block text-xs">{a.contexte}</span>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
