import { beforeEach, describe, expect, it } from "vitest";
import { consistency, loadSeries, volumeSeries } from "@/features/progress/metrics";
import { lastSetsByExercise } from "@/features/workouts/queries";
import { enqueue, flush, pendingCount, type StorageLike } from "@/features/workouts/sync-queue";
import type { SyncPayload } from "@/lib/validation/student";
import { syncPayloadSchema } from "@/lib/validation/student";

const memoryStorage = (): StorageLike => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const log = { id: uuid(1), workout_id: uuid(2), workout_name: "A", started_at: "2026-11-05T10:00:00.000Z", finished_at: null };
const set = (n: number) => ({ client_uuid: uuid(100 + n), exercise_id: uuid(3), set_number: n, weight_kg: 40, reps: 10 });

describe("fila local de treino", () => {
  let storage: StorageLike;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("guarda o digitado e esvazia quando o servidor confirma", async () => {
    enqueue(storage, log, [set(1), set(2)]);
    expect(pendingCount(storage)).toBe(2);
    const sent: SyncPayload[] = [];
    expect(await flush(storage, async (p) => (sent.push(p), { status: 200 }))).toBe("ok");
    expect(sent[0]?.sets).toHaveLength(2);
    expect(pendingCount(storage)).toBe(0);
  });

  it("sem conexão, não perde nada", async () => {
    enqueue(storage, log, [set(1)]);
    const r = await flush(storage, async () => {
      throw new Error("offline");
    });
    expect(r).toBe("offline");
    expect(pendingCount(storage)).toBe(1);
  });

  it("erro do servidor mantém na fila", async () => {
    enqueue(storage, log, [set(1)]);
    expect(await flush(storage, async () => ({ status: 500 }))).toBe("offline");
    expect(pendingCount(storage)).toBe(1);
  });

  it("assinatura vencida mantém na fila e avisa", async () => {
    enqueue(storage, log, [set(1)]);
    expect(await flush(storage, async () => ({ status: 403 }))).toBe("forbidden");
    expect(pendingCount(storage)).toBe(1);
  });

  it("o mesmo client_uuid não entra duas vezes", () => {
    enqueue(storage, log, [set(1)]);
    enqueue(storage, log, [set(1)]);
    expect(pendingCount(storage)).toBe(1);
  });

  it("série registrada durante o envio não se perde", async () => {
    enqueue(storage, log, [set(1)]);
    await flush(storage, async () => {
      enqueue(storage, log, [set(2)]);
      return { status: 200 };
    });
    expect(pendingCount(storage)).toBe(1);
  });

  it("conclusão marcada durante o envio segue na fila", async () => {
    enqueue(storage, log, [set(1)]);
    await flush(storage, async () => {
      enqueue(storage, { ...log, finished_at: "2026-11-05T11:00:00.000Z" });
      return { status: 200 };
    });
    const sent: SyncPayload[] = [];
    await flush(storage, async (p) => (sent.push(p), { status: 200 }));
    expect(sent[0]?.log.finished_at).toBe("2026-11-05T11:00:00.000Z");
  });

  it("armazenamento corrompido não quebra", () => {
    storage.setItem("auge-fit:fila-treino:v1", "{quebrado");
    expect(pendingCount(storage)).toBe(0);
  });
});

describe("validação do envio", () => {
  it("aceita o formato da fila e recusa carga negativa", () => {
    expect(syncPayloadSchema.safeParse({ log, sets: [set(1)] }).success).toBe(true);
    expect(syncPayloadSchema.safeParse({ log, sets: [{ ...set(1), weight_kg: -1 }] }).success).toBe(false);
    expect(syncPayloadSchema.safeParse({ log: { ...log, id: "x" }, sets: [] }).success).toBe(false);
  });
});

describe("métricas de evolução", () => {
  const rows = [
    { exercise_id: "a", workout_log_id: "1", weight_kg: 40, reps: 10, logged_at: "2026-11-01T10:00:00Z" },
    { exercise_id: "a", workout_log_id: "1", weight_kg: 50, reps: 8, logged_at: "2026-11-01T10:05:00Z" },
    { exercise_id: "b", workout_log_id: "1", weight_kg: 10, reps: 10, logged_at: "2026-11-01T10:10:00Z" },
    { exercise_id: "a", workout_log_id: "2", weight_kg: 55, reps: 5, logged_at: "2026-11-03T10:00:00Z" },
  ];
  it("carga: maior do dia, em ordem", () => {
    expect(loadSeries(rows, "a")).toEqual([
      { date: "2026-11-01", value: 50 },
      { date: "2026-11-03", value: 55 },
    ]);
  });
  it("volume: soma por dia", () => {
    expect(volumeSeries(rows)).toEqual([
      { date: "2026-11-01", value: 900 },
      { date: "2026-11-03", value: 275 },
    ]);
  });
  it("treino às 22h em São Paulo conta no dia certo, não no dia seguinte em UTC", () => {
    const late = [{ exercise_id: "a", workout_log_id: "1", weight_kg: 40, reps: 10, logged_at: "2026-11-02T01:00:00Z" }];
    expect(loadSeries(late, "a")).toEqual([{ date: "2026-11-01", value: 40 }]);
  });
  it("constância: dias distintos dentro da janela", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(consistency(["2026-11-05T08:00:00Z", "2026-11-05T18:00:00Z", "2026-11-01T08:00:00Z", "2026-01-01T08:00:00Z"], now)).toBe(2);
  });
  it("carga anterior vem só da sessão mais recente", () => {
    const last = lastSetsByExercise([
      { exercise_id: "a", workout_log_id: "1", set_number: 1, weight_kg: 40, reps: 10, logged_at: "2026-11-01T10:00:00Z" },
      { exercise_id: "a", workout_log_id: "2", set_number: 2, weight_kg: 60, reps: 6, logged_at: "2026-11-03T10:01:00Z" },
      { exercise_id: "a", workout_log_id: "2", set_number: 1, weight_kg: 55, reps: 8, logged_at: "2026-11-03T10:00:00Z" },
    ]);
    expect(last.get("a")).toEqual([
      { set_number: 1, weight_kg: 55, reps: 8 },
      { set_number: 2, weight_kg: 60, reps: 6 },
    ]);
  });
});
