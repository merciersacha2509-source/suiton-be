import type { Metadata } from 'next';
import { ENTREPRISE } from '@/lib/site/entreprise';
import { siteIndexable } from '@/lib/env';
import { publicEnv } from '@/lib/env';

/**
 * Infrastructure SEO.
 *
 * Un seul endroit produit les metadonnees et les donnees structurees. Sans
 * cela, une page finit avec un title qui ne correspond pas a son H1, un
 * canonique absent, ou un JSON-LD qui decrit autre chose que la page — trois
 * erreurs qui coutent des positions et qu'on ne voit jamais a l'oeil.
 */

export const SITE_URL = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

export const url = (chemin = '') =>
  `${SITE_URL}${chemin.startsWith('/') ? chemin : `/${chemin}`}`;

export interface EntreesMeta {
  title: string;
  description: string;
  chemin: string;
  /** Empeche l'indexation. Reserve aux pages transactionnelles. */
  noindex?: boolean;
  /** Image Open Graph. Par defaut, l'image de marque. */
  image?: string;
}

export function metadonnees(e: EntreesMeta): Metadata {
  const canonique = url(e.chemin);
  const image = e.image ?? url('/og.png');

  return {
    /*
     * `absolute` desactive le gabarit « %s · SUITON » du layout racine.
     * Les titres du site sont rediges entiers, marque comprise quand elle
     * apporte quelque chose : laisser le gabarit s'appliquer produisait
     * « … — SUITON · SUITON » sur les pages de service.
     */
    title: { absolute: e.title },
    description: e.description,
    alternates: { canonical: canonique },
    /*
     * Deux conditions doivent etre reunies pour qu'une page soit indexable :
     * qu'elle le soit par nature, ET que l'environnement soit la production.
     *
     * Une preview indexee est un doublon integral de suiton.be dans l'index
     * de Google : deux domaines, le meme contenu, une cannibalisation qu'on
     * met des mois a defaire. Le risque n'est pas theorique — une URL de
     * preview partagee dans un message suffit a la faire decouvrir.
     */
    robots:
      e.noindex || !siteIndexable()
        ? { index: false, follow: false, nocache: true }
        : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      type: 'website',
      locale: 'fr_BE',
      url: canonique,
      siteName: ENTREPRISE.nom,
      title: e.title,
      description: e.description,
      images: [{ url: image, width: 1200, height: 630, alt: ENTREPRISE.nom }],
    },
    twitter: {
      card: 'summary_large_image',
      title: e.title,
      description: e.description,
      images: [image],
    },
  };
}

/* ==========================================================================
 * Données structurées
 * ==========================================================================
 * Chaque page en porte au moins deux : l'entreprise et le fil d'Ariane. Les
 * pages de service ajoutent Service, les pages a FAQ ajoutent FAQPage.
 * ======================================================================== */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Jsonld = Record<string, any>;

/**
 * LocalBusiness.
 *
 * `areaServed` liste les communes une par une plutot qu'un rayon seul :
 * Google associe alors explicitement l'entreprise a chaque localite, ce qui
 * est precisement ce qu'on cherche en referencement local.
 */
export function jsonldEntreprise(communes: { nom: string }[]): Jsonld {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url('/#entreprise'),
    name: ENTREPRISE.nom,
    description: `${ENTREPRISE.activite} en Belgique. ${ENTREPRISE.slogan}`,
    url: url('/'),
    telephone: ENTREPRISE.telephoneE164,
    email: ENTREPRISE.email,
    vatID: ENTREPRISE.tva,
    foundingDate: ENTREPRISE.fondation,
    priceRange: '€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: ENTREPRISE.adresse,
      postalCode: ENTREPRISE.codePostal,
      addressLocality: ENTREPRISE.commune,
      addressRegion: ENTREPRISE.region,
      addressCountry: ENTREPRISE.pays,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: ENTREPRISE.latitude,
      longitude: ENTREPRISE.longitude,
    },
    areaServed: communes.map((c) => ({ '@type': 'City', name: c.nom })),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '17:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '08:00',
        closes: '13:00',
      },
    ],
  };
}

export function jsonldService(s: {
  nom: string;
  description: string;
  chemin: string;
  prixDepuis: number;
  communes: { nom: string }[];
}): Jsonld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.nom,
    description: s.description,
    url: url(s.chemin),
    serviceType: s.nom,
    provider: { '@id': url('/#entreprise') },
    areaServed: s.communes.map((c) => ({ '@type': 'City', name: c.nom })),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: s.prixDepuis,
      // Le prix est un point de depart au m², pas un prix de prestation.
      // `priceSpecification` le dit explicitement plutot que de laisser
      // croire a un forfait.
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: s.prixDepuis,
        priceCurrency: 'EUR',
        unitText: 'm²',
        valueAddedTaxIncluded: false,
      },
      availability: 'https://schema.org/InStock',
    },
  };
}

export function jsonldFaq(faq: { question: string; reponse: string }[]): Jsonld {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.reponse },
    })),
  };
}

export function jsonldFilAriane(items: { nom: string; chemin: string }[]): Jsonld {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nom,
      item: url(item.chemin),
    })),
  };
}

/**
 * Injecte le JSON-LD.
 *
 * `dangerouslySetInnerHTML` est ici la methode recommandee par Next.js pour
 * les donnees structurees. Le contenu vient de nos propres constantes, jamais
 * d'une saisie utilisateur.
 */
export function Jsonld({ donnees }: { donnees: Jsonld | Jsonld[] }) {
  const contenu = Array.isArray(donnees) ? donnees : [donnees];
  return (
    <>
      {contenu.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
}
