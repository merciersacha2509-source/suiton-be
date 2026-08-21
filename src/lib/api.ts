import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, RateLimitError } from '@/lib/errors';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: string;
  code?: string;
  issues?: { path: string; message: string }[];
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

/**
 * Enveloppe unique de toutes les routes.
 *
 * Un message d'erreur technique renvoye au client est une fuite d'information
 * et une mauvaise experience a la fois : on journalise tout, on ne dit rien.
 */
export async function handle<T>(
  fn: () => Promise<T>,
  init?: { status?: number },
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const data = await fn();
    return NextResponse.json<ApiOk<T>>({ ok: true, data }, { status: init?.status ?? 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json<ApiErr>(
        {
          ok: false,
          error: 'Donnees invalides.',
          code: 'validation',
          issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        { status: 422 },
      );
    }

    if (error instanceof RateLimitError) {
      return NextResponse.json<ApiErr>(
        { ok: false, error: error.message, code: error.code },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json<ApiErr>(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error('[api] erreur non geree', error);
    return NextResponse.json<ApiErr>(
      {
        ok: false,
        error: 'Une erreur est survenue. Reessayez dans un instant.',
        code: 'internal',
      },
      { status: 500 },
    );
  }
}
