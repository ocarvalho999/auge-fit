"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items, layout }: { items: NavItem[]; layout: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href.split("/").length > 1 && pathname.startsWith(`${href}/`));
  // A raiz do painel só fica ativa na própria página.
  const active = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(i.href))?.href;

  if (layout === "top") {
    return (
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                active === item.href ? "text-accent" : "text-muted hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={`flex ${items.length > 6 ? "overflow-x-auto" : ""}`}>
      {items.map((item) => (
        <li key={item.href} className={items.length > 6 ? "min-w-18 flex-1" : "min-w-0 flex-1"}>
          <Link
            href={item.href}
            aria-current={active === item.href ? "page" : undefined}
            className={`flex min-h-14 items-center justify-center px-0.5 text-center text-[11px] font-medium ${
              active === item.href ? "text-accent" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
