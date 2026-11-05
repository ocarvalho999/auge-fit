import { redirect } from "next/navigation";
import { Alert, Card } from "@/components/ui/feedback";
import { ActionForm, SelectField, SubmitButton } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import { ConsentToggle } from "@/components/layout/consent-toggle";
import { finishOnboardingAction, saveOnboardingProfileAction } from "@/features/account/actions";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Primeiros passos | Auge Fit" };

const GOALS = [
  { value: "", label: "Escolha" },
  { value: "hypertrophy", label: "Hipertrofia" },
  { value: "definition", label: "Definição" },
  { value: "conditioning", label: "Condicionamento" },
  { value: "calisthenics", label: "Calistenia" },
  { value: "organization", label: "Organizar meus treinos" },
];
const LEVELS = [
  { value: "", label: "Escolha" },
  { value: "beginner", label: "Estou começando" },
  { value: "intermediate", label: "Treino há algum tempo" },
  { value: "advanced", label: "Treino há anos" },
];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ passo?: string }> }) {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("student_profiles")
    .select("goal, onboarded_at")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (student?.onboarded_at) redirect("/inicio");

  const { passo } = await searchParams;
  const step = passo === "2" && student?.goal ? 2 : passo === "3" && student?.goal ? 3 : 1;
  const { data: consents } = await supabase
    .from("consents")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("type", "health_data")
    .is("revoked_at", null);

  return (
    <main className="fade-in mx-auto w-full max-w-md px-4 py-4">
      <Logo href="/onboarding" />
      <p className="mt-6 text-sm text-muted">Passo {step} de 3</p>

      {step === 1 ? (
        <>
          <h1 className="mt-1 mb-5 text-2xl font-bold tracking-tight">Conte um pouco sobre você</h1>
          <ActionForm action={saveOnboardingProfileAction}>
            <SelectField name="goal" label="Seu objetivo principal" options={GOALS} />
            <SelectField name="experience" label="Sua experiência com treino" options={LEVELS} />
            <SubmitButton>Continuar</SubmitButton>
          </ActionForm>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="mt-1 mb-2 text-2xl font-bold tracking-tight">Suas medidas e check-ins</h1>
          <p className="mb-5 text-sm text-muted">
            Medidas e check-ins são dados de saúde e precisam da sua autorização. Você pode continuar sem autorizar e
            mudar isso depois em Ajustes, mas não poderá registrar medidas.
          </p>
          <Card>
            <ConsentToggle
              type="health_data"
              granted={Boolean(consents?.length)}
              label="Autorizo o tratamento das minhas medidas e check-ins para acompanhar meu progresso."
            />
          </Card>
          <a href="/onboarding?passo=3" className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-on-accent">
            Continuar
          </a>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="mt-1 mb-2 text-2xl font-bold tracking-tight">Tenha o Auge Fit na tela inicial</h1>
          <Card className="mb-5 space-y-3 text-sm">
            <p>
              <strong>iPhone:</strong> no Safari, toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
            </p>
            <p>
              <strong>Android:</strong> no Chrome, abra o menu e toque em &quot;Instalar app&quot; ou &quot;Adicionar à tela inicial&quot;.
            </p>
          </Card>
          <Alert>Agora é hora do seu primeiro treino.</Alert>
          <form action={finishOnboardingAction} className="mt-5">
            <SubmitButton>Ir para o primeiro treino</SubmitButton>
          </form>
        </>
      ) : null}
    </main>
  );
}
