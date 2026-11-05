// Sem dados de saúde no corpo dos e-mails. Verificação e redefinição de senha saem pelo SMTP do Supabase Auth.
export type TemplateName =
  | "welcome"
  | "payment_confirmed"
  | "payment_failed"
  | "quarter_expiring_7"
  | "quarter_expiring_1"
  | "checkin_pending"
  | "feedback_available"
  | "professional_invite"
  | "inactivity_5d";

export type TemplateVars = { appUrl: string; actionUrl?: string };

const layout = (title: string, body: string, cta?: { label: string; url: string }) => `
<div style="background:#090B0B;color:#F4F6F6;font-family:Arial,sans-serif;padding:24px">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <p style="margin:0 0 16px;line-height:1.5">${body}</p>
  ${cta ? `<a href="${cta.url}" style="background:#B6FF32;color:#090B0B;padding:12px 18px;border-radius:10px;font-weight:bold;text-decoration:none;display:inline-block">${cta.label}</a>` : ""}
  <p style="margin:24px 0 0;font-size:12px;color:#A8B0B0">Auge Fit</p>
</div>`;

export function renderTemplate(name: TemplateName, vars: TemplateVars): { subject: string; html: string } {
  const app = vars.appUrl;
  switch (name) {
    case "welcome":
      return {
        subject: "Boas-vindas ao Auge Fit",
        html: layout("Boas-vindas", "Sua conta está pronta. O próximo passo é registrar seu primeiro treino.", { label: "Abrir o Auge Fit", url: `${app}/inicio` }),
      };
    case "payment_confirmed":
      return {
        subject: "Pagamento confirmado",
        html: layout("Pagamento confirmado", "Recebemos seu pagamento. Você pode ver os detalhes em Assinatura.", { label: "Ver assinatura", url: `${app}/assinatura` }),
      };
    case "payment_failed":
      return {
        subject: "Não conseguimos processar seu pagamento",
        html: layout("Falha na cobrança", "Sua última cobrança não foi aprovada. Confira seu meio de pagamento para não perder o acesso.", { label: "Ver assinatura", url: `${app}/assinatura` }),
      };
    case "quarter_expiring_7":
      return {
        subject: "Seu trimestre vence em 7 dias",
        html: layout("Faltam 7 dias", "Seu plano trimestral vence em 7 dias. Renove para continuar registrando seus treinos.", { label: "Renovar", url: `${app}/assinatura` }),
      };
    case "quarter_expiring_1":
      return {
        subject: "Seu trimestre vence amanhã",
        html: layout("Vence amanhã", "Seu plano trimestral vence amanhã. Renove para continuar registrando seus treinos.", { label: "Renovar", url: `${app}/assinatura` }),
      };
    case "checkin_pending":
      return {
        subject: "Você tem um check-in pendente",
        html: layout("Check-in pendente", "Seu check-in da semana está esperando por você.", { label: "Abrir check-ins", url: `${app}/checkins` }),
      };
    case "feedback_available":
      return {
        subject: "Seu feedback está disponível",
        html: layout("Feedback disponível", "Seu profissional publicou um feedback. Entre no app para ler.", { label: "Abrir check-ins", url: `${app}/checkins` }),
      };
    case "professional_invite":
      return {
        subject: "Convite para o Auge Fit",
        html: layout("Seu convite", "Seu registro foi conferido. Use o link para criar sua senha e acessar o painel do profissional.", { label: "Aceitar convite", url: vars.actionUrl ?? `${app}/login` }),
      };
    case "inactivity_5d":
      return {
        subject: "Faz 5 dias desde o seu último registro",
        html: layout("Vamos retomar?", "Seu último treino registrado foi há 5 dias. Quando voltar, sua carga anterior estará lá.", { label: "Abrir o Auge Fit", url: `${app}/inicio` }),
      };
  }
}
