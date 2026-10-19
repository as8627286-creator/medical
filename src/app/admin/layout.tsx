import { requireStaff } from "@/lib/auth/guards";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { logoutAction } from "@/app/login/actions";
import { AdminNav } from "@/components/admin-nav";

export const metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff("/admin");

  const sections = [
    { href: "/admin", label: "Dashboard", permission: null },
    { href: "/admin/products", label: "Products", permission: PERMISSIONS.PRODUCT_READ },
    { href: "/admin/orders", label: "Orders", permission: PERMISSIONS.ORDER_READ },
    {
      href: "/admin/prescriptions",
      label: "Prescriptions",
      permission: PERMISSIONS.PRESCRIPTION_REVIEW,
    },
    {
      href: "/admin/delivery",
      label: "Delivery zones",
      permission: PERMISSIONS.DELIVERY_ZONE_WRITE,
    },
    { href: "/admin/settings", label: "Store settings", permission: PERMISSIONS.SETTINGS_READ },
    { href: "/admin/audit", label: "Audit log", permission: PERMISSIONS.AUDIT_READ },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Signed in as</p>
          <p className="mt-0.5 text-sm text-slate-600">{user.fullName}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">{user.role.name}</p>
          <AdminNav
            sections={sections
              .filter((section) => !section.permission || hasPermission(user.role, section.permission))
              .map((section) => ({ href: section.href, label: section.label }))}
          />
          <form action={logoutAction} className="mt-4">
            <button
              type="submit"
              className="text-sm font-medium text-slate-600 hover:text-emerald-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
