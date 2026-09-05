import { z } from 'zod';
import { nights, startOfToday } from '../helpers/dates';

export const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const SearchRequestSchema = z
  .object({
    city: z.string().trim().min(2).max(100),
    checkInDate: ISODate,
    checkOutDate: ISODate,
    adults: z.number().int().min(1).max(8).default(2),
    currency: z.enum(['INR', 'USD', 'EUR']).default('INR'),
  })
  .strip()
  .superRefine((v, ctx) => {
    if (!(new Date(v.checkOutDate) > new Date(v.checkInDate))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutDate must be after checkInDate',
        path: ['checkOutDate'],
      });
      return;
    }
    if (new Date(v.checkInDate) < startOfToday()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkInDate cannot be in the past',
        path: ['checkInDate'],
      });
    }
    if (nights(v.checkInDate, v.checkOutDate) > 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maximum stay is 30 nights',
        path: ['checkOutDate'],
      });
    }
  });

export const SearchIdParamSchema = z.object({
  searchId: z.string().min(1),
});

export const OfferSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().min(1),
  priceMinor: z.number().int().positive(),
  currency: z.enum(['INR', 'USD', 'EUR']),
  supplier: z.enum(['A', 'B']),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type Offer = z.infer<typeof OfferSchema>;
