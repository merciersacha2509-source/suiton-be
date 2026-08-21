import { z } from 'zod';

/** Schemas partages. Utilises cote client ET cote serveur, sans exception. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Adresse e-mail trop courte')
  .max(254, 'Adresse e-mail trop longue')
  .email('Adresse e-mail invalide');

export const telephoneSchema = z
  .string()
  .trim()
  .min(8, 'Numero de telephone trop court')
  .max(20, 'Numero de telephone trop long')
  .regex(new RegExp('^[0-9+\\s().-]+$'), 'Numero de telephone invalide');

export const tvaBeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp('^BE[0-9]{10}$'), 'Numero de TVA belge invalide (format BE0123456789)');

export const codePostalBeSchema = z
  .string()
  .trim()
  .regex(new RegExp('^[0-9]{4}$'), 'Code postal belge invalide');

export const communeSchema = z.string().trim().min(2, 'Commune requise').max(80);

export const nomSchema = z.string().trim().min(2, 'Nom requis').max(120);

export const uuidSchema = z.string().uuid('Identifiant invalide');
