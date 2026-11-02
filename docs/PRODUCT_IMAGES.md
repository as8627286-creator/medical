# Product photos

This document describes where the product photos in the development build come
from, what they are used for, and what has to happen before the storefront is
used for real orders.

## The development photos

The development catalogue contains placeholder products ("Sample Analgesic
Tablet 500 mg", "Demo Brand", "Demo Pharmaceuticals"). The seed script gives
each of them a generated placeholder photo: a grey card with a plus sign.

The photos in the development build are **real pack shots of real medicines**,
fetched from public 1mg.com product pages. They make the storefront look like a
pharmacy instead of a wireframe, and they make the image pipeline (upload,
re-encoding, responsive variants, gallery, media route) testable with real
photography.

| Catalogue product (placeholder) | Photo shows (real product) |
| --- | --- |
| Sample Analgesic Tablet 500 mg | Dolo 650 Tablet |
| Sample Antipyretic Syrup 100 ml | Dolopar 250 Suspension |
| Sample Antibiotic Capsule 250 mg | Campicillin 250 Capsule |
| Sample Antacid Suspension 170 ml | Kantacid Oral Suspension |
| Sample Vitamin D3 Tablet 60,000 IU | Tayo 60K Chewable Tablet |
| Sample Blood Glucose Test Strip | Aspen Gluco Chek Blood Glucose Test Strip |
| Sample Inhaler 200 mcg | Budeshine 200 Inhaler |
| Sample Antiseptic Cream 20 g | Betadine 5% Ointment |
| Sample Baby Diaper Pants (Medium) | Pampers Premium Care Pants Size Medium |
| Sample Pain Relief Gel 50 g | Volini Joint Xpert Pain Relief Gel |
| Sample Scheduled Product (not for online sale) | *keeps the generated placeholder* |

Two mismatches are deliberate and must not survive the real catalogue:

- The photo shows a different, real medicine than the name on the product
  card. The photo is the closest available illustration of the product
  *class*; the catalogue entry is still sample data.
- The legally restricted demo product keeps the generated placeholder. A real
  pack shot would suggest that the product is an ordinary item on sale, which
  is exactly what the legal restriction is there to prevent.

## Ownership and permission to use

These photographs are third-party product photography. They belong to 1mg.com
and to the brands whose products are shown, and they are served from the
1mg.com image CDN with that site's watermark layer applied.

They are used here as **development placeholders**, in a build that is not
licensed to sell medicines and does not accept real orders. They are not the
pharmacy's own product photography, and the pharmacy has no agreement with
1mg.com or with the brands to publish them.

Before the storefront takes real orders, every one of these photos has to be
replaced with the pharmacy's own photograph of the product it actually sells.
This belongs to the launch gate in
[PHARMACY_COMPLIANCE_CHECKLIST.md](PHARMACY_COMPLIANCE_CHECKLIST.md) (the
products section) and to the "Before going live" list in the
[README](../README.md): a customer must be able to recognise the pack they
receive, and the store must be entitled to publish the image.

## How the photos are stored

The import does not write files behind the application's back. Every photo
goes through the same path as an administrator upload:

1. The bytes are downloaded and checked against the file signature. Only
   JPEG, PNG and WebP are accepted; the declared content type of the response
   is ignored, the bytes decide.
2. The image is re-encoded by libvips into WebP at 320, 640 and 1280 pixels
   wide. Metadata and any appended payload are dropped.
3. The variants are written to the `products/` storage namespace under a
   generated key, and a `ProductImage` row records the variants, the size and
   the primary flag.
4. The change is written to the audit log with the source page, the source
   image URL, the SHA-256 of the downloaded bytes and the retrieval date.

The previous photo of a product is deleted only after the new one has been
fetched and validated, so a failed download never leaves a product without a
photo.

## Refreshing the photos

The mapping from catalogue product to source photo is committed in
`scripts/product-image-sources.json`. It records the 1mg.com product page,
the exact image URL, the real product name and a note on why the photo
matches the product class.

```bash
# Check that every source image is still reachable. Nothing is written.
npm run images:import -- --dry-run

# Re-fetch and re-store every photo.
npm run images:import

# Limit the run to a single product.
npm run images:import -- --sku DEMO-ANLG-001
```

The script needs a reachable database, the same environment as the seed
script, and an administrator account to own the audit entries. It is
idempotent: each run replaces the current photo of the affected products, so
it can be repeated when a source image changes.

If a source image is no longer available, the run reports the product as
failed, leaves its current photo in place, and exits with a non-zero status.

## Replacing the photos with the pharmacy's own

This is the production path and it does not use the import script at all.
Sign in to the administration area, open a product and use the photo upload
in the gallery: the same validation, re-encoding, storage and audit trail
apply. The imported photos can be removed the same way.

The import script is a development convenience. It is not a catalogue
management tool: it never changes a name, a brand, a price or a stock
level.
