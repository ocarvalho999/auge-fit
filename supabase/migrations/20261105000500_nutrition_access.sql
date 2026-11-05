-- Acesso ao app FitBrother, liberado manualmente pelo WhatsApp. Só o servidor grava.
-- Conta excluída com acesso ainda ativo mantém o registro, sem vínculo com a pessoa, até a remoção no app.
create table public.nutrition_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  whatsapp text check (whatsapp ~ '^55[0-9]{10,11}$'),
  granted_at timestamptz,
  granted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.nutrition_access enable row level security;

create policy nutrition_access_select on public.nutrition_access for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
