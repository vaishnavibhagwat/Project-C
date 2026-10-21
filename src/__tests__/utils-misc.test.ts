import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToChannels, isHexColor, mixHex } from '@/utils/color';
import { cx } from '@/utils/cx';
import { parseEnv } from '@/utils/env';
import { schemaFields, validateConfig, validateField } from '@/utils/jsonSchema';
import { sanitizeText } from '@/utils/sanitize';

describe('colour utilities', () => {
  it('converts hex to Tailwind channel strings', () => {
    expect(hexToChannels('#22d3ee')).toBe('34 211 238');
    expect(isHexColor('#12345g')).toBe(false);
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('sanitizeText', () => {
  it('strips markup and scripts, keeping text', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>Hello <b>desk</b>')).toBe('Hello desk');
    expect(sanitizeText('<script>alert(1)</script>Safe')).toBe('Safe');
  });

  it('does not HTML-escape ampersands and trims length', () => {
    expect(sanitizeText('M&M  results')).toBe('M&M results');
    expect(sanitizeText('a'.repeat(300), 10)).toHaveLength(10);
  });
});

describe('JSON schema config forms', () => {
  const schema: JSONSchema7 = {
    type: 'object',
    properties: {
      range: { title: 'Range', oneOf: [{ const: '1Y', title: '1 year' }, { const: '5Y' }] },
      show: { type: 'boolean', title: 'Show' },
      limit: { type: 'number', minimum: 0.5, maximum: 5 },
      days: { type: 'integer', minimum: 1 },
      note: { type: 'string', maxLength: 3 },
    },
  };

  it('maps schema properties to typed fields', () => {
    const fields = schemaFields(schema);
    expect(fields.map((f) => f.kind)).toEqual(['enum', 'boolean', 'number', 'number', 'string']);
    const range = fields[0];
    expect(range?.kind === 'enum' ? range.options : []).toEqual([
      { value: '1Y', label: '1 year' },
      { value: '5Y', label: '5Y' },
    ]);
  });

  it('validates bounds, integers and enums', () => {
    const [range, , limit, days, note] = schemaFields(schema);
    if (!range || !limit || !days || !note) throw new Error('fields missing');
    expect(validateField(range, '3Y')).not.toBeNull();
    expect(validateField(limit, 9)).toBe('Maximum is 5.');
    expect(validateField(limit, Number.NaN)).toBe('Enter a number.');
    expect(validateField(days, 1.5)).toBe('Enter a whole number.');
    expect(validateField(note, 'long')).not.toBeNull();
    expect(
      validateConfig(schema, { range: '1Y', show: true, limit: 2, days: 3, note: 'ok' }),
    ).toEqual({});
  });
});

describe('environment configuration', () => {
  it('applies defaults and coerces strings', () => {
    const env = parseEnv({ VITE_DATA_SEED: '42', VITE_SIMULATE_MARKET_OPEN: 'false' });
    expect(env.VITE_DATA_SEED).toBe(42);
    expect(env.VITE_SIMULATE_MARKET_OPEN).toBe(false);
    expect(env.VITE_USD_INR_RATE).toBe(83.5);
  });

  it('rejects invalid values', () => {
    expect(() => parseEnv({ VITE_MOCK_ERROR_RATE: '2' })).toThrow(/VITE_MOCK_ERROR_RATE/);
    expect(() => parseEnv({ VITE_USD_INR_RATE: 'Infinity' })).toThrow();
  });
});

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, null, 'b', undefined)).toBe('a b');
  });
});
