import { prisma } from "@/lib/db";
import { authorize, AuthorizationError } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { getStorage } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { getClientIp, getUserAgent, jsonError } from "@/lib/security";

/**
 * Serves a prescription document to authorised pharmacy personnel.
 *
 * The document is never exposed through a public URL:
 *  - the route requires the `prescription:read` permission,
 *  - the access is written to the audit log,
 *  - the response is marked private and must not be cached.
 */

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/admin/prescriptions/[documentId]">,
) {
  const { documentId } = await ctx.params;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PRESCRIPTION_READ);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // An unauthorised request must not look like a server failure, and it
      // must not reveal whether the document exists.
      return jsonError(error.status, "forbidden", "You are not allowed to read this document.");
    }
    throw error;
  }

  const document = await prisma.prescriptionDocument.findUnique({
    where: { id: documentId },
    include: { order: { select: { orderNumber: true, userId: true } } },
  });

  if (!document || document.deletedAt) {
    return new Response("Not found", { status: 404 });
  }

  const storage = getStorage();
  const object = await storage.get(document.storageKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  await recordAudit({
    action: AuditAction.PRESCRIPTION_REVIEWED,
    entityType: "PrescriptionDocument",
    entityId: document.id,
    summary: `Prescription document opened for order ${document.order?.orderNumber ?? "unknown"}.`,
    actorId: actor.id,
    actorRole: actor.role.code,
    ipAddress: getClientIp(request.headers),
    userAgent: getUserAgent(request.headers),
    metadata: {
      documentId: document.id,
      orderId: document.orderId,
      bytes: document.bytes,
    },
  });

  return new Response(new Uint8Array(object.body), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(object.bytes),
      "Content-Disposition": `inline; filename="prescription"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
