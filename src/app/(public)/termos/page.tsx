import { LegalPage } from "@/components/layout/legal-page";

export const metadata = { title: "Termos de uso (rascunho) | Auge Fit" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <h2>1. O serviço</h2>
      <p>O Auge Fit é um sistema para registrar treinos e acompanhar o progresso. Não promete resultado físico.</p>
      <h2>2. Quem pode usar</h2>
      <p>Somente maiores de 18 anos.</p>
      <h2>3. Prescrição de exercícios</h2>
      <p>
        O sistema não gera treinos individuais. Programas e planejamentos são de responsabilidade do profissional
        habilitado indicado como autor, com número do CREF.
      </p>
      <h2>4. Planos e pagamento</h2>
      <p>Os preços vigentes aparecem antes da compra. Pagamentos são processados pelo Mercado Pago.</p>
      <h2>5. Garantia, cancelamento e reembolso</h2>
      <ul>
        <li>Pedidos em até 7 dias da compra têm reembolso integral.</li>
        <li>O cancelamento é feito pelo próprio app, e o acesso segue até o fim do período pago.</li>
        <li>Assinaturas vencidas mantêm leitura e exportação dos dados, sem novos registros de treino.</li>
      </ul>
      <h2>6. Black</h2>
      <p>
        Vagas limitadas por profissional. As 8 semanas começam quando o vínculo com o profissional é feito. Sem vaga, a
        pessoa pode entrar na lista de espera.
      </p>
      <h2>7. Responsabilidades e contato</h2>
      <p>Seção a ser definida na revisão jurídica, incluindo dados da empresa, foro e canal de atendimento.</p>
    </LegalPage>
  );
}
