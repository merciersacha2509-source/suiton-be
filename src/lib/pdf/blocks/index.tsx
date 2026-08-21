import { Circle, G, Image, Path, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { ReactNode } from 'react';
import { S } from '@/lib/pdf/blocks/styles';
import { COULEURS as C, DOCUMENTS, type TypeDocument } from '@/lib/pdf/tokens';

/**
 * Bibliotheque de blocs.
 *
 * Chaque document SUITON est un assemblage de ces blocs, dans un ordre qui
 * lui est propre. C'est ce qui garantit qu'ils forment une collection : un
 * en-tete corrige ici l'est sur les sept documents, sans exception oubliee.
 */

/* ==========================================================================
 * Marque
 * ======================================================================== */

const RESERVE = 23.5;

function anneau(r: number, w: number, couleur: string) {
  // Les anneaux s'interrompent dans une bande de hauteur CONSTANTE de part
  // et d'autre de la ligne — pas selon un angle, ce qui fait que
  // l'ouverture parait plus large sur les petits anneaux. @react-pdf ne
  // gerant pas les masques SVG, on dessine deux arcs.
  const dx = Math.sqrt(Math.max(r * r - RESERVE * RESERVE, 0));
  return (
    <G key={r}>
      <Path
        d={`M ${600 - dx} ${600 - RESERVE} A ${r} ${r} 0 0 1 ${600 + dx} ${600 - RESERVE}`}
        stroke={couleur}
        strokeWidth={w}
        fill="none"
      />
      <Path
        d={`M ${600 - dx} ${600 + RESERVE} A ${r} ${r} 0 0 0 ${600 + dx} ${600 + RESERVE}`}
        stroke={couleur}
        strokeWidth={w}
        fill="none"
      />
    </G>
  );
}

export function Marque({
  taille = 27,
  couleur = C.abysse,
}: {
  taille?: number;
  couleur?: string;
}) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 1200 1200">
      {anneau(142, 10, couleur)}
      {anneau(246, 9, couleur)}
      {anneau(333, 7, couleur)}
      {anneau(394, 6, couleur)}
      {anneau(429, 5, couleur)}
      <Path d="M17 600 H1183" stroke={couleur} strokeWidth={6} />
      <Circle cx={600} cy={600} r={36} fill={C.aquaDeep} />
    </Svg>
  );
}

/** Coche. « ✓ » n'existe pas dans l'encodage des polices embarquees. */
export function Coche({
  taille = 9,
  couleur = C.aquaDeep,
}: {
  taille?: number;
  couleur?: string;
}) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 12 12">
      <Path
        d="M2 6.4 L4.6 9 L10 3"
        stroke={couleur}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Case a cocher vide, pour les documents remplis a la main sur le chantier. */
export function Case({ taille = 10 }: { taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 12 12">
      <Path d="M1 1 H11 V11 H1 Z" stroke={C.ardoiseClair} strokeWidth={1} fill="none" />
    </Svg>
  );
}

/* ==========================================================================
 * En-tete et pied de page
 * ======================================================================== */

export interface Emetteur {
  denomination: string;
  adresse: string;
  codePostal: string;
  commune: string;
  pays: string;
  tva: string;
  peppol: string;
  telephone: string;
  email: string;
  iban: string;
  bic: string;
  titulaire: string;
}

export function BlocEnTete({ emetteur }: { emetteur: Emetteur }) {
  return (
    <>
      <View style={S.enTete}>
        <View style={S.marque}>
          <Marque />
          <Text style={S.motMarque}>SUITON</Text>
        </View>
        <View style={S.emetteur}>
          <Text style={S.emetteurNom}>{emetteur.denomination} — Nettoyage professionnel</Text>
          <Text>
            {emetteur.adresse}, {emetteur.codePostal} {emetteur.commune}, {emetteur.pays}
          </Text>
          <Text>TVA {emetteur.tva}</Text>
          <Text>
            Tél {emetteur.telephone} — {emetteur.email}
          </Text>
        </View>
      </View>
      <View style={S.regle} />
    </>
  );
}

/**
 * Pied de page.
 *
 * `fixed` le repete sur chaque page ; la pagination « 1 / 3 » evite qu'un
 * client se demande s'il lui manque une feuille.
 */
export function BlocPied({
  emetteur,
  type,
  page,
  pages,
}: {
  emetteur: Emetteur;
  type: TypeDocument;
  /** Numero de la page courante. Chaque <Page> appelle ce bloc. */
  page?: number;
  /** Nombre total de pages du document. */
  pages?: number;
}) {
  const meta = DOCUMENTS[type];
  const interne = meta.destinataire !== 'client';

  return (
    <View style={S.pied} fixed>
      <View style={S.piedRangee}>
        <View style={S.piedGauche}>
          <Text style={S.piedTexte}>
            {emetteur.denomination} — {emetteur.adresse}, {emetteur.codePostal}{' '}
            {emetteur.commune}, {emetteur.pays} — TVA {emetteur.tva}
            {!interne && emetteur.iban ? ` — IBAN ${emetteur.iban}` : ''}
          </Text>
          <Text style={S.piedType}>{meta.pied}</Text>
        </View>

        {page && pages ? (
          <Text style={S.piedPagination}>
            {page} / {pages}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function BlocTitre({
  titre,
  meta,
}: {
  titre: string;
  meta: (string | null | undefined)[];
}) {
  const parties = meta.filter(Boolean);
  return (
    <>
      <Text style={S.titre}>{titre}</Text>
      {parties.length > 0 ? <Text style={S.meta}>{parties.join('  |  ')}</Text> : null}
    </>
  );
}

/* ==========================================================================
 * Blocs d'information
 * ======================================================================== */

export interface Partie {
  nom: string;
  adresse?: string;
  codePostal?: string;
  commune?: string;
  tva?: string;
  telephone?: string;
  email?: string;
}

export function BlocPartie({
  etiquette,
  partie,
  extras = [],
}: {
  etiquette: string;
  partie: Partie;
  extras?: (string | null | undefined)[];
}) {
  return (
    <View style={S.colonne}>
      <Text style={S.etiquette}>{etiquette}</Text>
      <Text style={S.ligneFort}>{partie.nom}</Text>
      {partie.adresse ? <Text style={S.ligne}>{partie.adresse}</Text> : null}
      {partie.commune ? (
        <Text style={S.ligne}>
          {partie.codePostal} {partie.commune}
        </Text>
      ) : null}
      {partie.telephone ? <Text style={S.ligne}>{partie.telephone}</Text> : null}
      {partie.tva ? <Text style={S.ligne}>TVA : {partie.tva}</Text> : null}
      {extras.filter(Boolean).map((e) => (
        <Text key={e as string} style={S.ligne}>
          {e}
        </Text>
      ))}
    </View>
  );
}

/** Deux colonnes d'information. Le format le plus lu d'un document commercial. */
export function BlocColonnes({ children }: { children: ReactNode }) {
  return <View style={S.colonnes}>{children}</View>;
}

export function BlocSection({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <>
      <Text style={S.sectionTitre}>{titre}</Text>
      {children}
    </>
  );
}

/* ==========================================================================
 * Tableau
 * ======================================================================== */

export interface Colonne {
  cle: string;
  entete: string;
  largeur?: number;
  alignement?: 'left' | 'center' | 'right';
}

export interface Rangee {
  [cle: string]: string | undefined;
  /** Ligne secondaire, grisee, sous la premiere cellule. */
  _detail?: string;
}

export function BlocTableau({
  colonnes,
  rangees,
  repeterEntete = false,
}: {
  colonnes: Colonne[];
  rangees: Rangee[];
  /** Utile au-dela d'une page. Inutile — et trompeur — en deca. */
  repeterEntete?: boolean;
}) {
  const style = (c: Colonne) =>
    c.largeur
      ? { width: c.largeur, textAlign: c.alignement ?? ('left' as const) }
      : { flex: 1, paddingRight: 8, textAlign: c.alignement ?? ('left' as const) };

  return (
    <>
      <View style={S.thead} fixed={repeterEntete}>
        {colonnes.map((c) => (
          <Text key={c.cle} style={[S.th, style(c)]}>
            {c.entete}
          </Text>
        ))}
      </View>

      {rangees.map((r, i) => (
        <View key={i} style={[S.tr, ...(i % 2 === 1 ? [S.trAlt] : [])]} wrap={false}>
          {colonnes.map((c, j) => {
            const valeur = r[c.cle] ?? '';
            if (j === 0 && r._detail) {
              return (
                <View key={c.cle} style={style(c)}>
                  <Text>{valeur}</Text>
                  <Text style={S.detail}>{r._detail}</Text>
                </View>
              );
            }
            return (
              <Text key={c.cle} style={style(c)}>
                {valeur}
              </Text>
            );
          })}
        </View>
      ))}
    </>
  );
}

/* ==========================================================================
 * Totaux, encadres, puces
 * ======================================================================== */

export function BlocTotaux({
  sousTotal,
  tvaLibelle,
  tvaMontant,
  total,
}: {
  sousTotal: string;
  tvaLibelle: string;
  tvaMontant: string;
  total: string;
}) {
  return (
    <View style={S.totaux} wrap={false}>
      <View style={S.ligneTotal}>
        <Text style={S.totalLibelle}>Sous-total HTVA</Text>
        <Text style={S.totalValeur}>{sousTotal}</Text>
      </View>
      <View style={S.ligneTotal}>
        <Text style={S.totalLibelle}>{tvaLibelle}</Text>
        <Text style={S.totalValeur}>{tvaMontant}</Text>
      </View>
      <View style={S.ligneTotalFort}>
        <Text style={S.totalFortLibelle}>TOTAL TTC</Text>
        <Text style={S.totalFortValeur}>{total}</Text>
      </View>
    </View>
  );
}

type TonEncadre = 'preuve' | 'legal' | 'neutre' | 'succes';

const TONS: Record<TonEncadre, Style> = {
  preuve: S.encadrePreuve,
  legal: S.encadreLegal,
  neutre: S.encadreNeutre,
  succes: S.encadreSucces,
};

const COULEURS_TITRE: Record<TonEncadre, string> = {
  preuve: C.abysse,
  legal: C.ambre,
  neutre: C.abysse,
  succes: C.succes,
};

export function BlocEncadre({
  ton = 'neutre',
  titre,
  children,
  style,
}: {
  ton?: TonEncadre;
  titre?: string;
  children: ReactNode;
  style?: Style;
}) {
  return (
    <View style={[S.encadre, TONS[ton], ...(style ? [style] : [])]} wrap={false}>
      {titre ? (
        <Text style={[S.encadreTitre, { color: COULEURS_TITRE[ton] }]}>{titre}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function Puce({ children }: { children: ReactNode }) {
  return (
    <View style={S.puce}>
      <Text style={S.puceTiret}>–</Text>
      <Text style={S.puceTexte}>{children}</Text>
    </View>
  );
}

/**
 * Puces sur deux colonnes, equilibrees par LONGUEUR.
 *
 * Repartir par nombre d'items mettrait une mention de quatre lignes et une
 * d'une ligne dans la meme colonne : le bloc deborderait sur la page
 * suivante et emporterait le bloc signature avec lui.
 */
export function BlocPucesColonnes({
  items,
  compact = false,
}: {
  items: string[];
  compact?: boolean;
}) {
  const gauche: string[] = [];
  const droite: string[] = [];
  let pg = 0;
  let pd = 0;

  for (const item of items) {
    if (pg <= pd) {
      gauche.push(item);
      pg += item.length;
    } else {
      droite.push(item);
      pd += item.length;
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: 18 }}>
      {[gauche, droite].map((col, i) => (
        <View key={i} style={{ flex: 1 }}>
          {col.map((c) => (
            <View key={c} style={S.puce}>
              <Text style={S.puceTiret}>–</Text>
              <Text
                style={[S.puceTexte, ...(compact ? [{ fontSize: 7.3, lineHeight: 1.4 }] : [])]}
              >
                {c}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ==========================================================================
 * Chiffres cles
 * ======================================================================== */

export function BlocChiffres({ blocs }: { blocs: { libelle: string; valeur: string }[] }) {
  return (
    <View style={S.chiffres} wrap={false}>
      {blocs.map((b) => (
        <View key={b.libelle} style={S.chiffreBloc}>
          <Text style={S.chiffreLibelle}>{b.libelle.toUpperCase()}</Text>
          <Text style={S.chiffreValeur}>{b.valeur}</Text>
        </View>
      ))}
    </View>
  );
}

/* ==========================================================================
 * Photos
 * ======================================================================== */

export interface PaireAvantApres {
  numero: number;
  piece: string;
  avant: string | null;
  apres: string | null;
  legende?: string;
}

/**
 * Comparaison avant/apres.
 *
 * C'est la comparaison, pas la photo isolee, qui prouve le resultat : une
 * photo « apres » seule ne dit rien de l'etat initial.
 */
export function BlocPaires({
  paires,
  hauteur = 148,
}: {
  paires: PaireAvantApres[];
  hauteur?: number;
}) {
  return (
    <>
      {paires.map((paire) => (
        <View key={paire.numero} style={{ marginBottom: 14 }} wrap={false}>
          <Text style={[S.etiquette, { marginBottom: 5 }]}>
            {paire.numero}. {paire.piece.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { titre: 'AVANT', src: paire.avant, accent: false },
              { titre: 'APRÈS', src: paire.apres, accent: true },
            ].map((cote) => (
              <View key={cote.titre} style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 6.8,
                    fontWeight: 600,
                    color: cote.accent ? C.aquaDeep : C.ardoise,
                    letterSpacing: 1,
                    marginBottom: 3,
                  }}
                >
                  {cote.titre}
                </Text>
                {cote.src ? (
                  <Image
                    src={cote.src}
                    style={{ width: '100%', height: hauteur, objectFit: 'cover' }}
                  />
                ) : (
                  <View
                    style={{
                      height: hauteur,
                      backgroundColor: C.mineral,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 7.6, color: C.ardoiseClair }}>
                      Photo non disponible
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          {paire.legende ? <Text style={S.note}>{paire.legende}</Text> : null}
        </View>
      ))}
    </>
  );
}

/* ==========================================================================
 * Signatures
 * ======================================================================== */

export function BlocSignatures({
  blocs,
}: {
  blocs: { etiquette: string; legende: string; mention?: string }[];
}) {
  return (
    <View style={S.signatures} wrap={false}>
      {blocs.map((b) => (
        <View key={b.etiquette} style={S.signatureBloc}>
          <Text style={S.etiquette}>{b.etiquette}</Text>
          <View style={S.signatureLigne} />
          <Text style={S.signatureLegende}>{b.legende}</Text>
          {b.mention ? <Text style={S.signatureLegende}>{b.mention}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export { S };
