"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { storeSettingsSchema } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/common";
import { formCheckbox, formNumber, formValue } from "@/lib/validation/form";
import { ensureStoreSettings } from "@/lib/store/settings";

export type SettingsState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function saveSettingsAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await authorize(PERMISSIONS.SETTINGS_WRITE);

  const raw = {
    pharmacyName: formValue(formData, "pharmacyName"),
    legalName: formValue(formData, "legalName"),
    licenseNumber: formValue(formData, "licenseNumber"),
    pharmacistName: formValue(formData, "pharmacistName"),
    pharmacistRegistrationNumber: formValue(formData, "pharmacistRegistrationNumber"),
    addressLine1: formValue(formData, "addressLine1"),
    addressLine2: formValue(formData, "addressLine2"),
    city: formValue(formData, "city"),
    state: formValue(formData, "state"),
    pincode: formValue(formData, "pincode") || null,
    phone: formValue(formData, "phone") || null,
    email: formValue(formData, "email") || null,
    gstin: formValue(formData, "gstin"),
    aboutText: formValue(formData, "aboutText"),
    refundPolicyText: formValue(formData, "refundPolicyText"),
    deliveryPolicyText: formValue(formData, "deliveryPolicyText"),
    privacyPolicyText: formValue(formData, "privacyPolicyText"),
    supportEmail: formValue(formData, "supportEmail") || null,
    supportPhone: formValue(formData, "supportPhone") || null,
    businessHours: formValue(formData, "businessHours"),
    minOrderAmountInPaise: Math.round(formNumber(formData, "minOrderAmount") * 100),
    defaultDeliveryFeeInPaise: Math.round(formNumber(formData, "defaultDeliveryFee") * 100),
    codEnabled: formCheckbox(formData, "codEnabled"),
    codMinOrderAmountInPaise: Math.round(
      formNumber(formData, "codMinOrderAmount") * 100,
    ),
    codMaxOrderAmountInPaise:
      formValue(formData, "codMaxOrderAmount") === ""
        ? undefined
        : Math.round(formNumber(formData, "codMaxOrderAmount") * 100),
    salesEnabled: formCheckbox(formData, "salesEnabled"),
    livePaymentsEnabled: formCheckbox(formData, "livePaymentsEnabled"),
    complianceConfirmed: formCheckbox(formData, "complianceConfirmed"),
    maintenanceMode: formCheckbox(formData, "maintenanceMode"),
  };

  const parsed = storeSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  await ensureStoreSettings();

  const before = await prisma.storeSettings.findUnique({ where: { id: 1 } });

  await prisma.storeSettings.update({
    where: { id: 1 },
    data: {
      ...parsed.data,
      complianceConfirmedAt: parsed.data.complianceConfirmed
        ? (before?.complianceConfirmedAt ?? new Date())
        : null,
      complianceConfirmedById: parsed.data.complianceConfirmed
        ? (before?.complianceConfirmedById ?? actor.id)
        : null,
      updatedById: actor.id,
    },
  });

  await recordAudit({
    action: AuditAction.SETTINGS_UPDATED,
    entityType: "StoreSettings",
    entityId: "1",
    summary: "Store settings updated.",
    actorId: actor.id,
    actorRole: actor.role.code,
    metadata: {
      salesEnabled: parsed.data.salesEnabled,
      livePaymentsEnabled: parsed.data.livePaymentsEnabled,
      complianceConfirmed: parsed.data.complianceConfirmed,
      codEnabled: parsed.data.codEnabled,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true, message: "Settings saved." };
}
