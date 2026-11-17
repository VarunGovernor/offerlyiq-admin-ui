/** Keep entered decimal text until conversion; binary floats must not silently
 * round coupon values or erase unsupported precision. */
export function currencyExponent(currency: string): number {
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.trim().toUpperCase(),
  }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined) throw new RangeError("Unsupported currency precision");
  return digits;
}

function exactUnits(value: number | string, digits: number, message: string): number {
  const text = String(value).trim();
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (!match[1] && !match[2])) throw new RangeError(message);
  const fraction = (match[2] || "").replace(/0+$/, "");
  if (fraction.length > digits) throw new RangeError(message);
  const units = BigInt(match[1] || "0") * BigInt(10) ** BigInt(digits)
    + BigInt(fraction.padEnd(digits, "0") || "0");
  if (units <= BigInt(0) || units > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(message);
  }
  return Number(units);
}

export function toMinorUnits(amount: number | string, currency: string): number {
  const exponent = currencyExponent(currency);
  return exactUnits(amount, exponent,
    `Enter a positive amount with no more than ${exponent} decimal places for ${currency.trim().toUpperCase()}`);
}

export function toBasisPoints(percent: number | string): number {
  const message = "Enter a percentage from 0.01 to 100 with at most two decimal places";
  const value = exactUnits(percent, 2, message);
  if (value > 10000) throw new RangeError(message);
  return value;
}

export function toWholeCredits(credits: number | string): number {
  return exactUnits(credits, 0, "Bonus credits must be a positive whole number");
}

export function formatFlatDiscount(amountMinor: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = currencyExponent(code);
  return `${code} ${(amountMinor / 10 ** digits).toFixed(digits)}`;
}

export function toRedemptionCap(value: number | string, required: boolean): number | null {
  const text = String(value).trim();
  if (!required && (text === "" || /^0+(?:\.0*)?$/.test(text))) return null;
  const cap = exactUnits(text, 0, required
    ? "Payment discounts require a positive whole-number max-use cap"
    : "Max uses must be zero (unlimited) or a positive whole number");
  if (cap > 2147483647) throw new RangeError('Max uses must not exceed 2147483647');
  return cap;
}
