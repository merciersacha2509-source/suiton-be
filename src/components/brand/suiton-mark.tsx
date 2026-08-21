interface SuitonMarkProps {
  size?: number;
  className?: string;
  /** Variante sombre : symbole clair sur fond abysse. */
  inverse?: boolean;
  title?: string;
}

/**
 * Symbole SUITON.
 *
 * Cinq anneaux concentriques traverses par une ligne horizontale. Les anneaux
 * s'interrompent dans une bande constante de part et d'autre de la ligne —
 * ce n'est pas un angle mais une hauteur fixe, ce qui fait que l'ouverture
 * parait plus large sur les petits anneaux. Le masque reproduit exactement
 * ce comportement.
 */
export function SuitonMark({ size = 32, className, inverse = false, title }: SuitonMarkProps) {
  const trait = inverse ? '#F4F6F5' : '#0B2239';
  const point = inverse ? '#5FC2CE' : '#1E6E78';
  const uid = inverse ? 'suiton-mark-inv' : 'suiton-mark';

  return (
    <svg
      viewBox="0 0 1200 1200"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <mask id={`${uid}-reserve`}>
          <rect x="0" y="0" width="1200" height="1200" fill="white" />
          <rect x="0" y="576" width="1200" height="47" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${uid}-reserve)`} fill="none" stroke={trait} strokeLinecap="butt">
        <circle cx="600" cy="600" r="142" strokeWidth="10" />
        <circle cx="600" cy="600" r="246" strokeWidth="9" />
        <circle cx="600" cy="600" r="333" strokeWidth="7" />
        <circle cx="600" cy="600" r="394" strokeWidth="6" />
        <circle cx="600" cy="600" r="429" strokeWidth="5" />
      </g>

      <path d="M17 600H1183" stroke={trait} strokeWidth="6" />
      <circle cx="600" cy="600" r="36" fill={point} />
    </svg>
  );
}

/** Logo complet : symbole + mot-marque. */
export function SuitonLogo({
  inverse = false,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <SuitonMark size={28} inverse={inverse} title="SUITON" />
      <span
        className="font-heading text-[1.0625rem] font-semibold tracking-[0.22em]"
        style={{ color: inverse ? '#F4F6F5' : '#0B2239' }}
      >
        SUITON
      </span>
    </span>
  );
}
