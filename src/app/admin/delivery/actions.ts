"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { deliveryZoneSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/common";
import { formCheckbox, formNumber, formValue } from "@/lib/validation/form";
import { quoteDelivery } from "@/lib/delivery/zones";

export type ZoneState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function saveZoneAction(
  _prevState: ZoneState,
  formData: FormData,
): Promise<ZoneState> {
  const actor = await authorize(PERMISSIONS.DELIVERY_ZONE_WRITE);

  const pincodesRaw = formValue(formData, "pincodes")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const parsed = deliveryZoneSchema.safeParse({
    name: formValue(formData, "name"),
    city: formValue(formData, "city"),
    description: formValue(formData, "description"),
    deliveryFeeInPaise: Math.round(formNumber(formData, "deliveryFee") * 100),
    minOrderAmountInPaise: Math.round(formNumber(formData, "minOrderAmount") * 100),
    estimatedDaysMin:
      formValue(formData, "estimatedDaysMin") === ""
        ? undefined
        : formNumber(formData, "estimatedDaysMin"),
    estimatedDaysMax:
      formValue(formData, "estimatedDaysMax") === ""
        ? undefined
        : formNumber(formData, "estimatedDaysMax"),
    orderCutoffTime: formValue(formData, "orderCutoffTime") || null,
    isActive: formCheckbox(formData, "isActive"),
    pincodes: pincodesRaw,
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const zone = await prisma.deliveryZone.create({
    data: {
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      description: parsed.data.description ?? null,
      deliveryFeeInPaise: parsed.data.deliveryFeeInPaise,
      minOrderAmountInPaise: parsed.data.minOrderAmountInPaise,
      estimatedDaysMin: parsed.data.estimatedDaysMin ?? null,
      estimatedDaysMax: parsed.data.estimatedDaysMax ?? null,
      orderCutoffTime: parsed.data.orderCutoffTime ?? null,
      isActive: parsed.data.isActive,
      createdById: actor.id,
      pincodes: {
        create: parsed.data.pincodes.map((pincode) => ({ pincode })),
      },
    },
  });

  await recordAudit({
    action: AuditAction.DELIVERY_ZONE_CREATED,
    entityType: "DeliveryZone",
    entityId: zone.id,
    summary: `Delivery zone "${zone.name}" created with ${parsed.data.pincodes.length} PIN code(s).`,
    actorId: actor.id,
    actorRole: actor.role.code,
    metadata: { name: zone.name, pincodes: parsed.data.pincodes },
  });

  revalidatePath("/admin/delivery");
  return { ok: true, message: `Zone "${zone.name}" created.` };
}

export async function toggleZoneAction(formData: FormData): Promise<void> {
  const actor = await authorize(PERMISSIONS.DELIVERY_ZONE_WRITE);
  const id = formValue(formData, "id");
  const isActive = formCheckbox(formData, "isActive");

  await prisma.deliveryZone.update({ where: { id }, data: { isActive, updatedById: actor.id } });

  await recordAudit({
    action: AuditAction.DELIVERY_ZONE_UPDATED,
    entityType: "DeliveryZone",
    entityId: id,
    summary: `Delivery zone ${isActive ? "activated" : "deactivated"}.`,
    actorId: actor.id,
    actorRole: actor.role.code,
  });

  revalidatePath("/admin/delivery");
}

export async function updateZoneFeeAction(formData: FormData): Promise<void> {
  const actor = await authorize(PERMISSIONS.DELIVERY_ZONE_WRITE);
  const id = formValue(formData, "id");
  const deliveryFeeInPaise = Math.round(formNumber(formData, "deliveryFee") * 100);
  const minOrderAmountInPaise = Math.round(formNumber(formData, "minOrderAmount") * 100);

  const zone = await prisma.deliveryZone.update({
    where: { id },
    data: { deliveryFeeInPaise, minOrderAmountInPaise, updatedById: actor.id },
  });

  await recordAudit({
    action: AuditAction.DELIVERY_ZONE_UPDATED,
    entityType: "DeliveryZone",
    entityId: id,
    summary: `Delivery charges updated for zone "${zone.name}".`,
    actorId: actor.id,
    actorRole: actor.role.code,
    metadata: { deliveryFeeInPaise, minOrderAmountInPaise },
  });

  revalidatePath("/admin/delivery");
}

export async function checkPincodeAction(formData: FormData): Promise<void> {
  await authorize(PERMISSIONS.DELIVERY_ZONE_WRITE);
  const pincode = formValue(formData, "pincode");
  // The quote is recomputed on the next render; the action exists so that the
  // check is an authorised server operation rather than a client-side guess.
  await quoteDelivery(pincode);
  revalidatePath("/admin/delivery");
}
