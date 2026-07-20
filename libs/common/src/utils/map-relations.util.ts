/**
 * Converts an array of related-entity ids into the "stub" entities
 * (`{ id }`) TypeORM accepts for a ManyToMany relation assignment.
 * Assigning the full replacement array and calling `save()` lets TypeORM
 * diff and sync the join table itself (insert new pairs, delete removed
 * ones) instead of hand-rolling junction-row inserts/deletes.
 * Usage: role.policies = mapRelations<Policy>(dto.policy_ids);
 */
export function mapRelations<T extends { id: string }>(ids: string[]): T[] {
  return ids.map((id) => ({ id }) as T);
}
