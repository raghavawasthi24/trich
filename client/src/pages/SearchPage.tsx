import { useState } from 'react';
import { SearchForm } from '../components/SearchForm';
import { LoadingState } from '../components/LoadingState';
import { ResultCard } from '../components/ResultCard';
import { SupplierReport } from '../components/SupplierReport';
import { ErrorBanner } from '../components/ErrorBanner';
import { ScenarioPicker } from '../components/ScenarioPicker';
import { useHotelSearch } from '../hooks/useHotelSearch';
import { env } from '../config/env';
import type { SearchRequest } from '../types/api';

export function SearchPage() {
  const { state, search, cancel, reset } = useHotelSearch();
  const [scenario, setScenario] = useState('');
  const [lastInput, setLastInput] = useState<SearchRequest | null>(null);

  const isBusy = state.status === 'loading' || state.status === 'polling';

  function handleSubmit(input: SearchRequest) {
    setLastInput(input);
    search(input, scenario || undefined);
  }

  function handleRetry() {
    if (lastInput) search(lastInput, scenario || undefined);
  }

  return (
    <main className="search-page">
      <h1>Hotel Rate Comparator</h1>

      {env.VITE_ENABLE_SCENARIOS && <ScenarioPicker value={scenario} onChange={setScenario} />}

      <SearchForm disabled={isBusy} onSubmit={handleSubmit} />

      <div className="results" aria-live="polite">
        {isBusy && <LoadingState polling={state.status === 'polling'} onCancel={cancel} />}

        {state.status === 'success' && (
          <>
            <ResultCard offer={state.data.best} consideredCount={state.data.consideredCount} />
            <SupplierReport suppliers={state.data.suppliers} />
          </>
        )}

        {state.status === 'empty' && (
          <div className="empty-state" data-testid="empty-state">
            <p>{state.message}</p>
            <SupplierReport suppliers={state.suppliers} />
          </div>
        )}

        {state.status === 'error' && <ErrorBanner message={state.message} onRetry={handleRetry} />}

        {state.status === 'cancelled' && (
          <p className="cancelled-note" data-testid="cancelled-note">
            Search cancelled.{' '}
            <button type="button" onClick={reset}>
              Start over
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
