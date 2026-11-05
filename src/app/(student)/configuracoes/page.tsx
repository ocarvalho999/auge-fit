import { ConsentToggle } from "@/components/layout/consent-toggle";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/feedback";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/features/account/actions";
import { requireRole } from "@/features/auth/session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ajustes | Auge Fit" };

const CONSENT_LABELS: { type: string; label: string }[] = [
  { type: "health_data", label: "Medidas e check-ins: autorizo o tratamento para acompanhar meu progresso." },
  { type: "photos", label: "Fotos: autorizo o armazenamento privado das minhas fotos de progresso." },
  { type: "photos_professional", label: "Fotos vistas pelo profissional: autorizo o compartilhamento com o profissional vinculado." },
  { type: "marketing", label: "Marketing: aceito receber novidades por e-mail." },
];

export default async function SettingsPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: consents } = await supabase
    .from("consents")
    .select("type, document_version, granted_at, revoked_at")
    .eq("profile_id", profile.id)
    .order("granted_at", { ascending: false });
  const active = new Set((consents ?? []).filter((c) => !c.revoked_at).map((c) => c.type));

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold">Perfil</h2>
          <ActionForm action={updateProfileAction}>
            <Field name="fullName" label="Nome" defaultValue={profile.full_name} maxLength={120} />
            <SubmitButton variant="secondary">Salvar perfil</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Senha</h2>
          <ActionForm action={changePasswordAction} resetOnSuccess>
            <Field name="password" label="Nova senha" type="password" autoComplete="new-password" />
            <Field name="confirm" label="Repita a senha" type="password" autoComplete="new-password" />
            <SubmitButton variant="secondary">Alterar senha</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">E-mails e consentimentos</h2>
          <p className="mb-3 text-sm text-muted">Cada autorização é separada. Desmarque e salve para revogar.</p>
          <div className="space-y-5">
            {CONSENT_LABELS.map((c) => (
              <ConsentToggle key={c.type} type={c.type} granted={active.has(c.type)} label={c.label} />
            ))}
          </div>
          <details className="mt-4 text-sm text-muted">
            <summary className="min-h-11 cursor-pointer py-2">Histórico de consentimentos</summary>
            <ul className="space-y-1">
              {(consents ?? []).map((c) => (
                <li key={`${c.type}-${c.granted_at}`}>
                  {c.type}, versão {c.document_version}, em {formatDate(c.granted_at)}
                  {c.revoked_at ? `, revogado em ${formatDate(c.revoked_at)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Seus dados</h2>
          <p className="mb-3 text-sm text-muted">Baixe uma cópia de tudo em arquivo JSON.</p>
          <a href="/api/account/export" className={buttonClass("secondary", "w-full")}>
            Exportar meus dados
          </a>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold text-danger">Excluir conta</h2>
          <p className="mb-3 text-sm text-muted">
            Cancela sua assinatura e apaga seus dados e fotos. Não dá para desfazer. Registros financeiros ficam mantidos sem
            vínculo com você, pelo prazo legal.
          </p>
          <ActionForm action={deleteAccountAction}>
            <Field name="confirm" label="Digite EXCLUIR para confirmar" autoComplete="off" />
            <SubmitButton variant="danger">Excluir minha conta</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
