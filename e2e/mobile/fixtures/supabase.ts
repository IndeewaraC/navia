export function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) },
    from: () => ({
      select: () => ({ eq: async () => ({ data: [] }) }),
      insert: async () => ({ error: null }),
    }),
    rpc: async () => ({ data: {
      cycle_start: '2030-01-01', cycle_end: '2030-01-14',
      days_remaining: 14, is_magic_month: true,
    }, error: null }),
  };
}
