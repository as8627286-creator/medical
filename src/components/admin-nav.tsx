"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AdminNavSection {
  href: string;
  label: string;
}

export function AdminNav({ sections }: { sections: AdminNavSection[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="mt-4 border-t border-slate-200 pt-3">
      <ul className="space-y-1">
        {sections.map((section) => {
          const active =
            section.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
