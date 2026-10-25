type ResetFixture = {
  profile: { anchor_pay_date: string; display_name: string };
  metadata: Record<string, unknown>;
  profileWrites: number;
};
const storageKey = 'navia-reset-service-fixture';
const saved = localStorage.getItem(storageKey);
export const resetFixture: ResetFixture = saved ? JSON.parse(saved) : {
  profile: { anchor_pay_date: '2026-11-14', display_name: 'Regression' },
  metadata: { navia_budget_cycle_start: '2026-10-14' }, profileWrites: 0,
};
declare global {
  interface Window { __naviaResetFixture: ResetFixture }
}
window.__naviaResetFixture = resetFixture;
const persist = () => localStorage.setItem(storageKey, JSON.stringify(resetFixture));
const getUser = () => ({ id: 'fixture-user', email: 'fixture@example.test', user_metadata: resetFixture.metadata });

export function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: getUser() }, error: null }),
      updateUser: async ({ data }: { data: Record<string, unknown> }) => {
        if (window.location.search.includes('metadata-error')) return { error: { message: 'Fixture metadata failure' } };
        Object.assign(resetFixture.metadata, data);
        persist();
        return { data: { user: getUser() }, error: null };
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const result = () => ({ data: table === 'profiles' ? resetFixture.profile : [], error: null });
      const query = {
        eq: () => query,
        order: async () => result(),
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return {
        select: () => query,
        insert: async () => ({ error: null }),
        upsert: async (data: { anchor_pay_date: string; display_name: string }) => {
          if (window.location.search.includes('save-error')) return { error: { message: 'Fixture profile failure' } };
          resetFixture.profile = { anchor_pay_date: data.anchor_pay_date, display_name: data.display_name };
          resetFixture.profileWrites++;
          persist();
          return { error: null };
        },
      };
    },
  };
}
