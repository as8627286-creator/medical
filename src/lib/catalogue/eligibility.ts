import {
  LegalRestriction,
  SaleEligibility,
} from "@/generated/prisma/enums";

/**
 * Sale eligibility rules.
 *
 * These are pure functions so that they can be unit tested without a database
 * and reused by the storefront, the cart, the checkout and the admin screens.
 *
 * The rules fail closed: anything that is not explicitly allowed is not
 * offered for online sale.
 */

export interface EligibilityInput {
  isActive: boolean;
  saleEligibility: SaleEligibility;
  legalRestriction: LegalRestriction;
  prescriptionRequired: boolean;
  stockQuantity: number;
  reservedQuantity: number;
}

export interface EligibilityResult {
  /** May the product be offered on the online storefront at all? */
  sellableOnline: boolean;
  /** Must a prescription be supplied and approved before dispatch? */
  prescriptionRequired: boolean;
  /** Why the product is not sellable, when it is not. */
  reason: string | null;
  /** Number of units that can actually be promised right now. */
  availableQuantity: number;
}

export const NOT_SELLABLE_REASONS = {
  INACTIVE: "This product is not currently available.",
  PROHIBITED_ONLINE: "This product is not available for online sale.",
  CONTROLLED: "This product is not available for online sale.",
  COLD_CHAIN: "This product is not available for online sale.",
  NOT_FOR_ONLINE_SALE: "This product is not available for online sale.",
  OUT_OF_STOCK: "This product is out of stock.",
} as const;

export function availableQuantity(input: {
  stockQuantity: number;
  reservedQuantity: number;
}): number {
  return Math.max(0, input.stockQuantity - input.reservedQuantity);
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const prescriptionRequired =
    input.prescriptionRequired ||
    input.saleEligibility === SaleEligibility.PRESCRIPTION_REQUIRED ||
    input.legalRestriction === LegalRestriction.PRESCRIPTION_ONLY;

  const stock = availableQuantity(input);

  const base = {
    prescriptionRequired,
    availableQuantity: stock,
  };

  if (!input.isActive) {
    return { ...base, sellableOnline: false, reason: NOT_SELLABLE_REASONS.INACTIVE };
  }

  switch (input.legalRestriction) {
    case LegalRestriction.PROHIBITED_FOR_ONLINE_SALE:
      return {
        ...base,
        sellableOnline: false,
        reason: NOT_SELLABLE_REASONS.PROHIBITED_ONLINE,
      };
    case LegalRestriction.CONTROLLED_SUBSTANCE:
      return {
        ...base,
        sellableOnline: false,
        reason: NOT_SELLABLE_REASONS.CONTROLLED,
      };
    case LegalRestriction.COLD_CHAIN:
      return {
        ...base,
        sellableOnline: false,
        reason: NOT_SELLABLE_REASONS.COLD_CHAIN,
      };
    case LegalRestriction.PRESCRIPTION_ONLY:
    case LegalRestriction.NONE:
      break;
  }

  if (input.saleEligibility === SaleEligibility.NOT_FOR_ONLINE_SALE) {
    return {
      ...base,
      sellableOnline: false,
      reason: NOT_SELLABLE_REASONS.NOT_FOR_ONLINE_SALE,
    };
  }

  if (stock <= 0) {
    return { ...base, sellableOnline: false, reason: NOT_SELLABLE_REASONS.OUT_OF_STOCK };
  }

  return { ...base, sellableOnline: true, reason: null };
}

/**
 * Products that may never be sold through this online storefront, regardless of
 * the sale-eligibility flag an administrator set. Used by the catalogue write
 * path to reject an inconsistent combination.
 */
export function isLegalRestrictionBinding(restriction: LegalRestriction): boolean {
  return (
    restriction === LegalRestriction.PROHIBITED_FOR_ONLINE_SALE ||
    restriction === LegalRestriction.CONTROLLED_SUBSTANCE ||
    restriction === LegalRestriction.COLD_CHAIN
  );
}
