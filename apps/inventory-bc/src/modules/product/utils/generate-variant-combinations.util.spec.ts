import { generateVariantCombinations } from './generate-variant-combinations.util';

describe('generateVariantCombinations', () => {
  it('cartesian-products two attribute dimensions (Color x Size -> 6 combos)', () => {
    const combinations = generateVariantCombinations([
      { attribute_id: 'color', value_ids: ['red', 'black'] },
      { attribute_id: 'size', value_ids: ['S', 'M', 'L'] },
    ]);

    expect(combinations).toHaveLength(6);
    expect(combinations).toContainEqual([
      { attribute_id: 'color', attribute_value_id: 'red' },
      { attribute_id: 'size', attribute_value_id: 'S' },
    ]);
    expect(combinations).toContainEqual([
      { attribute_id: 'color', attribute_value_id: 'black' },
      { attribute_id: 'size', attribute_value_id: 'L' },
    ]);
  });

  it('returns one combination per value for a single attribute dimension', () => {
    const combinations = generateVariantCombinations([
      { attribute_id: 'color', value_ids: ['red', 'black'] },
    ]);

    expect(combinations).toEqual([
      [{ attribute_id: 'color', attribute_value_id: 'red' }],
      [{ attribute_id: 'color', attribute_value_id: 'black' }],
    ]);
  });

  it('produces no combinations when any dimension has zero selected values', () => {
    const combinations = generateVariantCombinations([
      { attribute_id: 'color', value_ids: ['red'] },
      { attribute_id: 'size', value_ids: [] },
    ]);

    expect(combinations).toEqual([]);
  });

  it('returns a single empty combination for an empty selection list (caller must guard against this)', () => {
    expect(generateVariantCombinations([])).toEqual([[]]);
  });
});
