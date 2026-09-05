import { FormEvent, useState } from 'react';
import { SearchFormSchema } from '../schemas/searchForm.schema';
import type { SearchRequest } from '../types/api';

interface Props {
  disabled: boolean;
  onSubmit: (input: SearchRequest) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SearchForm({ disabled, onSubmit }: Props) {
  const [city, setCity] = useState('Goa');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = SearchFormSchema.safeParse({ city, checkInDate, checkOutDate, adults, currency });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? 'form';
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Hotel search">
      <div className="field">
        <label htmlFor="city">City</label>
        <input id="city" value={city} onChange={(e) => setCity(e.target.value)} disabled={disabled} />
        {errors.city && <p className="field-error">{errors.city}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="checkInDate">Check-in</label>
          <input
            id="checkInDate"
            type="date"
            min={todayISO()}
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            disabled={disabled}
          />
          {errors.checkInDate && <p className="field-error">{errors.checkInDate}</p>}
        </div>

        <div className="field">
          <label htmlFor="checkOutDate">Check-out</label>
          <input
            id="checkOutDate"
            type="date"
            min={checkInDate || todayISO()}
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            disabled={disabled}
          />
          {errors.checkOutDate && <p className="field-error">{errors.checkOutDate}</p>}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="adults">Adults</label>
          <input
            id="adults"
            type="number"
            min={1}
            max={8}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} disabled={disabled}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <button type="submit" disabled={disabled}>
        {disabled ? 'Searching…' : 'Search hotels'}
      </button>
    </form>
  );
}
