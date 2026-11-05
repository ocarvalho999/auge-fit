import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-lg font-extrabold tracking-tight">
      Auge<span className="text-accent">Fit</span>
    </Link>
  );
}
