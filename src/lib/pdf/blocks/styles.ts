import { StyleSheet } from '@react-pdf/renderer';
import { COULEURS as C, ESPACES, POLICES, TAILLES as T } from '@/lib/pdf/tokens';

/**
 * Feuille de style commune aux sept documents.
 *
 * Elle est volontairement unique : deux feuilles finiraient par diverger, et
 * un devis dont l'en-tete ne ressemble pas a celui de la facture donne
 * l'impression de deux fournisseurs differents.
 */
export const S = StyleSheet.create({
  page: {
    paddingTop: ESPACES.page.haut,
    paddingBottom: ESPACES.page.bas,
    paddingHorizontal: ESPACES.page.cotes,
    fontSize: T.moyen - 0.4,
    lineHeight: 1.45,
    color: C.abysse,
    fontFamily: POLICES.texte,
  },

  /* --- En-tete --------------------------------------------------------- */
  enTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
  },
  regle: { borderBottomWidth: 1.4, borderBottomColor: C.abysse, marginBottom: 16 },
  regleFine: { borderBottomWidth: 0.6, borderBottomColor: C.mineralSombre, marginBottom: 10 },
  marque: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  motMarque: { fontFamily: POLICES.titre, fontSize: 14, fontWeight: 600, letterSpacing: 3.4 },
  emetteur: { textAlign: 'right', fontSize: T.petit, color: C.ardoise, lineHeight: 1.55 },
  emetteurNom: { fontSize: T.petit, fontWeight: 600, color: C.abysse },

  /* --- Titres ---------------------------------------------------------- */
  titre: {
    fontFamily: POLICES.titre,
    fontSize: T.titreDocument,
    lineHeight: 1.2,
    fontWeight: 600,
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  meta: { fontSize: T.base, color: C.aquaDeep, marginBottom: 12 },
  sectionTitre: {
    fontFamily: POLICES.titre,
    fontSize: T.titreSection,
    fontWeight: 600,
    marginTop: 4,
    marginBottom: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: C.mineralSombre,
    paddingBottom: 3,
  },

  /* --- Colonnes -------------------------------------------------------- */
  colonnes: { flexDirection: 'row', gap: 22, marginBottom: 10 },
  colonne: { flex: 1 },
  etiquette: {
    fontSize: T.etiquette,
    fontWeight: 600,
    color: C.aquaDeep,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  ligne: { fontSize: T.base, marginBottom: 1 },
  ligneFort: { fontSize: T.base, fontWeight: 600, marginBottom: 1 },

  /* --- Tableau --------------------------------------------------------- */
  thead: {
    flexDirection: 'row',
    backgroundColor: C.abysse,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: { color: C.mineral, fontSize: T.etiquette, fontWeight: 600, letterSpacing: 0.7 },
  tr: {
    flexDirection: 'row',
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  trAlt: { backgroundColor: C.mineral },
  detail: { fontSize: T.micro + 0.8, color: C.ardoise, marginTop: 1 },

  /* --- Totaux ---------------------------------------------------------- */
  totaux: { width: 258 },
  ligneTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.mineral,
    paddingVertical: 5.5,
    paddingHorizontal: 10,
    marginBottom: 1.5,
  },
  totalLibelle: { fontSize: T.base, fontWeight: 600 },
  totalValeur: { fontSize: T.moyen, fontWeight: 600 },
  ligneTotalFort: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.abysse,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  totalFortLibelle: { fontSize: T.base, fontWeight: 600, color: C.mineral, letterSpacing: 0.5 },
  totalFortValeur: {
    fontFamily: POLICES.titre,
    fontSize: T.chiffre,
    fontWeight: 600,
    color: C.mineral,
    textAlign: 'right',
  },

  /* --- Encadres -------------------------------------------------------- */
  note: { fontSize: T.petit - 0.4, color: C.ardoise, marginTop: 6, lineHeight: 1.45 },
  encadre: { padding: 8, marginTop: 7 },
  encadrePreuve: {
    borderLeftWidth: 2.5,
    borderLeftColor: C.aquaDeep,
    backgroundColor: C.aquaWash,
  },
  encadreLegal: { borderWidth: 0.8, borderColor: C.ambre, backgroundColor: C.ambreWash },
  encadreNeutre: { backgroundColor: C.mineral },
  encadreSucces: {
    borderLeftWidth: 2.5,
    borderLeftColor: C.succes,
    backgroundColor: C.succesWash,
  },
  encadreTitre: { fontSize: T.petit, fontWeight: 600, letterSpacing: 0.7, marginBottom: 4 },
  encadreTexte: { fontSize: T.petit, lineHeight: 1.55 },

  /* --- Puces ----------------------------------------------------------- */
  puce: { flexDirection: 'row', marginBottom: 2.5 },
  puceTiret: { width: 11, color: C.aquaDeep, fontWeight: 600 },
  puceTexte: { flex: 1, fontSize: T.base - 0.6, lineHeight: 1.45 },

  /* --- Chiffres cles --------------------------------------------------- */
  chiffres: { flexDirection: 'row', gap: 1.5 },
  chiffreBloc: {
    flex: 1,
    backgroundColor: C.mineral,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chiffreLibelle: { fontSize: T.micro, color: C.ardoise, letterSpacing: 0.6 },
  chiffreValeur: {
    fontFamily: POLICES.titre,
    fontSize: T.grand - 0.6,
    fontWeight: 600,
    marginTop: 1.5,
  },

  /* --- Signatures ------------------------------------------------------ */
  signatures: { flexDirection: 'row', gap: 30, marginTop: 12 },
  signatureBloc: { flex: 1 },
  signatureLigne: { borderBottomWidth: 0.8, borderBottomColor: C.ardoiseClair, height: 26 },
  signatureLegende: { fontSize: T.petit - 0.2, color: C.ardoise, marginTop: 4 },

  /* --- Pied de page ---------------------------------------------------- */
  pied: {
    position: 'absolute',
    bottom: 22,
    left: ESPACES.page.cotes,
    right: ESPACES.page.cotes,
    borderTopWidth: 0.6,
    borderTopColor: C.mineralSombre,
    paddingTop: 7,
  },
  piedTexte: { fontSize: T.micro, color: C.ardoise },
  piedType: {
    fontSize: T.micro - 0.3,
    color: C.ardoiseClair,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  piedRangee: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  piedGauche: { flexGrow: 1, flexShrink: 1 },
  piedPagination: {
    flexGrow: 0,
    flexShrink: 0,
    width: 46,
    textAlign: 'right',
    fontSize: T.micro,
    color: C.ardoise,
  },
});
