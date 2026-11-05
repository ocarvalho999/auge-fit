import { z } from "zod";

const uuid = z.uuid();

export const inviteProfessionalSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  crefNumber: z.string().trim().min(3, "Informe o CREF.").max(20),
  crefUf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Informe a UF com 2 letras."),
  capacity: z.coerce.number("Informe as vagas.").int().min(0).max(500),
  crefChecked: z.literal("on", { error: "Confira o CREF antes de convidar." }),
});

export const professionalUpdateSchema = z.object({
  id: uuid,
  capacity: z.coerce.number("Informe as vagas.").int().min(0).max(500),
  status: z.enum(["active", "inactive"]),
});

export const userStatusSchema = z.object({ id: uuid, status: z.enum(["active", "suspended"]) });
export const linkSchema = z.object({ subscriptionId: uuid, professionalId: z.uuid("Escolha um profissional.") });
export const endLinkSchema = z.object({ id: uuid });

/** Aceita "39,90" ou "39.90" e devolve centavos, sem erro de arredondamento. */
export function parseReais(value: string): number | null {
  const m = value.trim().match(/^(\d{1,6})(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export const priceUpdateSchema = z.object({
  id: uuid,
  amount: z
    .string()
    .transform(parseReais)
    .refine((v): v is number => v !== null && v > 0, "Informe um valor válido."),
  active: z.literal("on").optional(),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/, "Use de 3 a 40 letras, números, _ ou -."),
  discountPercent: z.coerce.number("Informe o desconto.").int().min(1, "De 1 a 100.").max(100, "De 1 a 100."),
  campaign: z.string().trim().max(80).optional().default(""),
  expiresAt: z.union([z.literal(""), z.iso.date("Data inválida.")]).optional().default(""),
  maxUses: z.union([z.literal(""), z.coerce.number().int().min(1, "Mínimo de 1.")]).optional().default(""),
});

export const couponToggleSchema = z.object({ id: uuid, active: z.enum(["true", "false"]) });

export const exerciseCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  muscleGroup: z.string().trim().min(2, "Informe o grupo muscular.").max(60),
});
export const exercisePublishSchema = z.object({ id: uuid, published: z.enum(["true", "false"]) });
