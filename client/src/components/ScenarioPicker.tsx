const SCENARIOS = [
  { label: 'Default (random)', value: '' },
  { label: 'A cheaper', value: 'A_OK_CHEAP,B_OK_EXPENSIVE' },
  { label: 'B cheaper', value: 'A_OK_EXPENSIVE,B_OK_CHEAP' },
  { label: 'Tie (A wins)', value: 'A_TIE,B_TIE' },
  { label: 'A fails, B ok', value: 'A_FAIL_500,B_OK' },
  { label: 'Both fail', value: 'A_FAIL_500,B_FAIL_503' },
  { label: 'One empty', value: 'A_EMPTY,B_OK' },
  { label: 'Both empty', value: 'A_EMPTY,B_EMPTY' },
  { label: 'A slow (>5s)', value: 'A_SLOW_6S,B_OK' },
  { label: 'A flaky then ok', value: 'A_FLAKY_2,B_OK' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ScenarioPicker({ value, onChange }: Props) {
  return (
    <div className="scenario-picker">
      <label htmlFor="scenario">Dev: force supplier scenario</label>
      <select id="scenario" value={value} onChange={(e) => onChange(e.target.value)}>
        {SCENARIOS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
