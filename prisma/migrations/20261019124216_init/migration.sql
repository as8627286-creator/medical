-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('CUSTOMER', 'ADMIN', 'PHARMACIST');

-- CreateEnum
CREATE TYPE "SaleEligibility" AS ENUM ('ELIGIBLE_FOR_ONLINE_SALE', 'NOT_FOR_ONLINE_SALE', 'PRESCRIPTION_REQUIRED');

-- CreateEnum
CREATE TYPE "LegalRestriction" AS ENUM ('NONE', 'PROHIBITED_FOR_ONLINE_SALE', 'CONTROLLED_SUBSTANCE', 'PRESCRIPTION_ONLY', 'COLD_CHAIN');

-- CreateEnum
CREATE TYPE "DosageForm" AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'SOLUTION', 'DROPS', 'INJECTION', 'CREAM', 'OINTMENT', 'GEL', 'LOTION', 'SHAMPOO', 'SOAP', 'POWDER', 'SACHET', 'PATCH', 'SUPPOSITORY', 'SPRAY', 'INHALER', 'DROPLET', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'AWAITING_PRESCRIPTION_APPROVAL', 'PREPARING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProviderCode" AS ENUM ('CASH_ON_DELIVERY', 'SANDBOX', 'RAZORPAY', 'STRIPE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING_UPLOAD', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PrescriptionDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PREPARING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'EXPIRY', 'CORRECTION', 'RESERVATION_RELEASE', 'RECALL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_PASSWORD_CHANGED', 'USER_CREATED', 'USER_UPDATED', 'USER_ROLE_CHANGED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ACTIVATED', 'PRODUCT_DEACTIVATED', 'PRODUCT_DELETED', 'PRODUCT_IMAGE_UPLOADED', 'PRODUCT_IMAGE_REMOVED', 'PRODUCT_PRICE_CHANGED', 'PRODUCT_STOCK_ADJUSTED', 'PRODUCT_LEGAL_RESTRICTION_CHANGED', 'PRESCRIPTION_UPLOADED', 'PRESCRIPTION_REVIEWED', 'PRESCRIPTION_DOCUMENT_DELETED', 'ORDER_PLACED', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'PAYMENT_CREATED', 'PAYMENT_STATUS_CHANGED', 'PAYMENT_REFUNDED', 'PAYMENT_WEBHOOK_RECEIVED', 'DELIVERY_STATUS_CHANGED', 'DELIVERY_ZONE_CREATED', 'DELIVERY_ZONE_UPDATED', 'DELIVERY_ZONE_DELETED', 'SETTINGS_UPDATED', 'AUDIT_EXPORTED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "sessionsValidFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "manufacturer" TEXT NOT NULL,
    "strength" TEXT,
    "dosageForm" "DosageForm" NOT NULL,
    "packSize" TEXT NOT NULL,
    "packUnit" TEXT,
    "description" TEXT,
    "warnings" TEXT,
    "usageInformation" TEXT,
    "storageInstructions" TEXT,
    "additionalInfo" TEXT,
    "mrpInPaise" INTEGER,
    "sellingPriceInPaise" INTEGER NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxInPaise" INTEGER NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "saleEligibility" "SaleEligibility" NOT NULL DEFAULT 'ELIGIBLE_FOR_ONLINE_SALE',
    "legalRestriction" "LegalRestriction" NOT NULL DEFAULT 'NONE',
    "legalRestrictionNote" TEXT,
    "legalRestrictionSetById" TEXT,
    "legalRestrictionSetAt" TIMESTAMP(3),
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "previousPriceInPaise" INTEGER NOT NULL,
    "newPriceInPaise" INTEGER NOT NULL,
    "previousMrpInPaise" INTEGER,
    "newMrpInPaise" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "subtotalInPaise" INTEGER NOT NULL,
    "deliveryFeeInPaise" INTEGER NOT NULL DEFAULT 0,
    "taxInPaise" INTEGER NOT NULL DEFAULT 0,
    "discountInPaise" INTEGER NOT NULL DEFAULT 0,
    "totalInPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "deliveryName" TEXT NOT NULL,
    "deliveryPhone" TEXT NOT NULL,
    "deliveryLine1" TEXT NOT NULL,
    "deliveryLine2" TEXT,
    "deliveryLandmark" TEXT,
    "deliveryCity" TEXT NOT NULL,
    "deliveryState" TEXT NOT NULL,
    "deliveryPincode" TEXT NOT NULL,
    "deliveryZoneId" TEXT,
    "estimatedDeliveryDaysMin" INTEGER,
    "estimatedDeliveryDaysMax" INTEGER,
    "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
    "prescriptionsApproved" BOOLEAN NOT NULL DEFAULT false,
    "customerNote" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productBrand" TEXT,
    "productSku" TEXT NOT NULL,
    "productManufacturer" TEXT NOT NULL,
    "productStrength" TEXT,
    "productDosageForm" "DosageForm" NOT NULL,
    "productPackSize" TEXT NOT NULL,
    "unitPriceInPaise" INTEGER NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxInPaise" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "lineTotalInPaise" INTEGER NOT NULL,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProviderCode" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountInPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "idempotencyKey" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "providerSignature" TEXT,
    "providerReference" TEXT,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundedAmountInPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderCode" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "payloadHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "retentionExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PrescriptionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionRequirement" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "documentId" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "validForDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionReview" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "documentId" TEXT,
    "decision" "PrescriptionDecision" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT NOT NULL,

    CONSTRAINT "PrescriptionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "description" TEXT,
    "deliveryFeeInPaise" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmountInPaise" INTEGER NOT NULL DEFAULT 0,
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "orderCutoffTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZonePincode" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryZonePincode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "zoneId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredToName" TEXT,
    "proofOfDeliveryNote" TEXT,
    "proofOfDeliveryStorageKey" TEXT,
    "failureReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pharmacyName" TEXT NOT NULL,
    "legalName" TEXT,
    "licenseNumber" TEXT,
    "pharmacistName" TEXT,
    "pharmacistRegistrationNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "aboutText" TEXT,
    "refundPolicyText" TEXT,
    "deliveryPolicyText" TEXT,
    "privacyPolicyText" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "businessHours" TEXT,
    "minOrderAmountInPaise" INTEGER NOT NULL DEFAULT 0,
    "defaultDeliveryFeeInPaise" INTEGER NOT NULL DEFAULT 0,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codMinOrderAmountInPaise" INTEGER NOT NULL DEFAULT 0,
    "codMaxOrderAmountInPaise" INTEGER,
    "salesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "livePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "complianceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "complianceConfirmedAt" TIMESTAMP(3),
    "complianceConfirmedById" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "actorId" TEXT,
    "actorRole" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_code_idx" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Address_pincode_idx" ON "Address"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_sortOrder_idx" ON "ProductCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Product_stockQuantity_idx" ON "Product"("stockQuantity");

-- CreateIndex
CREATE INDEX "Product_saleEligibility_isActive_idx" ON "Product"("saleEligibility", "isActive");

-- CreateIndex
CREATE INDEX "Product_legalRestriction_idx" ON "Product"("legalRestriction");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_storageKey_key" ON "ProductImage"("storageKey");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_isPrimary_idx" ON "ProductImage"("productId", "isPrimary");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productId_createdAt_idx" ON "InventoryAdjustment"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_reason_idx" ON "InventoryAdjustment"("reason");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_createdAt_idx" ON "PriceHistory"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_updatedAt_idx" ON "Cart"("updatedAt");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_placedAt_idx" ON "Order"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_deliveryZoneId_idx" ON "Order"("deliveryZoneId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_createdAt_idx" ON "PaymentWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionDocument_storageKey_key" ON "PrescriptionDocument"("storageKey");

-- CreateIndex
CREATE INDEX "PrescriptionDocument_userId_uploadedAt_idx" ON "PrescriptionDocument"("userId", "uploadedAt");

-- CreateIndex
CREATE INDEX "PrescriptionDocument_orderId_idx" ON "PrescriptionDocument"("orderId");

-- CreateIndex
CREATE INDEX "PrescriptionDocument_retentionExpiresAt_idx" ON "PrescriptionDocument"("retentionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionRequirement_orderItemId_key" ON "PrescriptionRequirement"("orderItemId");

-- CreateIndex
CREATE INDEX "PrescriptionRequirement_status_idx" ON "PrescriptionRequirement"("status");

-- CreateIndex
CREATE INDEX "PrescriptionRequirement_documentId_idx" ON "PrescriptionRequirement"("documentId");

-- CreateIndex
CREATE INDEX "PrescriptionReview_requirementId_createdAt_idx" ON "PrescriptionReview"("requirementId", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionReview_reviewerId_idx" ON "PrescriptionReview"("reviewerId");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_idx" ON "DeliveryZone"("isActive");

-- CreateIndex
CREATE INDEX "DeliveryZonePincode_zoneId_idx" ON "DeliveryZonePincode"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZonePincode_pincode_key" ON "DeliveryZonePincode"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRecord_orderId_key" ON "DeliveryRecord"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryRecord_status_idx" ON "DeliveryRecord"("status");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDocument" ADD CONSTRAINT "PrescriptionDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDocument" ADD CONSTRAINT "PrescriptionDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDocument" ADD CONSTRAINT "PrescriptionDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRequirement" ADD CONSTRAINT "PrescriptionRequirement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRequirement" ADD CONSTRAINT "PrescriptionRequirement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PrescriptionDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionReview" ADD CONSTRAINT "PrescriptionReview_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "PrescriptionRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionReview" ADD CONSTRAINT "PrescriptionReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PrescriptionDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionReview" ADD CONSTRAINT "PrescriptionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZonePincode" ADD CONSTRAINT "DeliveryZonePincode_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
