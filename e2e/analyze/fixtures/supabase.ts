const accounts = [
  { account_id: 'visa', account_alias: 'Visa' },
  { account_id: 'cash', account_alias: 'Cash' },
  { account_id: 'savings', account_alias: 'Savings' },
];
const transactions = [
  { transaction_id: '1', amount: '10.10', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-10-01', txn_type: 'EXPENSE', user_id: 'fixture-user' },
  { transaction_id: '2', amount: '20.20', category: ' coffee   SHOP ', source_account_id: 'cash', transaction_date: '2030-10-15', txn_type: 'EXPENSE', user_id: 'fixture-user', is_budget_cap_exempt: true },
  { transaction_id: '3', amount: '40.00', category: 'Market', source_account_id: 'visa', transaction_date: '2030-10-20', txn_type: 'EXPENSE', user_id: 'fixture-user' },
  { transaction_id: '4', amount: '30.00', category: 'Coffee beans', source_account_id: 'cash', transaction_date: '2030-10-31', txn_type: 'EXPENSE', user_id: 'fixture-user' },
  { transaction_id: '5', amount: '999.00', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-11-01', txn_type: 'EXPENSE', user_id: 'fixture-user' },
  { transaction_id: '6', amount: '999.00', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-09-30', txn_type: 'EXPENSE', user_id: 'fixture-user' },
  { transaction_id: '7', amount: '999.00', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-10-15', txn_type: 'INCOME', user_id: 'fixture-user' },
  { transaction_id: '8', amount: '999.00', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-10-15', txn_type: 'TRANSFER', user_id: 'fixture-user' },
  { transaction_id: '9', amount: '999.00', category: 'Coffee Shop', source_account_id: 'visa', transaction_date: '2030-10-15', txn_type: 'EXPENSE', user_id: 'another-user' },
];

export function createClient() {
  let failed = false;
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let offset = 0;
      let end = Infinity;
      let signal: AbortSignal | undefined;
      const query = {
        select() { return query; },
        eq(field: string, value: unknown) {
          if (table !== 'payment_accounts') filters.push(row => row[field] === value);
          return query;
        },
        gte(field: string, value: string) { filters.push(row => String(row[field]) >= value); return query; },
        lt(field: string, value: string) { filters.push(row => String(row[field]) < value); return query; },
        order() { return query; },
        range(from: number, to: number) { offset = from; end = to; return query; },
        abortSignal(value: AbortSignal) { signal = value; return query; },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const promise = new Promise(done => setTimeout(() => {
            if (signal?.aborted) return done({ data: null, error: new Error('Aborted') });
            const failOnce = window.location.search.includes(`fail-${table}`) && !failed;
            if (failOnce) {
              failed = true;
              return done({ data: null, error: new Error('Fixture database failure') });
            }
            done({
              data: (table === 'payment_accounts' ? accounts : transactions)
                .filter(row => filters.every(filter => filter(row))).slice(offset, end + 1),
              error: null,
            });
          }, 20));
          return promise.then(resolve, reject);
        },
      };
      return query;
    },
  };
}
