import type { Offer } from '../types/api';

interface Props {
  offer: Offer;
  consideredCount: number;
}

export function ResultCard({ offer, consideredCount }: Props) {
  return (
    <div className="result-card" data-testid="result-card">
      <h2 title={offer.name}>{offer.name}</h2>
      <p className="price">{offer.priceFormatted}</p>
      <span className="supplier-badge" data-supplier={offer.supplier}>
        Supplier {offer.supplier}
      </span>
      <p className="considered">Checked {consideredCount} offer{consideredCount === 1 ? '' : 's'}</p>
    </div>
  );
}
