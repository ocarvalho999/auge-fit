"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { isRateLimited } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { measurementSchema, photoMetaSchema } from "@/lib/validation/student";
import { assertRole } from "@/features/auth/session";
import { MAX_UPLOAD_BYTES, PHOTOS_BUCKET } from "./photo-constants";
import { processPhoto } from "./photo-processing";

export async function addMeasurementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = measurementSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").insert({
    profile_id: profile.id,
    measured_on: d.measuredOn,
    weight_kg: d.weightKg,
    waist_cm: d.waistCm,
    chest_cm: d.chestCm,
    hip_cm: d.hipCm,
    arm_cm: d.armCm,
    thigh_cm: d.thighCm,
  });
  if (error) {
    return { error: error.code === "42501" ? "Confira seu consentimento e sua assinatura." : "Não foi possível salvar." };
  }
  revalidatePath("/evolucao");
  return { ok: true, message: "Medida registrada." };
}

export async function deleteMeasurementAction(form: FormData): Promise<void> {
  await assertRole("student");
  const supabase = await createClient();
  await supabase.from("body_measurements").delete().eq("id", String(form.get("id") ?? ""));
  revalidatePath("/evolucao");
}

export async function uploadPhotoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = photoMetaSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { photo: "Escolha uma foto." } };
  if (file.size > MAX_UPLOAD_BYTES) return { fieldErrors: { photo: "A foto precisa ter até 10 MB." } };
  if (await isRateLimited("upload", profile.id)) return { error: "Muitos envios. Tente mais tarde." };

  let output: Buffer;
  try {
    output = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { fieldErrors: { photo: "Envie uma imagem JPEG, PNG ou WebP válida." } };
  }

  const supabase = await createClient();
  const path = `${profile.id}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, output, { contentType: "image/webp", upsert: false });
  if (uploadError) return { error: "Não foi possível enviar. Confira seu consentimento para fotos." };

  const { error } = await supabase
    .from("progress_photos")
    .insert({ profile_id: profile.id, storage_path: path, pose: parsed.data.pose, taken_on: parsed.data.takenOn });
  if (error) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return { error: "Não foi possível salvar. Confira sua assinatura." };
  }
  revalidatePath("/evolucao/fotos");
  return { ok: true, message: "Foto enviada." };
}

export async function deletePhotoAction(form: FormData): Promise<void> {
  const profile = await assertRole("student");
  const id = String(form.get("id") ?? "");
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (photo) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
    await supabase.from("progress_photos").delete().eq("id", id);
  }
  revalidatePath("/evolucao/fotos");
}

export async function setPhotosAllowedAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const allowed = form.get("allowed") === "on";
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_students")
    .update({ photos_allowed: allowed })
    .eq("student_id", profile.id)
    .eq("status", "active");
  if (error) return { error: "Para liberar, registre antes o consentimento de fotos vistas pelo profissional." };
  revalidatePath("/evolucao/fotos");
  return { ok: true, message: allowed ? "Profissional autorizado a ver suas fotos." : "Acesso às fotos revogado." };
}
