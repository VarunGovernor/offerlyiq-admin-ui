/** Stripe coupons store flat discounts in the currency's *minor* units.
 * A fixed x100 conversion is wrong for zero-decimal JPY and three-decimal KWD.
 */
export function currencyExponent(currency: string): number {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.trim().toUpperCase(),
  }).resolvedOptions().maximumFractionDigits;
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyExponent(currency));
}

export function formatFlatDiscount(amountMinor: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = currencyExponent(code);
  return `${code} ${(amountMinor / 10 ** digits).toFixed(digits)}`;
}
