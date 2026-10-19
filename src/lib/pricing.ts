import "server-only";

/**
 * Money handling.
 *
 * All amounts are integer paise. Rupee values coming from forms are converted
 * once, at the boundary, and every calculation afterwards uses integers.
 *
 * Prices are treated as tax-inclusive (MRP), which is the usual retail model
 * for medicines in India: the listed price already contains GST. The tax
 * component is therefore derived for display/reporting only and is never
 * added on top of the total.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number, options: { withDecimals?: boolean } = {}): string {
  const value = paiseToRupees(paise);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: options.withDecimals ? 2 : 0,
    maximumFractionDigits: options.withDecimals ? 2 : 0,
  }).format(value);
  return `₹${formatted}`;
}

/** Tax component already contained in a tax-inclusive amount. */
export function taxComponentOf(taxInclusivePaise: number, taxPercent: number): number {
  if (taxPercent <= 0) return 0;
  return Math.round((taxInclusivePaise * taxPercent) / (100 + taxPercent));
}

export interface LineInput {
  unitPriceInPaise: number;
  quantity: number;
  taxPercent: number;
}

export interface ComputedLine {
  unitPriceInPaise: number;
  quantity: number;
  taxPercent: number;
  lineTotalInPaise: number;
  taxInPaise: number;
}

export function computeLine(input: LineInput): ComputedLine {
  const quantity = Math.max(1, Math.floor(input.quantity));
  const lineTotalInPaise = input.unitPriceInPaise * quantity;
  return {
    unitPriceInPaise: input.unitPriceInPaise,
    quantity,
    taxPercent: input.taxPercent,
    lineTotalInPaise,
    taxInPaise: taxComponentOf(lineTotalInPaise, input.taxPercent),
  };
}

export interface TotalsInput {
  lines: Array<{ lineTotalInPaise: number; taxInPaise: number }>;
  deliveryFeeInPaise: number;
  discountInPaise?: number;
}

export interface Totals {
  subtotalInPaise: number;
  taxInPaise: number;
  deliveryFeeInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotalInPaise = input.lines.reduce((sum, line) => sum + line.lineTotalInPaise, 0);
  const taxInPaise = input.lines.reduce((sum, line) => sum + line.taxInPaise, 0);
  const discountInPaise = Math.min(
    Math.max(0, Math.floor(input.discountInPaise ?? 0)),
    subtotalInPaise,
  );
  const deliveryFeeInPaise = Math.max(0, Math.floor(input.deliveryFeeInPaise));
  const totalInPaise = Math.max(
    0,
    subtotalInPaise + deliveryFeeInPaise - discountInPaise,
  );
  return {
    subtotalInPaise,
    taxInPaise,
    deliveryFeeInPaise,
    discountInPaise,
    totalInPaise,
  };
}
