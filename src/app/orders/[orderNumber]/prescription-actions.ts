"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { uploadPrescription, PrescriptionError } from "@/lib/prescriptions/service";
import { formFile } from "@/lib/validation/form";

export type PrescriptionUploadState = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export async function uploadPrescriptionAction(
  _prevState: PrescriptionUploadState,
  formData: FormData,
): Promise<PrescriptionUploadState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Sign in to upload a prescription." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const file = formFile(formData, "prescription");

  if (!file) {
    return { error: "Choose a file to upload." };
  }

  try {
    await uploadPrescription({
      orderId,
      userId: user.id,
      file,
      actorRole: "CUSTOMER",
    });
  } catch (error) {
    if (error instanceof PrescriptionError) {
      return { error: error.message };
    }
    throw error;
  }

  const requestHeaders = await headers();
  const orderNumber = requestHeaders.get("x-order-number") ?? "";

  revalidatePath("/orders");
  if (orderNumber) revalidatePath(`/orders/${orderNumber}`);
  return { ok: true, message: "Prescription uploaded. A pharmacist will review it." };
}
