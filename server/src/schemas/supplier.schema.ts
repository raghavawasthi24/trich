import { z } from 'zod';

export const SupplierHotelSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive().finite(),
  currency: z.string().length(3).optional(),
});

export const SupplierResponseSchema = z.object({
  supplier: z.enum(['A', 'B']),
  requestedCity: z.string().optional(),
  hotels: z.array(SupplierHotelSchema),
  latencyMs: z.number().int().nonnegative(),
});

export const SupplierQuerySchema = z.object({
  city: z.string().min(1),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  adults: z.coerce.number().optional(),
});

export type SupplierHotel = z.infer<typeof SupplierHotelSchema>;
export type SupplierResponse = z.infer<typeof SupplierResponseSchema>;
