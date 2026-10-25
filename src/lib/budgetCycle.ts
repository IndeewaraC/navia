import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getPayCycleStatus } from './payCycleDates';

export async function getBudgetCycleStatus(
  supabase: SupabaseClient,
  user: User,
  resetDate: string | null | undefined,
  now = new Date(),
) {
  const savedStart = user.user_metadata?.navia_budget_cycle_start;
  const cycle = getPayCycleStatus(resetDate, now, savedStart);

  // Store only a budget preference in the user's existing metadata. This pins
  // the start across date edits without a schema migration or ledger rewrites.
  if (savedStart !== cycle.cycle_start) {
    const { error } = await supabase.auth.updateUser({
      data: { navia_budget_cycle_start: cycle.cycle_start },
    });
    if (error) throw new Error('Unable to preserve the current budget cycle.');
  }

  return cycle;
}
