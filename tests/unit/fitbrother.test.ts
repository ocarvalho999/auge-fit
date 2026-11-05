import { describe, expect, it } from "vitest";
import { classifyAccess, normalizeWhatsapp, type AccessRow } from "@/features/fitbrother/queue";

describe("normalizeWhatsapp", () => {
  it("aceita como a pessoa digita", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("+55 11 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("1133334444")).toBe("551133334444");
  });
  it("recusa inválidos", () => {
    for (const bad of ["", "abc", "912345678", "01912345678", "11812345678", "123"]) {
      expect(normalizeWhatsapp(bad)).toBeNull();
    }
  });
});

describe("classifyAccess", () => {
  const row = (over: Partial<AccessRow>): AccessRow => ({
    id: "r",
    profile_id: "a",
    whatsapp: "5511912345678",
    granted_at: null,
    revoked_at: null,
    ...over,
  });
  const granted = "2026-11-01T00:00:00Z";

  it("com direito e número, sem acesso: liberar", () => {
    const q = classifyAccess([row({})], new Set(["a"]));
    expect(q.toGrant).toHaveLength(1);
    expect(q.toRevoke).toHaveLength(0);
  });
  it("com acesso e sem direito: remover", () => {
    const q = classifyAccess([row({ granted_at: granted })], new Set());
    expect(q.toRevoke).toHaveLength(1);
    expect(q.active).toHaveLength(0);
  });
  it("conta excluída com acesso ativo: remover", () => {
    const q = classifyAccess([row({ profile_id: null, granted_at: granted })], new Set());
    expect(q.toRevoke).toHaveLength(1);
  });
  it("removido e assinou de novo: liberar outra vez", () => {
    const q = classifyAccess([row({ granted_at: granted, revoked_at: granted })], new Set(["a"]));
    expect(q.toGrant).toHaveLength(1);
  });
  it("removido e sem direito: nada a fazer", () => {
    const q = classifyAccess([row({ granted_at: granted, revoked_at: granted })], new Set());
    expect(q.toGrant).toHaveLength(0);
    expect(q.toRevoke).toHaveLength(0);
  });
  it("com direito e sem número: aguardando", () => {
    expect(classifyAccess([], new Set(["b"])).awaitingNumber).toEqual(["b"]);
  });
});
