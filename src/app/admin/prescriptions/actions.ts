"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { prescriptionReviewSchema } from "@/lib/validation/commerce";
import { fieldErrors } from "@/lib/validation/common";
import { formValue } from "@/lib/validation/form";
import { reviewPrescription, PrescriptionError } from "@/lib/prescriptions/service";
import { PrescriptionDecision } from "@/generated/prisma/enums";

export type PrescriptionReviewState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function reviewPrescriptionAction(
  _prevState: PrescriptionReviewState,
  formData: FormData,
): Promise<PrescriptionReviewState> {
  // Only authorised pharmacy personnel may review a prescription.
  const actor = await authorize(PERMISSIONS.PRESCRIPTION_REVIEW);

  const validForDaysRaw = formValue(formData, "validForDays");
  const parsed = prescriptionReviewSchema.safeParse({
    requirementId: formValue(formData, "requirementId"),
    decision: formValue(formData, "decision"),
    reason: formValue(formData, "reason"),
    notes: formValue(formData, "notes"),
    validForDays: validForDaysRaw === "" ? undefined : Number(validForDaysRaw),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  try {
    await reviewPrescription({
      requirementId: parsed.data.requirementId,
      decision: parsed.data.decision as PrescriptionDecision,
      reason: parsed.data.reason ?? null,
      notes: parsed.data.notes ?? null,
      validForDays: parsed.data.validForDays ?? null,
      reviewerId: actor.id,
      reviewerRole: actor.role.code,
    });
  } catch (error) {
    if (error instanceof PrescriptionError) {
      return { errors: { decision: error.message } };
    }
    throw error;
  }

  const requestHeaders = await headers();
  const orderNumber = requestHeaders.get("x-order-number");

  revalidatePath("/admin/prescriptions");
  revalidatePath("/admin/orders");
  if (orderNumber) revalidatePath(`/admin/orders/${orderNumber}`);

  return {
    ok: true,
    message: `Prescription ${parsed.data.decision.toLowerCase()}.`,
  };
}
