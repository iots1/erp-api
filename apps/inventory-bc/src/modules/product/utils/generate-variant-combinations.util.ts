/** One attribute dimension and the value IDs selected for variant generation. */
export interface VariantAttributeSelection {
  attribute_id: string;
  value_ids: string[];
}

export interface VariantCombinationEntry {
  attribute_id: string;
  attribute_value_id: string;
}

/** One full combination — exactly one value per selected attribute dimension. */
export type VariantCombination = VariantCombinationEntry[];

/**
 * Cartesian-products attribute value selections into every variant combination,
 * e.g. Color {แดง, ดำ} × Size {S, M, L} → 6 combinations. Pure function — no DB,
 * no side effects — so `ProductsService.generateVariants` can be unit tested
 * around it without mocking a repository.
 */
export function generateVariantCombinations(
  selections: VariantAttributeSelection[],
): VariantCombination[] {
  return selections.reduce<VariantCombination[]>(
    (accumulatedCombinations, selection) => {
      const expanded: VariantCombination[] = [];
      for (const combination of accumulatedCombinations) {
        for (const valueId of selection.value_ids) {
          expanded.push([
            ...combination,
            {
              attribute_id: selection.attribute_id,
              attribute_value_id: valueId,
            },
          ]);
        }
      }
      return expanded;
    },
    [[]],
  );
}
