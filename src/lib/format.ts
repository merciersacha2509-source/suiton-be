const EUR = new Intl.NumberFormat('fr-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat('fr-BE');

const DATE = new Intl.DateTimeFormat('fr-BE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const DATETIME = new Intl.DateTimeFormat('fr-BE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEUR(value: number): string {
  return EUR.format(value);
}

/** Fourchette d'estimation. Une valeur unique donnerait une fausse precision. */
export function formatRange(min: number, max: number): string {
  if (min === max) return formatEUR(min);
  return `${NUM.format(min)} – ${EUR.format(max)}`;
}

export function formatSurface(m2: number): string {
  return `${NUM.format(m2)} m²`;
}

export function formatDate(value: string | Date): string {
  return DATE.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDateTime(value: string | Date): string {
  return DATETIME.format(typeof value === 'string' ? new Date(value) : value);
}

/** Duree en minutes -> « 5 h 47 ». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Slug sans diacritiques.
 * Les sequences d'echappement sont deliberees : un caractere combinant
 * litteral dans le source se corrompt au premier copier-coller.
 */
export function slugify(input: string): string {
  return (
    input
      // Les exposants ne se decomposent pas en NFD : sans cette etape,
      // « Villa 240 m² » produit le slug « villa-240-m ». Ces slugs partent
      // dans les URL publiques des realisations.
      .replace(new RegExp('\u00b2', 'g'), '2')
      .replace(new RegExp('\u00b3', 'g'), '3')
      .normalize('NFD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .toLowerCase()
      .replace(new RegExp('[^a-z0-9]+', 'g'), '-')
      .replace(new RegExp('(^-|-$)', 'g'), '')
  );
}
