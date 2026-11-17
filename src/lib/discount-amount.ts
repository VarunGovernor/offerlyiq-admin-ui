/** Monetary coupon amounts are integer minor units. Never silently round an
 * admin-supplied value: rounding 0.001 USD to 0 would mint a broken promotion.
 */
export function currencyExponent(currency: string): number {
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.trim().toUpperCase(),
  }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined) {
    throw new RangeError("Unsupported currency precision");
  }
  return digits;
}

export function toMinorUnits(amount: number, currency: string): number {
  const exponent = currencyExponent(currency);
  const scaled = amount * 10 ** exponent;
  const rounded = Math.round(scaled);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(rounded) ||
    rounded <= 0 ||
    Math.abs(scaled - rounded) > 1e-7
  ) {
    throw new RangeError(
      `Enter a positive amount with no more than ${exponent} decimal places for ${currency.toUpperCase()}`,
    );
  }
  return rounded;
}

export function toBasisPoints(percent: number): number {
  const scaled = percent * 100;
  const rounded = Math.round(scaled);
  if (
    !Number.isFinite(percent) ||
    percent <= 0 ||
    percent > 100 ||
    !Number.isSafeInteger(rounded) ||
    Math.abs(scaled - rounded) > 1e-7
  ) {
    throw new RangeError("Enter a percentage from 0.01 to 100 with at most two decimal places");
  }
  return rounded;
}

export function toWholeCredits(credits: number): number {
  if (!Number.isSafeInteger(credits) || credits <= 0) {
    throw new RangeError("Bonus credits must be a positive whole number");
  }
  return credits;
}

export function formatFlatDiscount(amountMinor: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = currencyExponent(code);
  return `${code} ${(amountMinor / 10 ** digits).toFixed(digits)}`;
}
