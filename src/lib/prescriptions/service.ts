import "server-only";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import { AuditAction, PrescriptionDecision, PrescriptionStatus } from "@/generated/prisma/enums";
import { getStorage, STORAGE_NAMESPACE, buildKey } from "@/lib/storage";
import { processPrescriptionDocument, UploadValidationError } from "@/lib/media/uploads";

/**
 * Prescription workflow.
 *
 * States: NOT_REQUIRED -> AWAITING_UPLOAD -> PENDING_REVIEW -> APPROVED |
 * REJECTED | EXPIRED.
 *
 * Rules enforced here:
 *  - only a customer may upload a document for their own order,
 *  - only authorised pharmacy personnel may review a prescription,
 *  - an upload is never treated as approval: the document only moves the
 *    requirement to PENDING_REVIEW,
 *  - a prescription-required order cannot be dispatched until every
 *    requirement for that order is APPROVED,
 *  - documents are stored in the private namespace and are only served through
 *    an authorised, audited route.
 */

export class PrescriptionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PrescriptionError";
    this.code = code;
  }
}

export interface UploadResult {
  documentId: string;
  requirementId: string;
}

/**
 * Uploads a prescription document for an order and moves the matching
 * requirement to PENDING_REVIEW.
 */
export async function uploadPrescription(params: {
  orderId: string;
  userId: string;
  file: File;
  actorRole: string;
}): Promise<UploadResult> {
  const env = getEnv();
  const storage = getStorage();

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: { include: { prescriptionRequirement: true } },
    },
  });

  if (!order) throw new PrescriptionError("not_found", "Order not found.");
  if (order.userId !== params.userId) {
    throw new PrescriptionError("forbidden", "This order belongs to another account.");
  }

  const requirements = order.items
    .map((item) => item.prescriptionRequirement)
    .filter((requirement): requirement is NonNullable<typeof requirement> => Boolean(requirement));

  if (requirements.length === 0) {
    throw new PrescriptionError(
      "not_required",
      "This order does not need a prescription.",
    );
  }

  let processed;
  try {
    processed = await processPrescriptionDocument(params.file, {
      maxBytes: env.MAX_PRESCRIPTION_BYTES,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      throw new PrescriptionError(error.code, error.message);
    }
    throw error;
  }

  const documentId = crypto.randomUUID();
  const key = buildKey(
    STORAGE_NAMESPACE.PRESCRIPTIONS,
    params.userId,
    documentId,
    `${processed.baseName}.${processed.extension}`,
  );

  await storage.put(key, processed.bytes, processed.contentType);

  const retentionDays = 365 * 3;
  const document = await prisma.prescriptionDocument.create({
    data: {
      id: documentId,
      userId: params.userId,
      orderId: order.id,
      storageKey: key,
      originalFileName: params.file.name.slice(0, 200),
      mimeType: processed.contentType,
      bytes: processed.bytes.byteLength,
      sha256: processed.sha256,
      uploadedById: params.userId,
      retentionExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
    },
  });

  // Link the document to every requirement that is still waiting.
  for (const requirement of requirements) {
    await prisma.prescriptionRequirement.update({
      where: { id: requirement.id },
      data: {
        documentId: document.id,
        status: PrescriptionStatus.PENDING_REVIEW,
      },
    });
  }

  await recordAudit({
    action: AuditAction.PRESCRIPTION_UPLOADED,
    entityType: "PrescriptionDocument",
    entityId: document.id,
    summary: `Prescription uploaded for order ${order.orderNumber}.`,
    actorId: params.userId,
    actorRole: params.actorRole,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      bytes: document.bytes,
      contentType: document.mimeType,
    },
  });

  return { documentId: document.id, requirementId: requirements[0]!.id };
}

/**
 * Records a review decision. Only authorised personnel may call this.
 */
export async function reviewPrescription(params: {
  requirementId: string;
  decision: PrescriptionDecision;
  reason?: string | null;
  notes?: string | null;
  validForDays?: number | null;
  reviewerId: string;
  reviewerRole: string;
}): Promise<void> {
  const requirement = await prisma.prescriptionRequirement.findUnique({
    where: { id: params.requirementId },
    include: {
      orderItem: { include: { order: true } },
    },
  });

  if (!requirement) {
    throw new PrescriptionError("not_found", "Prescription requirement not found.");
  }

  if (requirement.status === PrescriptionStatus.APPROVED) {
    throw new PrescriptionError(
      "already_reviewed",
      "This prescription has already been approved.",
    );
  }

  const validUntil =
    params.decision === PrescriptionDecision.APPROVED && params.validForDays
      ? new Date(Date.now() + params.validForDays * 24 * 60 * 60 * 1000)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.prescriptionReview.create({
      data: {
        requirementId: requirement.id,
        documentId: requirement.documentId,
        decision: params.decision,
        reason: params.reason ?? null,
        notes: params.notes ?? null,
        reviewerId: params.reviewerId,
      },
    });

    await tx.prescriptionRequirement.update({
      where: { id: requirement.id },
      data: {
        status:
          params.decision === PrescriptionDecision.APPROVED
            ? PrescriptionStatus.APPROVED
            : PrescriptionStatus.REJECTED,
        validUntil,
        expiresAt: validUntil,
      },
    });

    // Recompute the approval state of the order.
    const items = await tx.orderItem.findMany({
      where: { orderId: requirement.orderItem.orderId },
      include: { prescriptionRequirement: true },
    });

    const requiresPrescription = items.some((item) => item.prescriptionRequired);
    const allApproved = items
      .filter((item) => item.prescriptionRequired)
      .every(
        (item) => item.prescriptionRequirement?.status === PrescriptionStatus.APPROVED,
      );

    await tx.order.update({
      where: { id: requirement.orderItem.orderId },
      data: {
        prescriptionsApproved: requiresPrescription ? allApproved : true,
        status:
          requiresPrescription && !allApproved
            ? "AWAITING_PRESCRIPTION_APPROVAL"
            : requirement.orderItem.order.status === "AWAITING_PRESCRIPTION_APPROVAL"
              ? "CONFIRMED"
              : requirement.orderItem.order.status,
        confirmedAt:
          requiresPrescription && !allApproved
            ? requirement.orderItem.order.confirmedAt
            : requirement.orderItem.order.confirmedAt ?? new Date(),
      },
    });
  });

  await recordAudit({
    action: AuditAction.PRESCRIPTION_REVIEWED,
    entityType: "PrescriptionRequirement",
    entityId: requirement.id,
    summary: `Prescription ${params.decision.toLowerCase()} for order ${
      requirement.orderItem.order.orderNumber
    }.`,
    actorId: params.reviewerId,
    actorRole: params.reviewerRole,
    metadata: {
      orderId: requirement.orderItem.orderId,
      decision: params.decision,
      reason: params.reason ?? null,
      validUntil: validUntil?.toISOString() ?? null,
    },
  });
}

export async function listPendingReviews() {
  return prisma.prescriptionRequirement.findMany({
    where: { status: PrescriptionStatus.PENDING_REVIEW },
    orderBy: { updatedAt: "asc" },
    include: {
      document: true,
      reviews: { orderBy: { createdAt: "desc" }, take: 1 },
      orderItem: {
        include: {
          order: {
            include: { user: { select: { fullName: true, email: true, phone: true } } },
          },
        },
      },
    },
  });
}

export async function listAllRequirements(status?: PrescriptionStatus) {
  return prisma.prescriptionRequirement.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      document: { select: { id: true, uploadedAt: true, mimeType: true, bytes: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 1, include: { reviewer: { select: { fullName: true } } } },
      orderItem: {
        include: {
          order: {
            select: { id: true, orderNumber: true, userId: true, status: true },
          },
        },
      },
    },
  });
}

/**
 * Marks prescriptions that are past their validity window as expired.
 * Called by the maintenance script and before an order is dispatched.
 */
export async function expireStalePrescriptions(): Promise<number> {
  const result = await prisma.prescriptionRequirement.updateMany({
    where: {
      status: PrescriptionStatus.APPROVED,
      validUntil: { lt: new Date() },
    },
    data: { status: PrescriptionStatus.EXPIRED },
  });
  return result.count;
}

/**
 * Returns true when every prescription-required item of the order is approved
 * and still valid.
 */
export async function orderIsClearedForDispatch(orderId: string): Promise<boolean> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: { prescriptionRequirement: true },
  });

  const required = items.filter((item) => item.prescriptionRequired);
  if (required.length === 0) return true;

  return required.every((item) => {
    const requirement = item.prescriptionRequirement;
    if (!requirement) return false;
    if (requirement.status !== PrescriptionStatus.APPROVED) return false;
    if (requirement.validUntil && requirement.validUntil.getTime() < Date.now()) return false;
    return true;
  });
}
