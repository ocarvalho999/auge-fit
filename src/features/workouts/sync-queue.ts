// Fila local de registros de treino. Guarda o digitado e reenvia quando a conexão volta.
// O client_uuid garante no banco que reenviar não duplica. Não é modo offline completo.
import type { SyncPayload } from "@/lib/validation/student";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type QueuedSet = SyncPayload["sets"][number];
export type QueuedLog = SyncPayload["log"];

const KEY = "auge-fit:fila-treino:v1";

type Entry = { log: QueuedLog; sets: QueuedSet[]; dirty: boolean };
type Queue = Record<string, Entry>;

function read(storage: StorageLike): Queue {
  try {
    return JSON.parse(storage.getItem(KEY) ?? "{}") as Queue;
  } catch {
    return {};
  }
}

const write = (storage: StorageLike, q: Queue) => storage.setItem(KEY, JSON.stringify(q));

export function enqueue(storage: StorageLike, log: QueuedLog, sets: QueuedSet[] = []) {
  const q = read(storage);
  const entry = q[log.id] ?? { log, sets: [], dirty: true };
  entry.log = { ...entry.log, ...log };
  const known = new Set(entry.sets.map((s) => s.client_uuid));
  for (const s of sets) if (!known.has(s.client_uuid)) entry.sets.push(s);
  entry.dirty = true;
  q[log.id] = entry;
  write(storage, q);
}

export function pendingCount(storage: StorageLike): number {
  return Object.values(read(storage)).reduce((n, e) => n + e.sets.length + (e.dirty && !e.sets.length ? 1 : 0), 0);
}

export type FlushResult = "ok" | "offline" | "forbidden";

/** Envia tudo. Só remove da fila o que o servidor confirmou. */
export async function flush(
  storage: StorageLike,
  send: (payload: SyncPayload) => Promise<{ status: number }>,
): Promise<FlushResult> {
  const q = read(storage);
  for (const [id, entry] of Object.entries(q)) {
    let status: number;
    try {
      ({ status } = await send({ log: entry.log, sets: entry.sets }));
    } catch {
      return "offline";
    }
    if (status === 401 || status === 403) return "forbidden";
    if (status < 200 || status >= 300) return "offline";
    const latest = read(storage);
    const current = latest[id];
    if (current) {
      const sent = new Set(entry.sets.map((s) => s.client_uuid));
      const remaining = current.sets.filter((s) => !sent.has(s.client_uuid));
      if (remaining.length === 0 && current.log.finished_at === entry.log.finished_at) delete latest[id];
      else latest[id] = { ...current, sets: remaining };
      write(storage, latest);
    }
  }
  return "ok";
}
