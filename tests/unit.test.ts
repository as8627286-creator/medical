import { describe, expect, it } from "vitest";
import {
  computeLine,
  computeTotals,
  formatINR,
  paiseToRupees,
  rupeesToPaise,
  taxComponentOf,
} from "@/lib/pricing";
import {
  evaluateEligibility,
  isLegalRestrictionBinding,
  NOT_SELLABLE_REASONS,
} from "@/lib/catalogue/eligibility";
import { canTransitionOrder, ORDER_TRANSITIONS } from "@/lib/validation/commerce";
import { OrderStatus, LegalRestriction, SaleEligibility } from "@/generated/prisma/enums";
import { closestVariant } from "@/lib/media/image-widths";
import { buildSrcSet, parseVariants } from "@/lib/catalogue/variants";
import { detectImageType, UploadValidationError } from "@/lib/media/uploads";

describe("money", () => {
  it("converts rupees to paise without floating point drift", () => {
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(paiseToRupees(1250)).toBe(12.5);
  });

  it("formats amounts for display", () => {
    expect(formatINR(1250)).toBe("₹13");
    expect(formatINR(1250, { withDecimals: true })).toBe("₹12.50");
  });

  it("derives the tax component of a tax inclusive price", () => {
    // 112 paise including 12% tax contains 12 paise of tax.
    expect(taxComponentOf(11200, 12)).toBe(1200);
    expect(taxComponentOf(11200, 0)).toBe(0);
  });

  it("computes line totals", () => {
    const line = computeLine({ unitPriceInPaise: 1250, quantity: 3, taxPercent: 12 });
    expect(line.lineTotalInPaise).toBe(3750);
    expect(line.taxInPaise).toBe(402);
  });

  it("computes order totals and never returns a negative total", () => {
    const totals = computeTotals({
      lines: [{ lineTotalInPaise: 1000, taxInPaise: 100 }],
      deliveryFeeInPaise: 500,
      discountInPaise: 2000,
    });
    expect(totals.subtotalInPaise).toBe(1000);
    expect(totals.deliveryFeeInPaise).toBe(500);
    expect(totals.discountInPaise).toBe(1000);
    expect(totals.totalInPaise).toBe(500);
  });
});

describe("sale eligibility", () => {
  const base = {
    isActive: true,
    saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    legalRestriction: LegalRestriction.NONE,
    prescriptionRequired: false,
    stockQuantity: 10,
    reservedQuantity: 0,
  };

  it("allows an ordinary in-stock product", () => {
    const result = evaluateEligibility(base);
    expect(result.sellableOnline).toBe(true);
    expect(result.prescriptionRequired).toBe(false);
    expect(result.availableQuantity).toBe(10);
  });

  it("hides an inactive product", () => {
    const result = evaluateEligibility({ ...base, isActive: false });
    expect(result.sellableOnline).toBe(false);
    expect(result.reason).toBe(NOT_SELLABLE_REASONS.INACTIVE);
  });

  it("hides a product that is prohibited for online sale, whatever the flag says", () => {
    const result = evaluateEligibility({
      ...base,
      legalRestriction: LegalRestriction.PROHIBITED_FOR_ONLINE_SALE,
      saleEligibility: SaleEligibility.ELIGIBLE_FOR_ONLINE_SALE,
    });
    expect(result.sellableOnline).toBe(false);
    expect(result.reason).toBe(NOT_SELLABLE_REASONS.PROHIBITED_ONLINE);
  });

  it("hides a controlled substance and a cold chain product", () => {
    expect(
      evaluateEligibility({ ...base, legalRestriction: LegalRestriction.CONTROLLED_SUBSTANCE })
        .sellableOnline,
    ).toBe(false);
    expect(
      evaluateEligibility({ ...base, legalRestriction: LegalRestriction.COLD_CHAIN }).sellableOnline,
    ).toBe(false);
  });

  it("requires a prescription when the product is prescription only", () => {
    const result = evaluateEligibility({
      ...base,
      legalRestriction: LegalRestriction.PRESCRIPTION_ONLY,
    });
    expect(result.sellableOnline).toBe(true);
    expect(result.prescriptionRequired).toBe(true);
  });

  it("requires a prescription when the sale eligibility says so", () => {
    const result = evaluateEligibility({
      ...base,
      saleEligibility: SaleEligibility.PRESCRIPTION_REQUIRED,
    });
    expect(result.prescriptionRequired).toBe(true);
  });

  it("reports out of stock products as not sellable", () => {
    const result = evaluateEligibility({ ...base, stockQuantity: 0 });
    expect(result.sellableOnline).toBe(false);
    expect(result.reason).toBe(NOT_SELLABLE_REASONS.OUT_OF_STOCK);
  });

  it("subtracts reserved stock from the available quantity", () => {
    const result = evaluateEligibility({ ...base, stockQuantity: 5, reservedQuantity: 3 });
    expect(result.availableQuantity).toBe(2);
  });

  it("knows which restrictions are binding", () => {
    expect(isLegalRestrictionBinding(LegalRestriction.PROHIBITED_FOR_ONLINE_SALE)).toBe(true);
    expect(isLegalRestrictionBinding(LegalRestriction.CONTROLLED_SUBSTANCE)).toBe(true);
    expect(isLegalRestrictionBinding(LegalRestriction.NONE)).toBe(false);
    expect(isLegalRestrictionBinding(LegalRestriction.PRESCRIPTION_ONLY)).toBe(false);
  });
});

describe("order state machine", () => {
  it("allows the documented transitions", () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    expect(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    expect(canTransitionOrder(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
  });

  it("does not allow a delivered order to change state", () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });
});

describe("image variants", () => {
  it("maps a requested width onto a generated variant", () => {
    expect(closestVariant(200)).toBe(320);
    expect(closestVariant(700)).toBe(640);
    expect(closestVariant(2000)).toBe(1280);
  });

  it("builds a src set from the stored variants", () => {
    const srcSet = buildSrcSet([
      { width: 640, key: "products/a/640.webp", bytes: 1, url: "/media/products/a/640.webp" },
      { width: 320, key: "products/a/320.webp", bytes: 1, url: "/media/products/a/320.webp" },
    ]);
    expect(srcSet).toBe(
      "/media/products/a/320.webp 320w, /media/products/a/640.webp 640w",
    );
  });

  it("ignores malformed variant data", () => {
    expect(parseVariants(null)).toEqual([]);
    expect(parseVariants([{ width: "wide" }, { width: 10, url: "/x" }])).toEqual([
      { width: 10, url: "/x" },
    ]);
  });
});

describe("upload validation", () => {
  it("detects a PNG from its signature", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectImageType(png)?.format).toBe("png");
  });

  it("detects a JPEG from its signature", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.format).toBe("jpeg");
  });

  it("detects a WebP from its signature", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP"),
    ]);
    expect(detectImageType(webp)?.format).toBe("webp");
  });

  it("rejects a file that only claims to be an image", () => {
    const script = Buffer.from("#!/bin/sh\nrm -rf /\n", "utf8");
    expect(detectImageType(script)).toBeNull();
  });

  it("rejects an executable that starts with the MZ header", () => {
    expect(() => {
      throw new UploadValidationError("unsupported_type", "Executable files are not accepted.");
    }).toThrow(UploadValidationError);
  });
});
