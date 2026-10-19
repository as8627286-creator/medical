import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/db";
import {
  createProduct,
  updateProduct,
  changePrice,
  adjustStock,
  setProductActive,
  ProductWriteError,
} from "@/lib/catalogue/write";
import { addProductImage, ImageWriteError } from "@/lib/catalogue/images";
import { evaluateEligibility } from "@/lib/catalogue/eligibility";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_PERMISSIONS, CUSTOMER_PERMISSIONS, PHARMACIST_PERMISSIONS } from "@/lib/auth/rbac";
import { DosageForm, SaleEligibility } from "@/generated/prisma/enums";

const actor = { id: "", role: "ADMIN" };

async function seedBasics() {
  const role = await prisma.role.create({
    data: { code: "ADMIN", name: "Administrator", permissions: ADMIN_PERMISSIONS, isSystem: true },
  });
  const user = await prisma.user.create({
    data: {
      email: "admin@test.local",
      fullName: "Test Admin",
      passwordHash: await hashPassword("TestPassword#2026"),
      roleId: role.id,
    },
  });
  const category = await prisma.productCategory.create({
    data: { name: "Test category", slug: "test-category" },
  });
  actor.id = user.id;
  return { user, category };
}

function productInput(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Analgesic 500 mg",
    brand: "Test Brand",
    manufacturer: "Test Manufacturer",
    strength: "500 mg",
    dosageForm: DosageForm.TABLET,
    packSize: "10",
    packUnit: "tablets",
    sku: "TEST-001",
    description: null,
    warnings: null,
    usageInformation: null,
    storageInstructions: null,
    additionalInfo: null,
    mrpInPaise: 1500,
    sellingPriceInPaise: 1250,
    taxPercent: 12,
    stockQuantity: 100,
    lowStockThreshold: 10,
    categoryId,
    prescriptionRequired: false,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    isActive: true,
    ...overrides,
  } as never;
}

describe("catalogue writes", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedBasics();
  });

  it("creates a product with an opening price history and stock record", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    expect(product.sku).toBe("TEST-001");
    expect(product.sellingPriceInPaise).toBe(1250);

    const priceHistory = await prisma.priceHistory.findMany({
      where: { productId: product.id },
    });
    expect(priceHistory).toHaveLength(1);
    expect(priceHistory[0]!.newPriceInPaise).toBe(1250);

    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: { productId: product.id },
    });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]!.stockAfter).toBe(100);
  });

  it("rejects a duplicate SKU", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    await createProduct(productInput(category.id), actor);
    await expect(createProduct(productInput(category.id), actor)).rejects.toBeInstanceOf(
      ProductWriteError,
    );
  });

  it("records a price change with the previous price, the new price and the actor", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    await changePrice(
      {
        productId: product.id,
        sellingPriceInPaise: 990,
        mrpInPaise: 1200,
        reason: "Supplier price change",
      },
      actor,
    );

    const history = await prisma.priceHistory.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history[1]!.previousPriceInPaise).toBe(1250);
    expect(history[1]!.newPriceInPaise).toBe(990);
    expect(history[1]!.changedById).toBe(actor.id);
    expect(history[1]!.createdAt).toBeInstanceOf(Date);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.sellingPriceInPaise).toBe(990);
  });

  it("records a stock adjustment with the reason and the resulting level", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    const result = await adjustStock(
      { productId: product.id, delta: -5, reason: "DAMAGE", note: "Broken pack" },
      actor,
    );
    expect(result.stockQuantity).toBe(95);

    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "asc" },
    });
    expect(adjustments).toHaveLength(2);
    expect(adjustments[1]!.delta).toBe(-5);
    expect(adjustments[1]!.reason).toBe("DAMAGE");
    expect(adjustments[1]!.stockAfter).toBe(95);
    expect(adjustments[1]!.createdById).toBe(actor.id);
  });

  it("refuses an adjustment that would make the stock negative", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    await expect(
      adjustStock({ productId: product.id, delta: -1000, reason: "DAMAGE" }, actor),
    ).rejects.toBeInstanceOf(ProductWriteError);
  });

  it("keeps the search text in step with the product fields", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);
    expect(product.searchText).toContain("test analgesic");

    await updateProduct(
      { id: product.id, name: "Renamed Product 10 mg" },
      actor,
    );
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.searchText).toContain("renamed product");
  });

  it("deactivates a product so that it leaves the storefront", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    await setProductActive(product.id, false, actor);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const eligibility = evaluateEligibility({
      isActive: updated.isActive,
      saleEligibility: updated.saleEligibility,
      legalRestriction: updated.legalRestriction,
      prescriptionRequired: updated.prescriptionRequired,
      stockQuantity: updated.stockQuantity,
      reservedQuantity: updated.reservedQuantity,
    });
    expect(eligibility.sellableOnline).toBe(false);
  });
});

describe("product photo validation", () => {
  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedBasics();
  });

  it("rejects a file that is not an image", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    const file = new File([new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e])], "evil.sh", {
      type: "application/x-sh",
    });

    await expect(addProductImage({ productId: product.id, file, actor })).rejects.toBeInstanceOf(
      ImageWriteError,
    );

    const images = await prisma.productImage.count({ where: { productId: product.id } });
    expect(images).toBe(0);
  });

  it("rejects a file whose content does not match the declared type", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([new Uint8Array(png)], "photo.png", { type: "image/gif" });

    await expect(addProductImage({ productId: product.id, file, actor })).rejects.toBeInstanceOf(
      ImageWriteError,
    );
  });

  it("stores a valid image under a generated name", async () => {
    const category = await prisma.productCategory.findFirstOrThrow();
    const product = await createProduct(productInput(category.id), actor);

    const sharp = (await import("sharp")).default;
    const buffer = await sharp({
      create: { width: 200, height: 200, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();

    const file = new File([new Uint8Array(buffer)], "photo.png", { type: "image/png" });
    const result = await addProductImage({ productId: product.id, file, actor });

    expect(result.url).toMatch(/^\/media\/products\//);
    // The uploaded file name is never used.
    expect(result.url).not.toContain("photo");
  });
});

describe("roles", () => {
  it("does not give a customer any administrative permission", () => {
    expect(CUSTOMER_PERMISSIONS).toHaveLength(0);
  });

  it("lets a pharmacist review prescriptions but not change legal restrictions", () => {
    expect(PHARMACIST_PERMISSIONS).toContain("prescription:review");
    expect(PHARMACIST_PERMISSIONS).not.toContain("product:legal_restriction");
  });

  it("gives an administrator every permission", () => {
    expect(ADMIN_PERMISSIONS).toContain("product:legal_restriction");
    expect(ADMIN_PERMISSIONS).toContain("settings:write");
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
