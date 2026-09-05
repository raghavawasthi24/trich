import type { SupplierReportRow } from '../types/api';

const STATUS_LABEL: Record<SupplierReportRow['status'], string> = {
  ok: 'OK',
  empty: 'No offers',
  timeout: 'Timed out',
  error: 'Error',
};

export function SupplierReport({ suppliers }: { suppliers: SupplierReportRow[] }) {
  if (suppliers.length === 0) return null;
  return (
    <ul className="supplier-report" aria-label="Supplier status">
      {suppliers.map((row) => (
        <li key={row.supplier} data-status={row.status}>
          Supplier {row.supplier}: {STATUS_LABEL[row.status]}
          {typeof row.offerCount === 'number' ? ` (${row.offerCount} offers)` : ''}
          {row.latencyMs ? ` · ${row.latencyMs}ms` : ''}
        </li>
      ))}
    </ul>
  );
}
