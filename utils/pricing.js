const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * subtotal  = (daily rate + package extra fee) * days
 * total     = subtotal  - package discount%  - membership discount% (applied in sequence)
 */
function calculatePrice({ dailyRate, extraDailyFee = 0, days, packageDiscount = 0, memberDiscount = 0 }) {
  const subtotal = round2((dailyRate + extraDailyFee) * days);
  const afterPackage = subtotal * (1 - packageDiscount / 100);
  const total = round2(afterPackage * (1 - memberDiscount / 100));
  return { subtotal, discount_amount: round2(subtotal - total), total };
}

module.exports = { calculatePrice, round2 };
