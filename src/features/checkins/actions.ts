"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { checkinAnswersSchema } from "@/lib/validation/student";
import { assertRole } from "@/features/auth/session";

export async function submitCheckinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertRole("student");
  const parsed = checkinAnswersSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const { checkinId, ...answers } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .update({ answers, status: "submitted" })
    .eq("id", checkinId)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) return { error: "Não foi possível enviar este check-in." };
  revalidatePath("/checkins");
  return { ok: true, message: "Check-in enviado." };
}
