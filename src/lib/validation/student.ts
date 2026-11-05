import { z } from "zod";

const uuid = z.uuid();
const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), "Valor fora do esperado.");

export const onboardingProfileSchema = z.object({
  goal: z.enum(["hypertrophy", "definition", "conditioning", "calisthenics", "organization"], { error: "Escolha um objetivo." }),
  experience: z.enum(["beginner", "intermediate", "advanced"], { error: "Escolha sua experiência." }),
});

export const CONSENT_TYPES = ["health_data", "photos", "photos_professional", "marketing"] as const;
export const consentSchema = z.object({ type: z.enum(CONSENT_TYPES) });

export const planNameSchema = z.object({ name: z.string().trim().min(1, "Dê um nome ao treino.").max(120) });
export const workoutNameSchema = z.object({ planId: uuid, name: z.string().trim().min(1, "Dê um nome.").max(120) });

export const addExerciseSchema = z.object({
  workoutId: uuid,
  exerciseId: z.uuid("Escolha um exercício."),
  sets: z.coerce.number("Informe as séries.").int().min(1, "Mínimo de 1 série.").max(20),
  repsTarget: z.string().trim().max(20).optional().default(""),
  restSeconds: z.coerce.number().int().min(0).max(900).optional(),
});

export const syncPayloadSchema = z.object({
  log: z.object({
    id: uuid,
    workout_id: uuid.nullable(),
    workout_name: z.string().max(120).nullable(),
    started_at: z.iso.datetime(),
    finished_at: z.iso.datetime().nullable(),
  }),
  sets: z
    .array(
      z.object({
        client_uuid: uuid,
        exercise_id: uuid,
        set_number: z.number().int().min(1).max(50),
        weight_kg: z.number().min(0).max(2000),
        reps: z.number().int().min(0).max(1000),
      }),
    )
    .max(200),
});
export type SyncPayload = z.infer<typeof syncPayloadSchema>;

export const measurementSchema = z
  .object({
    measuredOn: z.iso.date("Informe a data."),
    weightKg: optionalNumber(20, 400),
    waistCm: optionalNumber(20, 300),
    chestCm: optionalNumber(20, 300),
    hipCm: optionalNumber(20, 300),
    armCm: optionalNumber(10, 150),
    thighCm: optionalNumber(10, 200),
  })
  .refine((v) => [v.weightKg, v.waistCm, v.chestCm, v.hipCm, v.armCm, v.thighCm].some((x) => x !== null), {
    path: ["weightKg"],
    message: "Preencha ao menos uma medida.",
  });

export const photoMetaSchema = z.object({
  pose: z.enum(["front", "side", "back"], { error: "Escolha a pose." }),
  takenOn: z.iso.date("Informe a data."),
});

export const checkinAnswersSchema = z.object({
  checkinId: uuid,
  adherence: z.enum(["all", "most", "some", "none"], { error: "Responda sobre os treinos." }),
  energy: z.coerce.number("Dê uma nota.").int().min(1, "De 1 a 5.").max(5, "De 1 a 5."),
  sleep: z.coerce.number("Dê uma nota.").int().min(1, "De 1 a 5.").max(5, "De 1 a 5."),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const profileUpdateSchema = z.object({ fullName: z.string().trim().min(2, "Informe seu nome.").max(120) });
export const deleteAccountSchema = z.object({
  confirm: z.literal("EXCLUIR", { error: "Digite EXCLUIR para confirmar." }),
});
