"use client";

import { ErrorState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";

export default function GlobalRouteError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <ErrorState
        retry={
          <button type="button" onClick={reset} className={buttonClass("secondary")}>
            Tentar de novo
          </button>
        }
      />
    </main>
  );
}
