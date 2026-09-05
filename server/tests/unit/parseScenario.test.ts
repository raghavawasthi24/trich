import { parseScenario, parseScenarioString } from '../../src/helpers/scenario';

describe('parseScenarioString', () => {
  it('parses comma-separated per-supplier tokens', () => {
    expect(parseScenarioString('A_FAIL_500,B_OK')).toEqual({ A: 'FAIL_500', B: 'OK' });
  });

  it('ignores unknown tokens', () => {
    expect(parseScenarioString('A_NOT_A_REAL_TOKEN,B_OK')).toEqual({ B: 'OK' });
  });

  it('ignores malformed segments without a supplier prefix', () => {
    expect(parseScenarioString('garbage,B_OK')).toEqual({ B: 'OK' });
  });
});

describe('parseScenario', () => {
  it('prefers the header over the city keyword', () => {
    expect(parseScenario('A_OK,B_EMPTY', 'goa__A_TIMEOUT__B_OK')).toEqual({ A: 'OK', B: 'EMPTY' });
  });

  it('falls back to the magic city keyword when no header is present', () => {
    expect(parseScenario(undefined, 'goa__A_TIMEOUT__B_OK')).toEqual({ A: 'TIMEOUT', B: 'OK' });
  });

  it('resolves the reserved "tiecity" keyword to TIE on both suppliers', () => {
    expect(parseScenario(undefined, 'tiecity')).toEqual({ A: 'TIE', B: 'TIE' });
  });

  it('returns an empty map for a plain city with no header', () => {
    expect(parseScenario(undefined, 'Mumbai')).toEqual({});
  });
});
