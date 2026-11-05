import { LegalPage } from "@/components/layout/legal-page";

export const metadata = { title: "Política de privacidade (rascunho) | Auge Fit" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade">
      <h2>1. Dados que tratamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail e data de nascimento.</li>
        <li>Treinos: séries, cargas e repetições.</li>
        <li>Saúde, com consentimento próprio: medidas, check-ins e fotos de progresso.</li>
        <li>Pagamentos: status e valores. Dados de cartão ficam com o Mercado Pago e não passam pelos nossos servidores.</li>
      </ul>
      <h2>2. Consentimentos separados</h2>
      <p>
        Medidas e check-ins, fotos, fotos vistas pelo profissional e marketing têm cada um sua caixa própria, desmarcada
        por padrão, e podem ser revogados em Configurações.
      </p>
      <h2>3. Quem acessa</h2>
      <ul>
        <li>Profissional: somente com vínculo ativo. Fotos, somente com a sua autorização.</li>
        <li>Administração: não acessa fotos nem respostas de check-in.</li>
        <li>Fornecedores: Supabase, Vercel, Mercado Pago, Resend e Sentry, nos limites do serviço de cada um.</li>
      </ul>
      <h2>4. Seus direitos</h2>
      <p>Em Configurações você acessa, corrige, exporta em arquivo, revoga consentimentos e exclui sua conta.</p>
      <h2>5. Exclusão</h2>
      <p>
        A exclusão apaga dados e arquivos. Registros financeiros podem ser mantidos, sem vínculo com a pessoa, pelo prazo
        legal a ser definido na revisão jurídica.
      </p>
      <h2>6. Controlador e encarregado</h2>
      <p>Dados da empresa e do encarregado a serem preenchidos na revisão jurídica.</p>
    </LegalPage>
  );
}
