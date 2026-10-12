export type PricedItem = { shelfPrice: number };

export function calculateGroceryTotal(items: PricedItem[], tax: number, discount: number, manualTotal: number | null) {
  const subtotal = Number(items.reduce((sum, item) => sum + item.shelfPrice, 0).toFixed(2));
  const allPriced = items.length > 0 && items.every(item => item.shelfPrice > 0);
  const total = manualTotal ?? (allPriced ? Number((subtotal + tax - discount).toFixed(2)) : null);
  let error = '';
  if (items.length <= 2 && total === null) {
    error = 'For lists with two or fewer items, enter every item price or a final total.';
  } else if (total !== null && (!Number.isFinite(total) || total <= 0)) {
    error = 'Final total must be greater than zero.';
  }
  return { subtotal, allPriced, total, error };
}
