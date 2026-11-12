export function parsePriceAmount(value: string): number {
  const text = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99999999) {
    throw new Error("Enter an amount between 0.01 and 999,999.99.");
  }
  return amount;
}

export function parseFallbackCountries(value: string, country: string): string[] {
  if (!value.trim()) return [];
  const countries = value.split(",").map((code) => code.trim().toUpperCase());
  if (countries.some((code) => !/^[A-Z]{2}$/.test(code) || code === country.toUpperCase()) || new Set(countries).size !== countries.length) {
    throw new Error("Use unique two-letter fallback country codes, excluding the primary market.");
  }
  return countries;
}
