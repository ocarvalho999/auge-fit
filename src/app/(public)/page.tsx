import Link from "next/link";
import { WaitlistForm } from "@/components/layout/waitlist-form";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/feedback";
import { Logo } from "@/components/ui/logo";
import { FEATURE_LABELS, getCatalog, type PlanWithPrices } from "@/features/billing/catalog";
import { formatCents, INTERVAL_LABEL } from "@/lib/format";

const FAQ = [
  {
    q: "Existe plano gratuito ou período de teste?",
    a: "Não. Todos os planos são pagos e têm garantia de 7 dias: pediu dentro desse prazo, o reembolso é integral.",
  },
  {
    q: "O app monta meu treino automaticamente?",
    a: "Não. Você monta o seu próprio treino, usa programas revisados por profissional (Pro e Black) ou recebe um planejamento individual de um profissional habilitado (Black).",
  },
  {
    q: "O que é o app FitBrother, incluído no Pro e no Black?",
    a: "Um app de nutrição em que você fala, escreve ou fotografa o que comeu e a inteligência artificial estima os macronutrientes. São estimativas para acompanhar sua alimentação no dia a dia: não é prescrição de dieta e não substitui nutricionista ou médico.",
  },
  {
    q: "Quem são os profissionais?",
    a: "Profissionais de Educação Física com registro no CREF conferido manualmente antes de entrarem na plataforma.",
  },
  {
    q: "Como funciona o cancelamento?",
    a: "Você cancela pelo próprio app, em poucos toques. O acesso segue até o fim do período já pago.",
  },
  {
    q: "Minhas fotos ficam públicas?",
    a: "Não. As fotos ficam em área privada. Um profissional só vê se você tiver vínculo com ele e autorizar, e você pode revogar quando quiser. A administração não tem acesso.",
  },
  {
    q: "O Auge Fit garante resultado físico?",
    a: "Não. O Auge Fit organiza seus treinos e deixa seu progresso claro. Resultado depende de cada pessoa e não é prometido aqui.",
  },
];

function PlanCard({ plan, proSellable, waitlist }: { plan: PlanWithPrices; proSellable: boolean; waitlist: boolean }) {
  const comingSoon = plan.code === "pro" && !proSellable;
  return (
    <Card className={`flex flex-col ${plan.code === "black" ? "ring-1 ring-accent" : ""}`}>
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <ul className="mt-3 space-y-1">
        {plan.prices.map((p) => (
          <li key={p.id}>
            <span className="text-2xl font-extrabold">{formatCents(p.amount_cents)}</span>{" "}
            <span className="text-sm text-muted">{INTERVAL_LABEL[p.interval]}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {FEATURE_LABELS.map((f) => (
          <li key={f.key} className={plan.features[f.key] ? "" : "text-muted line-through"}>
            {f.label}
          </li>
        ))}
        {plan.code === "black" ? <li className="text-muted">Vagas limitadas por profissional</li> : null}
      </ul>
      <div className="mt-5">
        {comingSoon ? (
          <p className="rounded-xl border border-line px-3 py-2.5 text-center font-semibold text-muted">Em breve</p>
        ) : waitlist ? (
          <a href="#lista-de-espera" className="block rounded-xl border border-line px-3 py-2.5 text-center font-semibold">
            Entrar na lista de espera
          </a>
        ) : (
          <LinkButton href={`/cadastro?plano=${plan.code}`} className="w-full">
            Assinar {plan.name}
          </LinkButton>
        )}
      </div>
    </Card>
  );
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
  const catalog = await getCatalog();
  const waitlist = process.env.WAITLIST_ENABLED === "true";

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <header className="flex items-center justify-between gap-2 py-3">
        <Logo />
        <LinkButton href="/login" variant="ghost">
          Entrar
        </LinkButton>
      </header>

      <main>
        {conta === "excluida" ? <Alert tone="success">Sua conta e seus dados foram excluídos.</Alert> : null}
        <section className="py-10 sm:py-16">
          <h1 className="max-w-3xl text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Registre cada treino. Enxergue <span className="text-accent">sua evolução</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            O sistema onde você registra cargas e séries, acompanha seu progresso com clareza e, quando quiser, conta
            com um profissional habilitado.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href={waitlist ? "#lista-de-espera" : "#planos"} className="px-6">
              {waitlist ? "Entrar na lista de espera" : "Ver planos"}
            </LinkButton>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="py-8">
          <h2 id="como-funciona" className="text-2xl font-bold tracking-tight">
            Como é usar
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <h3 className="font-semibold">Monte ou escolha o treino</h3>
              <p className="mt-1 text-sm text-muted">Crie o seu com a biblioteca de exercícios ou siga um programa revisado.</p>
            </Card>
            <Card>
              <h3 className="font-semibold">Registre em dois toques</h3>
              <p className="mt-1 text-sm text-muted">A carga da última sessão já aparece na tela. Confirme a série e siga.</p>
            </Card>
            <Card>
              <h3 className="font-semibold">Veja o progresso</h3>
              <p className="mt-1 text-sm text-muted">Gráficos de carga, volume e peso, medidas e fotos privadas.</p>
            </Card>
          </div>
        </section>

        <section id="planos" aria-labelledby="planos-titulo" className="scroll-mt-4 py-8">
          <h2 id="planos-titulo" className="text-2xl font-bold tracking-tight">
            Planos
          </h2>
          <p className="mt-1 text-sm text-muted">Garantia de 7 dias em todos os planos pagos.</p>
          {catalog ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {catalog.plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} proSellable={catalog.proSellable} waitlist={waitlist} />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <Alert tone="warning">Não foi possível carregar os planos agora. Tente de novo em instantes.</Alert>
            </div>
          )}
        </section>

        <section aria-labelledby="profissionais" className="py-8">
          <h2 id="profissionais" className="text-2xl font-bold tracking-tight">
            Profissionais habilitados
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Todo programa e planejamento tem autoria visível, com número do CREF. O registro de cada profissional é
            conferido manualmente antes da entrada na plataforma. O sistema não gera treinos sozinho.
          </p>
        </section>

        <section aria-labelledby="garantia" className="py-8">
          <Card>
            <h2 id="garantia" className="text-xl font-bold">
              Garantia de 7 dias
            </h2>
            <p className="mt-1 text-muted">Pedidos em até 7 dias da compra têm reembolso integral.</p>
          </Card>
        </section>

        <section aria-labelledby="faq" className="py-8">
          <h2 id="faq" className="text-2xl font-bold tracking-tight">
            Perguntas frequentes
          </h2>
          <div className="mt-4 space-y-2">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-xl bg-surface px-4 py-3">
                <summary className="min-h-6 cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-2 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {waitlist ? (
          <section id="lista-de-espera" aria-labelledby="espera" className="scroll-mt-4 py-8">
            <Card className="mx-auto max-w-md">
              <h2 id="espera" className="mb-4 text-xl font-bold">
                Lista de espera
              </h2>
              <WaitlistForm source="landing" />
            </Card>
          </section>
        ) : (
          <section className="py-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Pronto para organizar seus treinos?</h2>
            <LinkButton href="#planos" className="mt-4 px-6">
              Escolher plano
            </LinkButton>
          </section>
        )}
      </main>

      <footer className="flex flex-wrap gap-x-4 border-t border-line py-6 text-sm text-muted">
        <Link href="/termos" className="inline-block py-3">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="inline-block py-3">
          Política de privacidade
        </Link>
      </footer>
    </div>
  );
}
