import "server-only";
import { Invoice, MercadoPagoConfig, Payment, PaymentRefund, PreApproval, Preference } from "mercadopago";

// Abaixo do limite de 22 segundos do webhook, mesmo com mais de uma consulta por evento.
const TIMEOUT_MS = 7000;

function config() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Variável de ambiente ausente: MERCADOPAGO_ACCESS_TOKEN");
  return new MercadoPagoConfig({ accessToken, options: { timeout: TIMEOUT_MS } });
}

export const mercadoPago = {
  payment: () => new Payment(config()),
  preference: () => new Preference(config()),
  preApproval: () => new PreApproval(config()),
  refund: () => new PaymentRefund(config()),
  invoice: () => new Invoice(config()),
};

export const isMercadoPagoConfigured = () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
