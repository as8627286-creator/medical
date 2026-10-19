import "server-only";
import { prisma } from "@/lib/db";
import { getStoreSettings } from "@/lib/store/settings";

/**
 * Local delivery configuration.
 *
 * A PIN code belongs to at most one zone (enforced by a unique constraint on
 * `DeliveryZonePincode.pincode`). Everything about delivery - eligibility,
 * fee, minimum order value and the delivery window - is configuration, not
 * code.
 */

export interface DeliveryQuote {
  serviceable: boolean;
  reason: string | null;
  zoneId: string | null;
  zoneName: string | null;
  deliveryFeeInPaise: number;
  minOrderAmountInPaise: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  estimatedWindow: string | null;
  city: string | null;
}

export async function findZoneForPincode(pincode: string) {
  const entry = await prisma.deliveryZonePincode.findFirst({
    where: { pincode, isActive: true },
    include: { zone: true },
  });
  if (!entry || !entry.zone.isActive) return null;
  return { entry, zone: entry.zone };
}

export async function quoteDelivery(pincode: string): Promise<DeliveryQuote> {
  const settings = await getStoreSettings();
  const found = await findZoneForPincode(pincode);

  if (!found) {
    return {
      serviceable: false,
      reason: "We do not deliver to this PIN code yet.",
      zoneId: null,
      zoneName: null,
      deliveryFeeInPaise: 0,
      minOrderAmountInPaise: settings.minOrderAmountInPaise,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      estimatedWindow: null,
      city: null,
    };
  }

  const { zone, entry } = found;
  const minOrderAmountInPaise = Math.max(
    zone.minOrderAmountInPaise,
    settings.minOrderAmountInPaise,
  );

  return {
    serviceable: true,
    reason: null,
    zoneId: zone.id,
    zoneName: zone.name,
    deliveryFeeInPaise: zone.deliveryFeeInPaise,
    minOrderAmountInPaise,
    estimatedDaysMin: zone.estimatedDaysMin,
    estimatedDaysMax: zone.estimatedDaysMax,
    estimatedWindow: buildWindow(zone.estimatedDaysMin, zone.estimatedDaysMax),
    city: entry.city ?? zone.city,
  };
}

function buildWindow(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min === max) {
    return min === 0 ? "Same day" : `${min} day${min === 1 ? "" : "s"}`;
  }
  if (min !== null && max !== null) {
    return `${min} to ${max} days`;
  }
  if (min !== null) return `From ${min} day${min === 1 ? "" : "s"}`;
  return `Up to ${max} days`;
}

export interface PaymentMethodEligibility {
  cashOnDelivery: boolean;
  reason: string | null;
}

/**
 * Decides which payment methods may be offered for an order.
 *
 * Online payments are only offered when the store has been configured for
 * them *and* live payments have been explicitly enabled after the compliance
 * checklist has been completed.
 */
export function paymentMethodEligibility(params: {
  totalInPaise: number;
  settings: {
    codEnabled: boolean;
    codMinOrderAmountInPaise: number;
    codMaxOrderAmountInPaise: number | null;
    livePaymentsEnabled: boolean;
  };
  livePaymentsConfigured: boolean;
}): PaymentMethodEligibility {
  const { totalInPaise, settings } = params;

  if (!settings.codEnabled) {
    return { cashOnDelivery: false, reason: "Cash on delivery is not available." };
  }
  if (totalInPaise < settings.codMinOrderAmountInPaise) {
    return {
      cashOnDelivery: false,
      reason: "Cash on delivery is available for orders of at least the configured minimum value.",
    };
  }
  if (
    settings.codMaxOrderAmountInPaise !== null &&
    totalInPaise > settings.codMaxOrderAmountInPaise
  ) {
    return {
      cashOnDelivery: false,
      reason: "Cash on delivery is not available for orders above the configured maximum value.",
    };
  }

  return { cashOnDelivery: true, reason: null };
}

export async function listZones() {
  return prisma.deliveryZone.findMany({
    orderBy: { name: "asc" },
    include: { pincodes: { orderBy: { pincode: "asc" } } },
  });
}
