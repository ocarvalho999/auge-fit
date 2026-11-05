"use client";

import { useEffect } from "react";
import { flush } from "@/features/workouts/sync-queue";

/** Reenvia a fila em qualquer tela do aluno, não só durante o treino. */
export function QueueFlusher() {
  useEffect(() => {
    const run = () => {
      void flush(window.localStorage, (payload) =>
        fetch("/api/workouts/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
    };
    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);
  return null;
}
