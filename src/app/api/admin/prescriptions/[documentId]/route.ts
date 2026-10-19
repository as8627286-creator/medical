import { prisma } from "@/lib/db";
import { authorize } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { getStorage } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";
import { getClientIp, getUserAgent } from "@/lib/security";

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

  const actor = await authorize(PERMISSIONS.PRESCRIPTION_READ);

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
