/**
 * Converts a numeric amount to Indian Currency Words format.
 * e.g. 50000000 -> "Rupees Five Crores Only"
 * e.g. 2500000 -> "Rupees Twenty Five Lakhs Only"
 */
export function convertNumberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "Rupees Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit ? " " + ones[unit] : "");
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundred > 0) {
      res += ones[hundred] + " Hundred";
    }
    if (rest > 0) {
      res += (res ? " and " : "") + convertTwoDigits(rest);
    }
    return res;
  }

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let num = integerPart;
  const parts: string[] = [];

  // Crores (1,00,00,000)
  const crores = Math.floor(num / 10000000);
  if (crores > 0) {
    parts.push(convertThreeDigits(crores) + " Crore" + (crores > 1 ? "s" : ""));
    num %= 10000000;
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(num / 100000);
  if (lakhs > 0) {
    parts.push(convertTwoDigits(lakhs) + " Lakh" + (lakhs > 1 ? "s" : ""));
    num %= 100000;
  }

  // Thousands (1,000)
  const thousands = Math.floor(num / 1000);
  if (thousands > 0) {
    parts.push(convertTwoDigits(thousands) + " Thousand");
    num %= 1000;
  }

  // Hundreds & Units
  if (num > 0) {
    parts.push(convertThreeDigits(num));
  }

  let words = "Rupees " + parts.join(" ");

  if (decimalPart > 0) {
    words += " and " + convertTwoDigits(decimalPart) + " Paise";
  }

  return words.trim() + " Only";
}
