"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { enqueue, flush, pendingCount, type QueuedLog, type StorageLike } from "@/features/workouts/sync-queue";
import type { SyncPayload } from "@/lib/validation/student";

export type LoggerExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  repsTarget: string | null;
  restSeconds: number | null;
  notes: string | null;
  last: { set_number: number; weight_kg: number; reps: number }[];
};

type DoneSet = { setNumber: number; weight: number; reps: number };
type Session = { logId: string; startedAt: string; done: Record<string, DoneSet[]> };

const sessionKey = (workoutId: string) => `auge-fit:sessao:${workoutId}`;

const send = (payload: SyncPayload) =>
  fetch("/api/workouts/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

function Stepper({
  label,
  value,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-center text-sm text-muted">{label}</p>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
          className="min-h-14 w-14 shrink-0 rounded-xl bg-surface-2 text-2xl font-bold"
        >
          −
        </button>
        <label className="flex min-w-0 flex-1 items-center justify-center rounded-xl bg-surface-2">
          <span className="sr-only">{label}</span>
          <input
            inputMode="decimal"
            aria-label={label}
            value={String(value)}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            className="w-full min-w-0 bg-transparent py-3 text-center text-2xl font-bold outline-none"
          />
          {suffix ? <span className="pr-2 text-sm text-muted">{suffix}</span> : null}
        </label>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(Math.round((value + step) * 100) / 100)}
          className="min-h-14 w-14 shrink-0 rounded-xl bg-surface-2 text-2xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Tela mais importante: uma mão, botões grandes, carga anterior à vista e confirmar em poucos toques. */
export function WorkoutLogger({
  workoutId,
  workoutName,
  exercises,
}: {
  workoutId: string;
  workoutName: string;
  exercises: LoggerExercise[];
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<"ok" | "offline" | "forbidden">("ok");

  const storage = useMemo<StorageLike | null>(() => (typeof window === "undefined" ? null : window.localStorage), []);
  const current = exercises[index];
  const doneHere = session?.done[current?.exerciseId ?? ""] ?? [];
  const nextSetNumber = doneHere.length + 1;

  const prefill = useCallback((exercise: LoggerExercise | undefined, setNumber: number, previous?: DoneSet) => {
    if (!exercise) return;
    const last = exercise.last.find((s) => s.set_number === setNumber) ?? exercise.last.at(-1);
    setWeight(previous?.weight ?? last?.weight_kg ?? 0);
    setReps(previous?.reps ?? last?.reps ?? 0);
  }, []);

  const sync = useCallback(async () => {
    if (!storage) return;
    const result = await flush(storage, send);
    setStatus(result);
    setPending(pendingCount(storage));
  }, [storage]);

  // Retoma a sessão salva no aparelho, inclusive depois de fechar o app no meio do treino.
  useEffect(() => {
    const raw = window.localStorage.getItem(sessionKey(workoutId));
    let loaded: Session | null = null;
    try {
      loaded = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      loaded = null;
    }
    const s = loaded ?? { logId: crypto.randomUUID(), startedAt: new Date().toISOString(), done: {} };
    window.localStorage.setItem(sessionKey(workoutId), JSON.stringify(s));
    const firstOpen = exercises.findIndex((e) => (s.done[e.exerciseId]?.length ?? 0) < e.sets);
    const start = firstOpen === -1 ? 0 : firstOpen;
    /* eslint-disable react-hooks/set-state-in-effect -- estado inicial só existe no navegador (localStorage) */
    setSession(s);
    setIndex(start);
    const startExercise = exercises[start];
    if (startExercise) {
      const done = s.done[startExercise.exerciseId] ?? [];
      prefill(startExercise, done.length + 1, done.at(-1));
    }
    setPending(pendingCount(window.localStorage));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [workoutId, exercises, prefill]);

  useEffect(() => {
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void sync(), 15_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [sync]);

  const logOf = (s: Session, finishedAt: string | null): QueuedLog => ({
    id: s.logId,
    workout_id: workoutId,
    workout_name: workoutName,
    started_at: s.startedAt,
    finished_at: finishedAt,
  });

  function goTo(i: number) {
    if (!session) return;
    const exercise = exercises[i];
    if (!exercise) return;
    setIndex(i);
    const done = session.done[exercise.exerciseId] ?? [];
    prefill(exercise, done.length + 1, done.at(-1));
  }

  function confirmSet() {
    if (!session || !current || !storage) return;
    const entry: DoneSet = { setNumber: nextSetNumber, weight, reps };
    const updated: Session = {
      ...session,
      done: { ...session.done, [current.exerciseId]: [...doneHere, entry] },
    };
    setSession(updated);
    window.localStorage.setItem(sessionKey(workoutId), JSON.stringify(updated));
    enqueue(storage, logOf(updated, null), [
      {
        client_uuid: crypto.randomUUID(),
        exercise_id: current.exerciseId,
        set_number: entry.setNumber,
        weight_kg: weight,
        reps,
      },
    ]);
    setPending(pendingCount(storage));
    void sync();
    if (doneHere.length + 1 >= current.sets && index < exercises.length - 1) {
      const nextExercise = exercises[index + 1];
      setIndex(index + 1);
      const done = updated.done[nextExercise?.exerciseId ?? ""] ?? [];
      prefill(nextExercise, done.length + 1, done.at(-1));
    } else {
      prefill(current, entry.setNumber + 1, entry);
    }
  }

  async function finish() {
    if (!session || !storage) return;
    enqueue(storage, logOf(session, new Date().toISOString()));
    await sync();
    window.localStorage.removeItem(sessionKey(workoutId));
    router.push("/evolucao");
    router.refresh();
  }

  if (!session || !current) {
    return <p className="py-10 text-center text-muted">Abrindo treino...</p>;
  }

  const lastForSet = current.last.find((s) => s.set_number === nextSetNumber) ?? current.last.at(-1);
  const totalDone = Object.values(session.done).reduce((n, list) => n + list.length, 0);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {status === "forbidden" ? (
        <Alert tone="danger">Sua assinatura não permite novos registros. O que você digitou segue guardado neste aparelho.</Alert>
      ) : status === "offline" && pending > 0 ? (
        <Alert tone="warning">Sem conexão. {pending} registro(s) guardado(s) neste aparelho. Enviaremos quando a internet voltar.</Alert>
      ) : null}

      <nav aria-label="Exercícios do treino" className="flex gap-2 overflow-x-auto pb-1">
        {exercises.map((e, i) => {
          const done = session.done[e.exerciseId]?.length ?? 0;
          return (
            <button
              key={e.exerciseId}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? "step" : undefined}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
                i === index ? "bg-accent text-on-accent" : "bg-surface text-text"
              }`}
            >
              {i + 1}. {done}/{e.sets}
            </button>
          );
        })}
      </nav>

      <section className="rounded-2xl bg-surface p-4">
        <h2 className="text-xl font-bold">{current.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {nextSetNumber > current.sets ? "Série extra" : `Série ${nextSetNumber} de ${current.sets}`}
          {current.repsTarget ? ` · Meta: ${current.repsTarget} reps` : ""}
          {current.restSeconds ? ` · Descanso: ${current.restSeconds}s` : ""}
        </p>
        {current.notes ? <p className="mt-2 text-sm">{current.notes}</p> : null}
        <p className="mt-3 text-sm" data-testid="carga-anterior">
          {lastForSet ? (
            <>
              Última vez:{" "}
              <strong className="text-accent">
                {lastForSet.weight_kg} kg × {lastForSet.reps}
              </strong>
            </>
          ) : (
            <span className="text-muted">Primeira vez neste exercício.</span>
          )}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stepper label="Carga" value={weight} step={2.5} onChange={setWeight} suffix="kg" />
          <Stepper label="Repetições" value={reps} step={1} onChange={setReps} />
        </div>

        <button type="button" onClick={confirmSet} className={buttonClass("primary", "mt-4 min-h-16 w-full text-lg")}>
          Confirmar série
        </button>

        {doneHere.length ? (
          <ol className="mt-4 space-y-1 text-sm text-muted">
            {doneHere.map((s) => (
              <li key={s.setNumber}>
                Série {s.setNumber}: {s.weight} kg × {s.reps}
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <button type="button" onClick={finish} disabled={totalDone === 0} className={buttonClass("secondary", "w-full")}>
        Concluir treino
      </button>
    </div>
  );
}
