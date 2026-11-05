/* eslint-disable @next/next/no-img-element -- links assinados de 60 segundos não passam pelo otimizador de imagens */
import { ConsentToggle } from "@/components/layout/consent-toggle";
import { PhotoUpload } from "@/components/progress/photo-upload";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionForm, CheckboxField, SubmitButton } from "@/components/ui/form";
import { requireRole } from "@/features/auth/session";
import { deletePhotoAction, setPhotosAllowedAction } from "@/features/progress/actions";
import { PHOTOS_BUCKET, SIGNED_URL_SECONDS } from "@/features/progress/photo-constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Fotos | Auge Fit" };

const POSE: Record<string, string> = { front: "Frente", side: "Lado", back: "Costas" };

export default async function PhotosPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const [{ data: consents }, { data: photos }, { data: links }] = await Promise.all([
    supabase.from("consents").select("type").eq("profile_id", profile.id).in("type", ["photos", "photos_professional"]).is("revoked_at", null),
    supabase.from("progress_photos").select("id, storage_path, pose, taken_on").eq("profile_id", profile.id).order("taken_on", { ascending: false }).limit(60),
    supabase.from("professional_students").select("id, photos_allowed").eq("student_id", profile.id).eq("status", "active"),
  ]);
  const has = (t: string) => Boolean(consents?.some((c) => c.type === t));
  const paths = (photos ?? []).map((p) => p.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const today = new Date().toISOString().slice(0, 10);
  const link = links?.[0];

  return (
    <>
      <PageHeader title="Fotos de progresso" description="Privadas. A administração não tem acesso." />
      <div className="space-y-4">
        <Card>
          {has("photos") ? (
            <PhotoUpload today={today} />
          ) : (
            <ConsentToggle type="photos" granted={false} label="Autorizo o armazenamento privado das minhas fotos de progresso." />
          )}
        </Card>

        {link ? (
          <Card className="space-y-3">
            <h2 className="font-bold">Seu profissional</h2>
            {has("photos_professional") ? (
              <ActionForm action={setPhotosAllowedAction} className="space-y-2">
                <CheckboxField name="allowed" defaultChecked={link.photos_allowed} key={String(link.photos_allowed)}>
                  Permitir que meu profissional veja minhas fotos enquanto durar o vínculo.
                </CheckboxField>
                <SubmitButton variant="secondary">Salvar</SubmitButton>
              </ActionForm>
            ) : (
              <ConsentToggle type="photos_professional" granted={false} label="Autorizo o compartilhamento das minhas fotos com o profissional vinculado." />
            )}
          </Card>
        ) : null}

        {photos?.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl bg-surface">
                {urlOf.get(p.storage_path) ? (
                  <img src={urlOf.get(p.storage_path) ?? ""} alt={`Foto de ${formatDate(p.taken_on)}, ${POSE[p.pose]}`} className="aspect-[3/4] w-full object-cover" />
                ) : null}
                <div className="flex items-center justify-between gap-1 p-2 text-sm">
                  <span>
                    {formatDate(p.taken_on)} · {POSE[p.pose]}
                  </span>
                  <form action={deletePhotoAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className={buttonClass("ghost", "px-2 text-sm")}>
                      Apagar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma foto enviada" />
        )}
      </div>
    </>
  );
}
