import { z } from 'zod';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function nights(checkInDate: string, checkOutDate: string): number {
  const ms = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// UX convenience only — the server independently re-validates everything and
// is the only validation with security meaning (see client README).
export const SearchFormSchema = z
  .object({
    city: z.string().trim().min(2, 'City must be at least 2 characters').max(100),
    checkInDate: z.string().min(1, 'Check-in date is required'),
    checkOutDate: z.string().min(1, 'Check-out date is required'),
    adults: z.number().int().min(1).max(8).default(2),
    currency: z.enum(['INR', 'USD', 'EUR']).default('INR'),
  })
  .superRefine((v, ctx) => {
    if (!(new Date(v.checkOutDate) > new Date(v.checkInDate))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check-out must be after check-in', path: ['checkOutDate'] });
      return;
    }
    if (new Date(v.checkInDate) < startOfToday()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check-in cannot be in the past', path: ['checkInDate'] });
    }
    if (nights(v.checkInDate, v.checkOutDate) > 30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Maximum stay is 30 nights', path: ['checkOutDate'] });
    }
  });

export type SearchFormValues = z.infer<typeof SearchFormSchema>;

export const SearchResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    searchId: z.string(),
    best: z.object({
      hotelId: z.string(),
      name: z.string(),
      priceMinor: z.number(),
      priceFormatted: z.string(),
      currency: z.enum(['INR', 'USD', 'EUR']),
      supplier: z.enum(['A', 'B']),
    }),
    consideredCount: z.number(),
    suppliers: z.array(
      z.object({
        supplier: z.enum(['A', 'B']),
        status: z.enum(['ok', 'empty', 'timeout', 'error']),
        offerCount: z.number().optional(),
        latencyMs: z.number().optional(),
        error: z.string().optional(),
      }),
    ),
    durationMs: z.number(),
    requestId: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    code: z.string(),
    message: z.string().optional(),
    details: z.unknown().optional(),
    searchId: z.string().optional(),
    pollUrl: z.string().optional(),
    retryAfterMs: z.number().optional(),
    requestId: z.string(),
  }),
]);
