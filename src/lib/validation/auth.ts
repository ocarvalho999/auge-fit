import { z } from "zod";

export const MIN_AGE = 18;

/** Idade completa em anos na data informada. Datas em AAAA-MM-DD, sem fuso. */
export function ageOn(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

const email = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")).pipe(z.string().max(254));
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "Use até 72 caracteres.");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  email,
  password,
  birthDate: z.iso
    .date("Informe sua data de nascimento.")
    .refine((d) => ageOn(d) >= MIN_AGE, "O Auge Fit é para maiores de 18 anos.")
    .refine((d) => ageOn(d) < 120, "Confira a data de nascimento."),
  acceptTerms: z.literal("on", { error: "É preciso aceitar os termos e a política de privacidade." }),
});

export const signInSchema = z.object({ email, password: z.string().min(1).max(72) });
export const resetRequestSchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não coincidem." });
