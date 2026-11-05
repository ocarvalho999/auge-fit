# Pendências e premissas

Decisões não críticas adotadas sem consulta (a opção mais simples e segura) e itens em aberto.

## Premissas

- **`proxy.ts` em vez de `middleware.ts`:** o Next.js 16 renomeou a convenção e marcou `middleware` como obsoleta. A especificação cita `middleware.ts`; usamos o nome atual.
- **TypeScript 5.9 e ESLint 9:** o `typescript-eslint` atual exige TypeScript abaixo de 6.1, e os plugins do `eslint-config-next` ainda dependem do ESLint 9. Atualizar quando o ecossistema permitir.

## Ambiente de desenvolvimento

- **Sem Docker nesta máquina:** `supabase start` não foi executado.
- **Testes de banco sem `supabase start`:** rodam em Postgres real com esboço de `auth` e `storage` (`supabase/tests/support/postgres.ts`). Falta rodar `supabase db reset` numa máquina com Docker antes de homologação.
- **Tipos do banco:** gerados por `npm run db:types` (script próprio), porque `supabase gen types` exige Docker.

## Premissas de banco

- **Sem `lib/supabase/browser.ts`:** todo acesso passa pelo servidor, então um cliente de navegador seria código morto. Criar quando houver uso real.
- **Conta excluída mantém o registro financeiro:** `subscriptions.profile_id` fica nulo e pagamentos permanecem, para obrigação fiscal. Confirmar na revisão jurídica.
- **Profissional não exclui a própria conta sozinho:** prescrições e feedbacks têm autoria obrigatória (`on delete restrict`). A saída é inativar pelo admin.
- **Cupom em assinatura mensal:** o desconto vale para todas as cobranças da assinatura.
- **Revisão de exercício:** o profissional ativo enxerga exercícios não publicados para poder revisá-los. Se o admin editar as instruções, a revisão cai e o exercício sai de publicação.
- **Medidas e fotos exigem assinatura vigente para novos registros**, além do consentimento. A especificação só cita treinos; como não há plano gratuito, a regra foi estendida. Leitura e exportação continuam liberadas.

## Conteúdo e landing

- **"App real em uso" na landing:** a especificação pede o app real em uso, sem nada inventado. Falta o fundador gravar a tela com conta real. A seção "Como é usar" descreve os passos em texto até lá.
- **Lista de espera ativável:** ligada por `WAITLIST_ENABLED=true`. Com ela ligada, a landing troca os botões de compra pelo formulário.
- **Fonte:** pilha de fontes do sistema, sem baixar fonte externa, para simplificar a CSP.

## Aluno

- **BLOQUEIO DE LANÇAMENTO, biblioteca vazia:** como exercício só é publicado depois de revisão, sem revisão de um profissional o aluno não consegue montar treino nenhum. É preciso ter a biblioteca mínima revisada antes de abrir vendas.
- **Limite de 10 MB x Vercel:** a Vercel limita o corpo da requisição a cerca de 4,5 MB. O app reduz a foto no aparelho antes de enviar quando ela passa de 4 MB; o limite de 10 MB continua valendo para o arquivo escolhido. Sem JavaScript, fotos acima do limite da Vercel falham.
- **Treino do dia:** rodízio simples entre os treinos do plano mais recente, com prioridade para o planejamento prescrito. Programas do catálogo são iniciados pela tela de Treinos.
- **Plano escolhido na landing:** `/cadastro?plano=` ainda não pré-seleciona o plano; a escolha acontece em Assinatura depois do onboarding.

## Profissional

- **Página inexistente com status 200:** com `loading.tsx`, o Next começa a responder antes do `notFound()`, então a rota de aluno sem vínculo devolve status 200 com a tela "Página não encontrada". Nenhum dado do aluno sai na resposta (testado). A consequência é só o código HTTP.
- **Check-in semanal:** abre manualmente pelo profissional; a abertura automática entra com as rotinas agendadas da fase 7.

## Admin

- **Conferência do CREF:** o painel exige marcar que a conferência manual foi feita, mas não consulta o CONFEF/CREF. Não há integração oficial conhecida; a conferência é humana.
- **Mensagem depois do vínculo:** ao criar o vínculo, o item sai da lista "aguardando" e a confirmação aparece como o novo item em "Vínculos ativos".
- **Dashboard de cupons:** mede usos por cupom e campanha; não há relatório por período.

## Ambiente de testes

- **Instabilidade em aberto:** em 2 de cerca de 10 execuções do E2E, o `next start` de teste parou de responder no meio da suíte, sem erro no log. Depois disso, 3 execuções seguidas passaram (incluindo a suíte completa). A causa não foi encontrada. `tests/e2e/support/stack.ts` agora grava saída de processos em `.tmp/stack.log` para a próxima ocorrência. Não há indício de relação com o código do app, mas isso não está provado. Em 2026-11-05, uma execução lenta coincidiu com pouca memória livre (cerca de 1,1 GB) e CPU em 76%, o que pode explicar as quedas; também não está provado. O E2E passou no CI.

## Pagamentos

- **Assinatura mensal sem plano no provedor:** usa `/preapproval` sem `card_token_id`. O preço fica no nosso banco, e o fluxo com plano associado exigiria token de cartão. A entrada do cartão na página do Mercado Pago sem token não está afirmada na documentação lida: confirmar em sandbox.
- **Valor de cancelamento enviado:** `cancelled`, como no SDK. O guia do Mercado Pago escreve `canceled`. Ao ler, o app aceita as duas; confirmar em sandbox qual a API aceita.
- **Trocar de plano:** para trocar de mensal, é preciso cancelar a atual e assinar outra. Sem cálculo proporcional.
- **Sem tolerância de tempo na assinatura do webhook:** o validador aceita `toleranceSeconds`, mas a documentação informa reenvios a cada 15 minutos e não diz se o `ts` é renovado. Reenvios antigos são contidos pela chave única e pela consulta à API. Reavaliar com dados reais.
- **Pagamento depois da reserva expirar:** o acesso é honrado e a vaga volta a contar, podendo exceder a capacidade. O admin resolve no vínculo ou reembolsa.
- **Assinatura pendente abandonada:** o registro fica como `pending`, sem efeito, para um pagamento tardio ainda ser reconhecido.
- **E-mail de inatividade:** só para quem aceitou marketing, por precaução. Confirmar na revisão jurídica se pode ser transacional.

## Segurança

- **Dependências de desenvolvimento:** 8 alertas moderados de `minimatch`, vindos das ferramentas de lint. Corrigir exige mudar de versão maior do ESLint. Reavaliar na próxima atualização.
- **Mapas de código no Sentry:** o envio de source maps não foi configurado, para não exigir mais um segredo no build. Os erros chegam com o código minificado.
- **`style-src 'unsafe-inline'`:** necessário para os gráficos. Scripts seguem só com nonce.
- **Limite de uso depende do banco:** se o contador falhar, a ação limitada é negada. Em queda do banco, o login já não funcionaria de qualquer forma.

## Repositório público

Decisão do fundador em 2026-11-05. O que isso implica:

- **Segredos:** qualquer credencial enviada fica exposta na hora e deve ser trocada, mesmo que o commit seja apagado depois. A varredura roda antes de cada commit e no CI, mas só reconhece formatos conhecidos.
- **E-mail do autor:** o e-mail pessoal aparece nos commits já enviados. Para os próximos, dá para usar o endereço `noreply` do GitHub.
- **Logs do GitHub Actions:** são públicos. Não imprimir dados reais nos testes.
- **Documentos internos:** `docs/` fica visível, incluindo pendências de segurança e de pagamento, como a validação ainda não feita no sandbox do Mercado Pago.
- **Licença:** sem arquivo de licença, ninguém recebe permissão de uso do código, mesmo com ele visível. Avaliar na revisão jurídica.

## FitBrother no Pro e no Black

Pedido do fundador em 2026-11-05: incluir no plano médio um app que mede macros e monta dieta personalizada. Fonte lida: https://fitbrother-blog.vercel.app/blog/ .

- **Relação entre as empresas:** o FitBrother é empresa parceira, da qual o fundador é sócio. Falta formalizar por escrito preço por assinante, uso da marca e responsabilidade pelos dados.
- **Entrega do acesso, decisão do fundador:** manual, pelo WhatsApp. O assinante informa o número em Assinatura, e `/admin/fitbrother` mostra quem liberar e quem remover. O sistema só registra: quem libera e remove no FitBrother é uma pessoa, e sem essa rotina diária alguém pode pagar e ficar sem acesso, ou cancelar e continuar com ele.
- **Prazo de liberação:** a tela não promete prazo, porque nenhum foi definido. Definir antes de vender, com atendimento nos fins de semana.
- **Número guardado:** fica em tabela própria (`nutrition_access`), fora do alcance do profissional. Se a conta for excluída com acesso ativo, o número fica até a remoção manual e depois é apagado. Confirmar na revisão jurídica.
- **"Dieta personalizada" fora do texto:** o blog não diz que o app gera plano alimentar. Fala em "Estimativa geral, não prescrição" e que não substitui nutricionista. Além disso, a especificação proíbe prescrição automatizada, e dieta individual é atividade de nutricionista (confirmar na revisão jurídica). O texto só volta a falar em dieta com o responsável técnico e a confirmação do que o app faz.
- **"Mede a evolução" fora do texto:** o blog cita painel diário, ofensiva e ranking, sem histórico de evolução. A evolução anunciada é a do próprio Auge Fit, com medidas e gráficos.
- **Premissa:** incluído também no Black, que traz todos os recursos dos planos abaixo; sem isso, o plano mais caro apareceria com um benefício riscado. Para tirar, é só mudar `nutrition_app` no Black.
- **Custo:** o blog anuncia R$ 37,90/mês como preço de fundador, sem preço regular. O custo real por assinante depende do acordo.
- **Não confirmado:** o site oficial (fitbrother.app) não foi lido, só o blog.

## Texto da landing, decisões do fundador

- **"Pronto para atingir o seu Auge Físico?":** chamada final pedida pelo fundador em 2026-11-05. A especificação diz que o produto promete organização e clareza de progresso, nunca resultado físico. O FAQ segue dizendo que não há garantia de resultado. Avaliar a frase na revisão jurídica.
- **Economia do trimestre:** calculada com os preços do banco, frente a 3 meses. Se o admin mudar os preços, o valor acompanha; sem economia real, o aviso some.
