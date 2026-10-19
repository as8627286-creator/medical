/**
 * Development helper: creates a session token for a user and prints it.
 *
 * Useful for smoke-testing authenticated pages with curl:
 *
 *   node --conditions=react-server --import tsx scripts/dev-session.ts admin@example.com
 *   curl -H "Cookie: ms_session=<token>" http://127.0.0.1:3000/admin
 *
 * Development only. It does not bypass any authorisation check: the token is a
 * normal session that the application resolves exactly like a browser cookie.
 */

import "dotenv/config";
import "server-only";
import { prisma } from "@/lib/db";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/session";

async function main() {
  const email = (process.argv[2] ?? "admin@example.com").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user with the email ${email}.`);
  }

  const token = generateSessionToken();
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log(token);
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
