interface Props {
  polling?: boolean;
  onCancel: () => void;
}

export function LoadingState({ polling, onCancel }: Props) {
  return (
    <div className="loading-state" data-testid="loading-state" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>{polling ? 'Still searching…' : 'Searching for the best rate…'}</p>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
