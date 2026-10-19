/**
 * Creates the first administrator account.
 *
 * The password is read from standard input (never from a command-line
 * argument, which would be visible in the process list) and is never written
 * to disk or logged.
 *
 * Run through `npm run admin:bootstrap`, which handles the interactive prompt
 * and pipes the password in.
 */

import "dotenv/config";
import "server-only";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { ALL_PERMISSIONS, ADMIN_PERMISSIONS, CUSTOMER_PERMISSIONS, PHARMACIST_PERMISSIONS } from "@/lib/auth/rbac";
import { AuditAction } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const fullName = (arg("name") ?? "").trim();
  const password = readFileSync(0, "utf8").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("A valid --email is required.");
  }
  if (fullName.length < 2) {
    throw new Error("A --name is required.");
  }
  if (!password) {
    throw new Error("The administrator password is required (read from stdin).");
  }

  const problems = validatePasswordStrength(password);
  if (problems.length > 0) {
    throw new Error(`The password is too weak: it must ${problems.join(", ")}.`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`An account with the email ${email} already exists.`);
  }

  const [adminRole, pharmacistRole, customerRole] = await Promise.all([
    prisma.role.upsert({
      where: { code: "ADMIN" },
      update: { permissions: ADMIN_PERMISSIONS },
      create: {
        code: "ADMIN",
        name: "Administrator",
        description: "Full access to the administration area.",
        permissions: ADMIN_PERMISSIONS,
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { code: "PHARMACIST" },
      update: { permissions: PHARMACIST_PERMISSIONS },
      create: {
        code: "PHARMACIST",
        name: "Pharmacist",
        description: "May manage the catalogue, review prescriptions and fulfil orders.",
        permissions: PHARMACIST_PERMISSIONS,
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { code: "CUSTOMER" },
      update: { permissions: CUSTOMER_PERMISSIONS },
      create: {
        code: "CUSTOMER",
        name: "Customer",
        description: "A customer of the pharmacy.",
        permissions: CUSTOMER_PERMISSIONS,
        isSystem: true,
      },
    }),
  ]);

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await hashPassword(password),
      roleId: adminRole.id,
      isActive: true,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.customerProfile.create({ data: { userId: user.id } });

  await recordAudit({
    action: AuditAction.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    summary: `Administrator account created for ${email} through the bootstrap command.`,
    actorId: user.id,
    actorRole: "ADMIN",
    metadata: { email, role: "ADMIN" },
  });

  console.log(`Administrator created: ${email}`);
  console.log(`Roles available: ADMIN, PHARMACIST, CUSTOMER (pharmacist id ${pharmacistRole.id}, customer id ${customerRole.id})`);
  console.log("All permissions:", ALL_PERMISSIONS.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    await prisma.$disconnect();
    process.exit(1);
  });
