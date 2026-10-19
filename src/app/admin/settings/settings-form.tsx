"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettingsAction, type SettingsState } from "./actions";
import type { StoreSettingsView } from "@/lib/store/types";

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  error,
  type = "text",
  help,
  step,
  min,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  type?: string;
  help?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        step={step}
        min={min}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextAreaField({
  name,
  label,
  defaultValue,
  error,
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
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
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsForm({
  settings,
  canWrite,
  paymentProvider,
  paymentLive,
}: {
  settings: StoreSettingsView;
  canWrite: boolean;
  paymentProvider: string;
  paymentLive: boolean;
}) {
  const [state, formAction] = useActionState(saveSettingsAction, {} as SettingsState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
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

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4" disabled={!canWrite}>
        <legend className="px-1 text-sm font-semibold text-slate-900">Pharmacy details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="pharmacyName"
            label="Trading name"
            defaultValue={settings.pharmacyName}
            error={errors.pharmacyName}
          />
          <TextField
            name="legalName"
            label="Legal name"
            defaultValue={settings.legalName}
            error={errors.legalName}
          />
          <TextField
            name="licenseNumber"
            label="Retail drug licence number"
            defaultValue={settings.licenseNumber}
            error={errors.licenseNumber}
            help="Enter the licence exactly as printed on the licence."
          />
          <TextField
            name="gstin"
            label="GSTIN"
            defaultValue={settings.gstin}
            error={errors.gstin}
          />
          <TextField
            name="pharmacistName"
            label="Responsible pharmacist"
            defaultValue={settings.pharmacistName}
            error={errors.pharmacistName}
          />
          <TextField
            name="pharmacistRegistrationNumber"
            label="Pharmacist registration number"
            defaultValue={settings.pharmacistRegistrationNumber}
            error={errors.pharmacistRegistrationNumber}
          />
          <TextField
            name="addressLine1"
            label="Address"
            defaultValue={settings.addressLine1}
            error={errors.addressLine1}
          />
          <TextField
            name="addressLine2"
            label="Address line 2"
            defaultValue={settings.addressLine2}
            error={errors.addressLine2}
          />
          <TextField
            name="city"
            label="City"
            defaultValue={settings.city}
            error={errors.city}
          />
          <TextField
            name="state"
            label="State"
            defaultValue={settings.state}
            error={errors.state}
          />
          <TextField
            name="pincode"
            label="PIN code"
            defaultValue={settings.pincode}
            error={errors.pincode}
          />
          <TextField
            name="phone"
            label="Phone"
            defaultValue={settings.phone}
            error={errors.phone}
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            defaultValue={settings.email}
            error={errors.email}
          />
          <TextField
            name="supportPhone"
            label="Support phone"
            defaultValue={settings.supportPhone}
            error={errors.supportPhone}
          />
          <TextField
            name="supportEmail"
            label="Support email"
            type="email"
            defaultValue={settings.supportEmail}
            error={errors.supportEmail}
          />
          <TextField
            name="businessHours"
            label="Business hours"
            defaultValue={settings.businessHours}
            error={errors.businessHours}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4" disabled={!canWrite}>
        <legend className="px-1 text-sm font-semibold text-slate-900">Delivery and payments</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            name="minOrderAmount"
            label="Minimum order value (Rs)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(settings.minOrderAmountInPaise / 100)}
            error={errors.minOrderAmountInPaise}
          />
          <TextField
            name="defaultDeliveryFee"
            label="Default delivery charge (Rs)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(settings.defaultDeliveryFeeInPaise / 100)}
            error={errors.defaultDeliveryFeeInPaise}
          />
          <TextField
            name="codMinOrderAmount"
            label="COD minimum (Rs)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(settings.codMinOrderAmountInPaise / 100)}
            error={errors.codMinOrderAmountInPaise}
          />
          <TextField
            name="codMaxOrderAmount"
            label="COD maximum (Rs, optional)"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              settings.codMaxOrderAmountInPaise === null
                ? ""
                : String(settings.codMaxOrderAmountInPaise / 100)
            }
            error={errors.codMaxOrderAmountInPaise}
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="codEnabled"
              defaultChecked={settings.codEnabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            Cash on delivery enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="salesEnabled"
              defaultChecked={settings.salesEnabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            Accept new orders on the storefront
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="livePaymentsEnabled"
              defaultChecked={settings.livePaymentsEnabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            Allow live online payments (also requires PAYMENT_LIVE=true in the
            environment; provider: {paymentProvider}, live: {paymentLive ? "yes" : "no"})
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="complianceConfirmed"
              defaultChecked={settings.complianceConfirmed}
              className="h-4 w-4 rounded border-slate-300"
            />
            The compliance checklist has been completed by qualified personnel
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="maintenanceMode"
              defaultChecked={settings.maintenanceMode}
              className="h-4 w-4 rounded border-slate-300"
            />
            Maintenance mode
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4" disabled={!canWrite}>
        <legend className="px-1 text-sm font-semibold text-slate-900">Policies and information</legend>
        <div className="space-y-4">
          <TextAreaField
            name="aboutText"
            label="About the pharmacy"
            defaultValue={settings.aboutText}
            error={errors.aboutText}
          />
          <TextAreaField
            name="refundPolicyText"
            label="Returns and refunds policy"
            defaultValue={settings.refundPolicyText}
            error={errors.refundPolicyText}
          />
          <TextAreaField
            name="deliveryPolicyText"
            label="Delivery policy"
            defaultValue={settings.deliveryPolicyText}
            error={errors.deliveryPolicyText}
          />
          <TextAreaField
            name="privacyPolicyText"
            label="Privacy policy"
            defaultValue={settings.privacyPolicyText}
            error={errors.privacyPolicyText}
          />
        </div>
      </fieldset>

      {canWrite ? <SubmitButton label="Save settings" /> : null}
    </form>
  );
}
