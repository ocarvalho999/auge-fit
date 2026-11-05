import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { signOutAction } from "@/features/auth/actions";
import { buttonClass } from "@/components/ui/button";
import { NavLinks, type NavItem } from "./nav-links";

/** Mobile-first: navegação inferior no celular, superior no desktop. */
export function AppShell({
  homeHref,
  items,
  children,
  context,
}: {
  homeHref: string;
  items: NavItem[];
  children: ReactNode;
  context?: string;
}) {
  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo href={homeHref} />
            {context ? <span className="text-sm text-muted">{context}</span> : null}
          </div>
          <nav aria-label="Principal" className="hidden flex-1 justify-center md:flex">
            <NavLinks items={items} layout="top" />
          </nav>
          <form action={signOutAction}>
            <button type="submit" className={buttonClass("ghost", "text-sm")}>
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="fade-in mx-auto w-full max-w-5xl px-4 py-5">{children}</main>
      <nav
        aria-label="Principal no celular"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <NavLinks items={items} layout="bottom" />
      </nav>
    </div>
  );
}
