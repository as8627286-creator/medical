/**
 * Development seed data.
 *
 * The products below are **placeholders**, not real catalogue entries. Names,
 * brands and manufacturers are clearly marked as sample data so that nobody
 * mistakes the development catalogue for a real product list. Replace the
 * catalogue with the pharmacy's real data through the admin area before use.
 *
 * The script is idempotent: it can be run repeatedly.
 */

import "dotenv/config";
import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import {
  ADMIN_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PHARMACIST_PERMISSIONS,
} from "@/lib/auth/rbac";
import { addProductImage } from "@/lib/catalogue/images";
import { buildSearchText } from "@/lib/catalogue/products";
import { DosageForm, LegalRestriction, SaleEligibility } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { AuditAction } from "@/generated/prisma/enums";

const DEV_PASSWORD = process.env.SEED_DEV_PASSWORD ?? "DevOnly#Password2026";

const CATEGORIES = [
  { name: "Analgesics & Antipyretics", slug: "analgesics-antipyretics", sortOrder: 1 },
  { name: "Antibiotics", slug: "antibiotics", sortOrder: 2 },
  { name: "Antacids & Digestives", slug: "antacids-digestives", sortOrder: 3 },
  { name: "Vitamins & Supplements", slug: "vitamins-supplements", sortOrder: 4 },
  { name: "Diabetes Care", slug: "diabetes-care", sortOrder: 5 },
  { name: "Respiratory", slug: "respiratory", sortOrder: 6 },
  { name: "First Aid", slug: "first-aid", sortOrder: 7 },
  { name: "Baby Care", slug: "baby-care", sortOrder: 8 },
];

interface SeedProduct {
  sku: string;
  name: string;
  brand: string;
  manufacturer: string;
  strength: string;
  dosageForm: DosageForm;
  packSize: string;
  packUnit: string;
  priceRupees: number;
  mrpRupees: number;
  taxPercent: number;
  stock: number;
  lowStockThreshold: number;
  categorySlug: string;
  prescriptionRequired: boolean;
  saleEligibility: SaleEligibility;
  legalRestriction: LegalRestriction;
  description: string;
  warnings: string;
  usageInformation: string;
  storageInstructions: string;
}

const PRODUCTS: SeedProduct[] = [
  {
    sku: "DEMO-ANLG-001",
    name: "Sample Analgesic Tablet 500 mg",
    brand: "Demo Brand",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "500 mg",
    dosageForm: DosageForm.TABLET,
    packSize: "10",
    packUnit: "tablets",
    priceRupees: 12.5,
    mrpRupees: 15,
    taxPercent: 12,
    stock: 240,
    lowStockThreshold: 30,
    categorySlug: "analgesics-antipyretics",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description:
      "Development placeholder. Replace this text with the description printed on the pack.",
    warnings:
      "Development placeholder. Replace with the warnings printed on the pack before this product is offered for sale.",
    usageInformation:
      "Development placeholder. Replace with the usage instructions printed on the pack.",
    storageInstructions: "Store in a cool, dry place, away from direct sunlight.",
  },
  {
    sku: "DEMO-ANLG-002",
    name: "Sample Antipyretic Syrup 100 ml",
    brand: "Demo Brand",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "60 ml/5 ml",
    dosageForm: DosageForm.SYRUP,
    packSize: "100",
    packUnit: "ml",
    priceRupees: 38,
    mrpRupees: 42,
    taxPercent: 12,
    stock: 64,
    lowStockThreshold: 20,
    categorySlug: "analgesics-antipyretics",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product used to exercise the storefront.",
    warnings: "Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store below 25 C, away from direct sunlight.",
  },
  {
    sku: "DEMO-ANTB-001",
    name: "Sample Antibiotic Capsule 250 mg",
    brand: "Demo Pharma",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "250 mg",
    dosageForm: DosageForm.CAPSULE,
    packSize: "10",
    packUnit: "capsules",
    priceRupees: 56.5,
    mrpRupees: 68,
    taxPercent: 12,
    stock: 85,
    lowStockThreshold: 15,
    categorySlug: "antibiotics",
    prescriptionRequired: true,
    saleEligibility: SaleEligibility.PRESCRIPTION_REQUIRED,
    legalRestriction: LegalRestriction.PRESCRIPTION_ONLY,
    description: "Development placeholder for a prescription-only product.",
    warnings:
      "Development placeholder. Prescription-only product: dispensed only against a valid prescription reviewed by a pharmacist.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store in a cool, dry place, away from direct sunlight.",
  },
  {
    sku: "DEMO-ANAC-001",
    name: "Sample Antacid Suspension 170 ml",
    brand: "Demo Care",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "400 mg/10 ml",
    dosageForm: DosageForm.SUSPENSION,
    packSize: "170",
    packUnit: "ml",
    priceRupees: 44,
    mrpRupees: 49,
    taxPercent: 12,
    stock: 42,
    lowStockThreshold: 25,
    categorySlug: "antacids-digestives",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Do not refrigerate. Shake well before use.",
  },
  {
    sku: "DEMO-VTMB-001",
    name: "Sample Vitamin D3 Tablet 60,000 IU",
    brand: "Demo Nutri",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "60,000 IU",
    dosageForm: DosageForm.TABLET,
    packSize: "4",
    packUnit: "tablets",
    priceRupees: 189,
    mrpRupees: 210,
    taxPercent: 12,
    stock: 18,
    lowStockThreshold: 20,
    categorySlug: "vitamins-supplements",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store in a cool, dry place, away from direct sunlight.",
  },
  {
    sku: "DEMO-DIAB-001",
    name: "Sample Blood Glucose Test Strip",
    brand: "Demo Diag",
    manufacturer: "Demo Diagnostics (sample data)",
    strength: "50 strips",
    dosageForm: DosageForm.OTHER,
    packSize: "1",
    packUnit: "strip pack",
    priceRupees: 425,
    mrpRupees: 480,
    taxPercent: 5,
    stock: 9,
    lowStockThreshold: 12,
    categorySlug: "diabetes-care",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store in the original packaging, away from moisture.",
  },
  {
    sku: "DEMO-RESP-001",
    name: "Sample Inhaler 200 mcg",
    brand: "Demo Breathe",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "200 mcg/dose",
    dosageForm: DosageForm.INHALER,
    packSize: "1",
    packUnit: "inhaler",
    priceRupees: 265,
    mrpRupees: 299,
    taxPercent: 12,
    stock: 26,
    lowStockThreshold: 10,
    categorySlug: "respiratory",
    prescriptionRequired: true,
    saleEligibility: SaleEligibility.PRESCRIPTION_REQUIRED,
    legalRestriction: LegalRestriction.PRESCRIPTION_ONLY,
    description: "Development placeholder for a prescription-only product.",
    warnings: "Development placeholder. Dispensed only against a valid prescription.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Keep the inhaler protected from light.",
  },
  {
    sku: "DEMO-FAID-001",
    name: "Sample Antiseptic Cream 20 g",
    brand: "Demo Care",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "2% w/w",
    dosageForm: DosageForm.CREAM,
    packSize: "20",
    packUnit: "g",
    priceRupees: 34,
    mrpRupees: 39,
    taxPercent: 12,
    stock: 120,
    lowStockThreshold: 25,
    categorySlug: "first-aid",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "For external use only. Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store below 25 C.",
  },
  {
    sku: "DEMO-BABY-001",
    name: "Sample Baby Diaper Pants (Medium)",
    brand: "Demo Baby",
    manufacturer: "Demo Consumer Care (sample data)",
    strength: "9-14 kg",
    dosageForm: DosageForm.OTHER,
    packSize: "1",
    packUnit: "pack of 22",
    priceRupees: 299,
    mrpRupees: 349,
    taxPercent: 18,
    stock: 35,
    lowStockThreshold: 15,
    categorySlug: "baby-care",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Keep dry and away from direct sunlight.",
  },
  {
    sku: "DEMO-ANLG-003",
    name: "Sample Pain Relief Gel 50 g",
    brand: "Demo Care",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "Topical",
    dosageForm: DosageForm.GEL,
    packSize: "50",
    packUnit: "g",
    priceRupees: 118,
    mrpRupees: 135,
    taxPercent: 12,
    stock: 14,
    lowStockThreshold: 15,
    categorySlug: "analgesics-antipyretics",
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    description: "Development placeholder product.",
    warnings: "For external use only. Development placeholder warning text.",
    usageInformation: "Development placeholder usage text.",
    storageInstructions: "Store below 25 C.",
  },
  {
    sku: "DEMO-CTLD-001",
    name: "Sample Scheduled Product (not for online sale)",
    brand: "Demo Restricted",
    manufacturer: "Demo Pharmaceuticals (sample data)",
    strength: "Not applicable",
    dosageForm: DosageForm.TABLET,
    packSize: "10",
    packUnit: "tablets",
    priceRupees: 90,
    mrpRupees: 100,
    taxPercent: 12,
    stock: 5,
    lowStockThreshold: 0,
    categorySlug: "antibiotics",
    prescriptionRequired: true,
    saleEligibility: SaleEligibility.NOT_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.PROHIBITED_FOR_ONLINE_SALE,
    description:
      "Development placeholder used to verify that legally restricted products never reach the storefront.",
    warnings: "Not available for online sale.",
    usageInformation: "Not applicable.",
    storageInstructions: "Not applicable.",
  },
];

/** Creates a simple placeholder image so the gallery is not empty. */
async function placeholderImage(label: string): Promise<File> {
  const { default: sharp } = await import("sharp");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <rect width="800" height="800" fill="#e2e8f0"/>
  <rect x="40" y="40" width="720" height="720" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
  <text x="400" y="380" font-family="sans-serif" font-size="180" fill="#94a3b8" text-anchor="middle">+</text>
  <text x="400" y="500" font-family="sans-serif" font-size="46" fill="#64748b" text-anchor="middle">${label}</text>
  <text x="400" y="570" font-family="sans-serif" font-size="30" fill="#94a3b8" text-anchor="middle">sample image</text>
</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return new File([new Uint8Array(buffer)], "placeholder.png", { type: "image/png" });
}

async function ensureRole(code: "ADMIN" | "PHARMACIST" | "CUSTOMER", permissions: string[]) {
  const names = {
    ADMIN: ["Administrator", "Full access to the administration area."],
    PHARMACIST: [
      "Pharmacist",
      "May manage the catalogue, review prescriptions and fulfil orders.",
    ],
    CUSTOMER: ["Customer", "A customer of the pharmacy."],
  } as const;
  return prisma.role.upsert({
    where: { code },
    update: { permissions },
    create: { code, name: names[code][0], description: names[code][1], permissions, isSystem: true },
  });
}

async function main() {
  const passwordProblems = validatePasswordStrength(DEV_PASSWORD);
  if (passwordProblems.length > 0) {
    throw new Error(
      `SEED_DEV_PASSWORD is too weak: it must ${passwordProblems.join(", ")}.`,
    );
  }

  const adminRole = await ensureRole("ADMIN", ADMIN_PERMISSIONS);
  const pharmacistRole = await ensureRole("PHARMACIST", PHARMACIST_PERMISSIONS);
  const customerRole = await ensureRole("CUSTOMER", CUSTOMER_PERMISSIONS);

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@example.com" } })) ??
    (await prisma.user.create({
      data: {
        email: "admin@example.com",
        fullName: "Store Owner",
        passwordHash: await hashPassword(DEV_PASSWORD),
        roleId: adminRole.id,
      },
    }));

  // The development accounts always use the documented development password so
  // that a fresh checkout behaves predictably. Never use this script against a
  // database that holds real accounts.
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(DEV_PASSWORD), roleId: adminRole.id },
  });

  const pharmacist =
    (await prisma.user.findUnique({ where: { email: "pharmacist@example.com" } })) ??
    (await prisma.user.create({
      data: {
        email: "pharmacist@example.com",
        fullName: "Duty Pharmacist",
        passwordHash: await hashPassword(DEV_PASSWORD),
        roleId: pharmacistRole.id,
      },
    }));

  await prisma.user.update({
    where: { id: pharmacist.id },
    data: { passwordHash: await hashPassword(DEV_PASSWORD), roleId: pharmacistRole.id },
  });

  const customer =
    (await prisma.user.findUnique({ where: { email: "customer@example.com" } })) ??
    (await prisma.user.create({
      data: {
        email: "customer@example.com",
        fullName: "Sample Customer",
        phone: "9000000000",
        passwordHash: await hashPassword(DEV_PASSWORD),
        roleId: customerRole.id,
      },
    }));

  await prisma.user.update({
    where: { id: customer.id },
    data: { passwordHash: await hashPassword(DEV_PASSWORD), roleId: customerRole.id },
  });

  for (const user of [admin, pharmacist, customer]) {
    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: { name: category.name, slug: category.slug, sortOrder: category.sortOrder },
    });
    categoryIds.set(category.slug, row.id);
  }

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug ${product.categorySlug}`);

    const searchText = buildSearchText(product);
    const existing = await prisma.product.findUnique({ where: { sku: product.sku } });

    const row = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: product.name,
            brand: product.brand,
            manufacturer: product.manufacturer,
            strength: product.strength,
            dosageForm: product.dosageForm,
            packSize: product.packSize,
            packUnit: product.packUnit,
            description: product.description,
            warnings: product.warnings,
            usageInformation: product.usageInformation,
            storageInstructions: product.storageInstructions,
            sellingPriceInPaise: Math.round(product.priceRupees * 100),
            mrpInPaise: Math.round(product.mrpRupees * 100),
            taxPercent: product.taxPercent,
            stockQuantity: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            categoryId,
            prescriptionRequired: product.prescriptionRequired,
            saleEligibility: product.saleEligibility,
            legalRestriction: product.legalRestriction,
            searchText,
            updatedById: admin.id,
          },
        })
      : await prisma.product.create({
          data: {
            sku: product.sku,
            name: product.name,
            brand: product.brand,
            manufacturer: product.manufacturer,
            strength: product.strength,
            dosageForm: product.dosageForm,
            packSize: product.packSize,
            packUnit: product.packUnit,
            description: product.description,
            warnings: product.warnings,
            usageInformation: product.usageInformation,
            storageInstructions: product.storageInstructions,
            sellingPriceInPaise: Math.round(product.priceRupees * 100),
            mrpInPaise: Math.round(product.mrpRupees * 100),
            taxPercent: product.taxPercent,
            stockQuantity: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            categoryId,
            prescriptionRequired: product.prescriptionRequired,
            saleEligibility: product.saleEligibility,
            legalRestriction: product.legalRestriction,
            searchText,
            createdById: admin.id,
            updatedById: admin.id,
          },
        });

    if (!existing) {
      await prisma.inventoryAdjustment.create({
        data: {
          productId: row.id,
          delta: product.stock,
          stockAfter: product.stock,
          reason: "CORRECTION",
          note: "Opening stock from the development seed.",
          createdById: admin.id,
        },
      });
      await prisma.priceHistory.create({
        data: {
          productId: row.id,
          previousPriceInPaise: Math.round(product.priceRupees * 100),
          newPriceInPaise: Math.round(product.priceRupees * 100),
          previousMrpInPaise: Math.round(product.mrpRupees * 100),
          newMrpInPaise: Math.round(product.mrpRupees * 100),
          reason: "Initial price from the development seed.",
          changedById: admin.id,
        },
      });
    }

    const imageCount = await prisma.productImage.count({ where: { productId: row.id } });
    if (imageCount === 0) {
      const file = await placeholderImage(product.sku.slice(0, 12));
      await addProductImage({
        productId: row.id,
        file,
        altText: `${product.name} - placeholder product photo`,
        actor: { id: admin.id, role: "ADMIN" },
      });
    }
  }

  const zone = await prisma.deliveryZone.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Sample central zone",
      city: "Sample City",
      description: "Development sample zone. Replace with the pharmacy's real serviceable areas.",
      deliveryFeeInPaise: 5000,
      minOrderAmountInPaise: 20000,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      isActive: true,
      createdById: admin.id,
    },
  });

  for (const pincode of ["560001", "560002", "560003"]) {
    await prisma.deliveryZonePincode.upsert({
      where: { pincode },
      update: { zoneId: zone.id },
      create: { pincode, zoneId: zone.id, city: "Sample City" },
    });
  }

  const existingSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!existingSettings) {
    await prisma.storeSettings.create({
      data: {
        id: 1,
        pharmacyName: "Demo Medical Store",
        legalName: "Demo Medical Store (development data)",
        aboutText:
          "Development storefront with sample data. Replace every value here with the pharmacy's real details before going live.",
        refundPolicyText:
          "Development placeholder policy. Medicines that have been dispensed cannot be returned or exchanged.",
        deliveryPolicyText:
          "Development placeholder policy. Delivery is available to serviceable PIN codes only.",
        privacyPolicyText:
          "Development placeholder policy. Customer and prescription data is kept private and is only accessible to authorised pharmacy personnel.",
        minOrderAmountInPaise: 20000,
        defaultDeliveryFeeInPaise: 5000,
        codEnabled: true,
        codMinOrderAmountInPaise: 0,
        salesEnabled: false,
        livePaymentsEnabled: false,
        complianceConfirmed: false,
        updatedById: admin.id,
      },
    });
  }

  await recordAudit({
    action: AuditAction.SETTINGS_UPDATED,
    entityType: "Store",
    entityId: "seed",
    summary: "Development seed data applied.",
    actorId: admin.id,
    actorRole: "ADMIN",
  });

  console.log("Seed complete.");
  console.log("Development accounts (password: the value of SEED_DEV_PASSWORD):");
  console.log("  admin@example.com       (ADMIN)");
  console.log("  pharmacist@example.com  (PHARMACIST)");
  console.log("  customer@example.com    (CUSTOMER)");
  console.log("");
  console.log("These accounts are for local development only. Remove them before any deployment.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
