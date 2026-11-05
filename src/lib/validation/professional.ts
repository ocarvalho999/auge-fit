import { z } from "zod";

const uuid = z.uuid();

export const prescribedPlanSchema = z.object({ studentId: uuid, name: z.string().trim().min(1, "Dê um nome.").max(120) });
export const catalogPlanSchema = z.object({ name: z.string().trim().min(1, "Dê um nome.").max(120) });
export const proWorkoutSchema = z.object({ planId: uuid, name: z.string().trim().min(1, "Dê um nome.").max(120) });
export const proExerciseSchema = z.object({
  planId: uuid,
  workoutId: uuid,
  exerciseId: z.uuid("Escolha um exercício."),
  sets: z.coerce.number("Informe as séries.").int().min(1).max(20),
  repsTarget: z.string().trim().max(20).optional().default(""),
  restSeconds: z.coerce.number().int().min(0).max(900).optional(),
  notes: z.string().trim().max(500).optional().default(""),
});
export const planStatusSchema = z.object({ planId: uuid, status: z.enum(["draft", "published", "archived"]) });
export const openCheckinSchema = z.object({ linkId: uuid, dueOn: z.iso.date("Informe a data.") });
export const feedbackSchema = z.object({
  checkinId: uuid,
  body: z.string().trim().min(1, "Escreva o feedback.").max(5000),
});
export const exerciseReviewSchema = z.object({
  exerciseId: uuid,
  instructions: z.string().trim().min(10, "Escreva as instruções revisadas.").max(5000),
});
