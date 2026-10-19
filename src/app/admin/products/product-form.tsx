"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminActionState } from "./actions";

export interface ProductFormValues {
  id?: string;
  name: string;
  brand: string;
  manufacturer: string;
  strength: string;
  dosageForm: string;
  packSize: string;
  packUnit: string;
  sku: string;
  description: string;
  warnings: string;
  usageInformation: string;
  storageInstructions: string;
  additionalInfo: string;
  mrp: string;
  sellingPrice: string;
  taxPercent: string;
  stockQuantity: string;
  lowStockThreshold: string;
  categoryId: string;
  prescriptionRequired: boolean;
  saleEligibility: string;
  isActive: boolean;
}

export interface ProductFormOption {
  id: string;
  name: string;
}

const DOSAGE_FORMS = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "SUSPENSION",
  "SOLUTION",
  "DROPS",
  "INJECTION",
  "CREAM",
  "OINTMENT",
  "GEL",
  "LOTION",
  "SHAMPOO",
  "SOAP",
  "POWDER",
  "SACHET",
  "PATCH",
  "SUPPOSITORY",
  "SPRAY",
  "INHALER",
  "DROPLET",
  "OTHER",
];

const SALE_ELIGIBILITY = [
  { value: "ELIGIBLE_FOR_ONLINE_SALE", label: "Eligible for online sale" },
  { value: "PRESCRIPTION_REQUIRED", label: "Prescription required" },
  { value: "NOT_FOR_ONLINE_SALE", label: "Not for online sale" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  error,
  required,
  type = "text",
  help,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
  help?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-700">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        min={min}
        max={max}
        step={step}
        aria-invalid={error ? "true" : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
      <FieldError message={error} />
    </div>
  );
}

function TextAreaField({
  name,
  label,
  defaultValue,
  error,
  help,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  help?: string;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? "true" : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
      <FieldError message={error} />
    </div>
  );
}

export function ProductForm({
  action,
  values,
  categories,
  submitLabel,
  showStock = true,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  values: ProductFormValues;
  categories: ProductFormOption[];
  submitLabel: string;
  showStock?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as AdminActionState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {state.message ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Identification</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="name"
            label="Product name"
            required
            defaultValue={values.name}
            error={errors.name}
          />
          <TextField name="brand" label="Brand" defaultValue={values.brand} error={errors.brand} />
          <TextField
            name="manufacturer"
            label="Manufacturer"
            required
            defaultValue={values.manufacturer}
            error={errors.manufacturer}
          />
          <TextField
            name="strength"
            label="Strength"
            defaultValue={values.strength}
            error={errors.strength}
          />
          <div>
            <label htmlFor="dosageForm" className="block text-xs font-medium text-slate-700">
              Dosage form <span aria-hidden="true">*</span>
            </label>
            <select
              id="dosageForm"
              name="dosageForm"
              defaultValue={values.dosageForm || "TABLET"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {DOSAGE_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form.replace("_", " ")}
                </option>
              ))}
            </select>
            <FieldError message={errors.dosageForm} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="packSize"
              label="Pack size"
              required
              defaultValue={values.packSize}
              error={errors.packSize}
            />
            <TextField
              name="packUnit"
              label="Pack unit"
              defaultValue={values.packUnit}
              error={errors.packUnit}
            />
          </div>
          <TextField
            name="sku"
            label="SKU"
            required
            defaultValue={values.sku}
            error={errors.sku}
            help="Unique code used on invoices and stock records."
          />
          <div>
            <label htmlFor="categoryId" className="block text-xs font-medium text-slate-700">
              Category <span aria-hidden="true">*</span>
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={values.categoryId}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId} />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Pricing and stock</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            name="mrp"
            label="MRP (Rs)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={values.mrp}
            error={errors.mrpInPaise}
          />
          <TextField
            name="sellingPrice"
            label="Selling price (Rs)"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={values.sellingPrice}
            error={errors.sellingPriceInPaise}
          />
          <TextField
            name="taxPercent"
            label="Tax %"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={values.taxPercent}
            error={errors.taxPercent}
            help="Prices are shown tax inclusive; this is used for reporting."
          />
          <TextField
            name="lowStockThreshold"
            label="Low stock threshold"
            type="number"
            min="0"
            defaultValue={values.lowStockThreshold}
            error={errors.lowStockThreshold}
          />
          {showStock ? (
            <TextField
              name="stockQuantity"
              label="Stock quantity"
              type="number"
              min="0"
              defaultValue={values.stockQuantity}
              error={errors.stockQuantity}
            />
          ) : null}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Product information</legend>
        <div className="space-y-4">
          <TextAreaField
            name="description"
            label="Description"
            defaultValue={values.description}
            error={errors.description}
            help="Copy the description printed on the pack. Do not add claims that are not on the label."
          />
          <TextAreaField
            name="warnings"
            label="Warnings"
            defaultValue={values.warnings}
            error={errors.warnings}
            help="Mandatory cautionary text shown on the product page."
          />
          <TextAreaField
            name="usageInformation"
            label="Usage information"
            defaultValue={values.usageInformation}
            error={errors.usageInformation}
          />
          <TextAreaField
            name="storageInstructions"
            label="Storage instructions"
            defaultValue={values.storageInstructions}
            error={errors.storageInstructions}
          />
          <TextAreaField
            name="additionalInfo"
            label="Additional information"
            defaultValue={values.additionalInfo}
            error={errors.additionalInfo}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Sale eligibility</legend>
        <div className="space-y-3">
          <div>
            <label htmlFor="saleEligibility" className="block text-xs font-medium text-slate-700">
              Sale eligibility <span aria-hidden="true">*</span>
            </label>
            <select
              id="saleEligibility"
              name="saleEligibility"
              defaultValue={values.saleEligibility || "ELIGIBLE_FOR_ONLINE_SALE"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-80"
            >
              {SALE_ELIGIBILITY.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.saleEligibility} />
            <p className="mt-1 text-xs text-slate-500">
              Legal restrictions are managed separately and cannot be changed here.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="prescriptionRequired"
              defaultChecked={values.prescriptionRequired}
              className="h-4 w-4 rounded border-slate-300"
            />
            Prescription required
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={values.isActive}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active (visible in the storefront)
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
