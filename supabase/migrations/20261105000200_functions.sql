-- Auge Fit: funções de autorização, gatilhos e regras garantidas no banco.

-- ---------------------------------------------------------------------------
-- Funções de autorização (SECURITY DEFINER com search_path fixo evita recursão de RLS)
-- ---------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

create function public.current_professional_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select pr.id
  from public.professionals pr
  join public.profiles p on p.id = pr.profile_id
  where pr.profile_id = (select auth.uid())
    and pr.status = 'active' and pr.cref_verified_at is not null and p.status = 'active';
$$;

create function public.is_linked_professional(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.professional_students ps
    where ps.student_id = p_student_id
      and ps.professional_id = public.current_professional_id()
      and ps.status = 'active'
      and (ps.ends_at is null or ps.ends_at > now())
  );
$$;

create function public.professional_can_view_photos(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.professional_students ps
    where ps.student_id = p_student_id
      and ps.professional_id = public.current_professional_id()
      and ps.status = 'active'
      and (ps.ends_at is null or ps.ends_at > now())
      and ps.photos_allowed
  );
$$;

create function public.has_consent(p_user_id uuid, p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents c
    where c.profile_id = p_user_id and c.type = p_type and c.revoked_at is null
  );
$$;

-- Uma pessoa autenticada só consulta o próprio direito (ou o admin consulta qualquer um).
create function public.has_entitlement(p_user_id uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    ((select auth.uid()) is null or (select auth.uid()) = p_user_id or public.is_admin())
    and exists (
      select 1
      from public.subscriptions s
      join public.plan_prices pp on pp.id = s.plan_price_id
      join public.plans pl on pl.id = pp.plan_id
      where s.profile_id = p_user_id
        and coalesce((pl.features ->> p_feature)::boolean, false)
        and (
          -- Black pago e ainda sem vínculo: as 8 semanas só começam no vínculo.
          (s.status = 'active' and s.current_period_end is null)
          or (
            s.status in ('active', 'past_due', 'cancelled')
            and now() <= coalesce(s.grace_until, s.current_period_end)
          )
        )
    );
$$;

create function public.pro_is_sellable() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 3 from public.workout_plans where kind = 'catalog' and status = 'published';
$$;

-- Autoria visível com CREF, sem abrir a tabela de profissionais.
create function public.professional_public(p_professional_id uuid)
returns table (full_name text, cref_number text, cref_uf text)
language sql stable security definer set search_path = '' as $$
  select p.full_name, pr.cref_number, pr.cref_uf
  from public.professionals pr
  join public.profiles p on p.id = pr.profile_id
  where pr.id = p_professional_id and pr.cref_verified_at is not null;
$$;

create function public.can_read_plan_row(
  p_kind text, p_student_id uuid, p_author uuid, p_status text
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'own' then p_student_id = (select auth.uid())
    when 'prescribed' then
      (p_student_id = (select auth.uid()) and p_status = 'published')
      or (p_author = public.current_professional_id() and public.is_linked_professional(p_student_id))
      or public.is_admin()
    when 'catalog' then
      (p_status = 'published' and public.has_entitlement((select auth.uid()), 'programs'))
      or p_author = public.current_professional_id()
      or public.is_admin()
    else false
  end;
$$;

create function public.can_write_plan_row(p_kind text, p_student_id uuid, p_author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'own' then p_student_id = (select auth.uid()) and p_author is null
    when 'prescribed' then
      p_author = public.current_professional_id() and public.is_linked_professional(p_student_id)
    when 'catalog' then p_author = public.current_professional_id() and p_student_id is null
    else false
  end;
$$;

create function public.can_read_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_plan_row(wp.kind, wp.student_id, wp.author_professional_id, wp.status)
    from public.workout_plans wp where wp.id = p_plan_id
  ), false);
$$;

create function public.can_write_plan(p_plan_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_write_plan_row(wp.kind, wp.student_id, wp.author_professional_id)
    from public.workout_plans wp where wp.id = p_plan_id
  ), false);
$$;

create function public.can_read_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_read_plan(w.plan_id) from public.workouts w where w.id = p_workout_id
  ), false);
$$;

create function public.can_write_workout(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_write_plan(w.plan_id) from public.workouts w where w.id = p_workout_id
  ), false);
$$;

create function public.log_student(p_workout_log_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select student_id from public.workout_logs where id = p_workout_log_id;
$$;

create function public.link_student(p_link_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select student_id from public.professional_students where id = p_link_id;
$$;

create function public.link_is_mine_and_active(p_link_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_students ps
    where ps.id = p_link_id
      and ps.professional_id = public.current_professional_id()
      and ps.status = 'active'
      and (ps.ends_at is null or ps.ends_at > now())
  );
$$;

create function public.checkin_student(p_checkin_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select ps.student_id
  from public.checkins c
  join public.professional_students ps on ps.id = c.professional_student_id
  where c.id = p_checkin_id;
$$;

create function public.checkin_is_mine_as_professional(p_checkin_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.link_is_mine_and_active(c.professional_student_id)
    from public.checkins c where c.id = p_checkin_id
  ), false);
$$;

-- Admin vê apenas o status dos check-ins, nunca as respostas.
create function public.admin_checkin_status()
returns table (id uuid, professional_student_id uuid, due_on date, submitted_at timestamptz, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select c.id, c.professional_student_id, c.due_on, c.submitted_at, c.status
    from public.checkins c order by c.due_on desc limit 500;
end;
$$;

-- Proposta de revisão: o profissional assina o conteúdo técnico; a publicação segue com o admin.
create function public.propose_exercise_review(p_exercise_id uuid, p_instructions text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_professional uuid := public.current_professional_id();
begin
  if v_professional is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if char_length(coalesce(p_instructions, '')) not between 10 and 5000 then
    raise exception 'instruções inválidas' using errcode = '22023';
  end if;
  update public.exercises
    set instructions = p_instructions, reviewed_by = v_professional, published = false
    where id = p_exercise_id;
  if not found then
    raise exception 'exercício não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos de proteção
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();
create trigger workout_plans_touch before update on public.workout_plans
  for each row execute function public.touch_updated_at();

-- Cadastro público sempre cria student e exige 18+; só o servidor marca app_metadata.invited.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invited boolean := coalesce((new.raw_app_meta_data ->> 'invited')::boolean, false);
  v_birth date;
  v_terms text := new.raw_user_meta_data ->> 'terms_version';
  v_privacy text := new.raw_user_meta_data ->> 'privacy_version';
begin
  begin
    v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    v_birth := null;
  end;

  if not v_invited then
    if v_birth is null or v_birth > (current_date - interval '18 years')::date then
      raise exception 'cadastro exige 18 anos ou mais' using errcode = '22023';
    end if;
    if v_terms is null or v_privacy is null then
      raise exception 'cadastro exige aceite dos termos' using errcode = '22023';
    end if;
  end if;

  insert into public.profiles (id, role, full_name, birth_date)
  values (new.id, 'student', left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), v_birth);

  if not v_invited then
    insert into public.student_profiles (profile_id) values (new.id);
    insert into public.consents (profile_id, type, document_version) values
      (new.id, 'terms', v_terms),
      (new.id, 'privacy', v_privacy);
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- O usuário não altera o próprio role nem status; admin altera os de outras contas.
create function public.protect_profile_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and (not public.is_admin() or old.id = (select auth.uid())) then
    raise exception 'role e status não podem ser alterados pelo próprio usuário' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Prescrição e catálogo exigem autor com CREF verificado e ativo.
create function public.check_plan_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('prescribed', 'catalog') and not exists (
    select 1 from public.professionals pr
    where pr.id = new.author_professional_id
      and pr.status = 'active' and pr.cref_verified_at is not null
  ) then
    raise exception 'prescrição exige profissional ativo com CREF verificado' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger workout_plans_check_author before insert or update on public.workout_plans
  for each row execute function public.check_plan_author();

-- Conteúdo técnico: admin não assina revisão e, se editar instruções, a revisão cai.
create function public.protect_exercise_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.reviewed_by is not null or new.published then
        raise exception 'revisão só pode ser registrada pelo profissional' using errcode = '42501';
      end if;
    else
      if new.reviewed_by is distinct from old.reviewed_by then
        raise exception 'revisão só pode ser registrada pelo profissional' using errcode = '42501';
      end if;
      if new.instructions is distinct from old.instructions then
        new.reviewed_by := null;
        new.published := false;
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger exercises_protect_review before insert or update on public.exercises
  for each row execute function public.protect_exercise_review();

-- Aluno altera somente photos_allowed no vínculo, e só com consentimento vigente.
create function public.protect_professional_students() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.professional_id is distinct from old.professional_id
       or new.student_id is distinct from old.student_id
       or new.subscription_id is distinct from old.subscription_id
       or new.status is distinct from old.status
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at then
      raise exception 'somente photos_allowed pode ser alterado' using errcode = '42501';
    end if;
  end if;
  if new.photos_allowed and not public.has_consent(new.student_id, 'photos_professional') then
    raise exception 'liberar fotos exige consentimento específico' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger professional_students_protect before update on public.professional_students
  for each row execute function public.protect_professional_students();

-- Consentimento é imutável, exceto a revogação. Revogar fotos corta o acesso do profissional na hora.
create function public.protect_consents() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.profile_id is distinct from old.profile_id
     or new.type is distinct from old.type
     or new.document_version is distinct from old.document_version
     or new.granted_at is distinct from old.granted_at
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'consentimento só aceita revogação' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger consents_protect before update on public.consents
  for each row execute function public.protect_consents();

create function public.apply_consent_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null and new.type in ('photos', 'photos_professional') then
    update public.professional_students set photos_allowed = false where student_id = new.profile_id;
  end if;
  return new;
end;
$$;
create trigger consents_apply_revocation after update on public.consents
  for each row execute function public.apply_consent_revocation();

-- Aluno envia check-in (só resposta e status); profissional só marca como analisado.
create function public.protect_checkins() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.professional_student_id is distinct from old.professional_student_id
       or new.due_on is distinct from old.due_on then
      raise exception 'check-in não pode ser movido' using errcode = '42501';
    end if;
    if public.checkin_student(old.id) = (select auth.uid()) then
      if old.status <> 'pending' or new.status <> 'submitted' then
        raise exception 'check-in já enviado' using errcode = '42501';
      end if;
      new.submitted_at := now();
    elsif new.answers is distinct from old.answers or new.submitted_at is distinct from old.submitted_at then
      raise exception 'respostas pertencem ao aluno' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger checkins_protect before update on public.checkins
  for each row execute function public.protect_checkins();

-- audit_logs é somente inserção, para qualquer papel.
create function public.deny_audit_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs é somente inserção' using errcode = '42501';
end;
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.deny_audit_change();

-- ---------------------------------------------------------------------------
-- Vagas do Black (somente servidor). O bloqueio consultivo serializa a contagem e evita corrida.
-- ---------------------------------------------------------------------------
create function public.black_slots_used(p_professional_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select (
    select count(*) from public.professional_students ps
    where ps.professional_id = p_professional_id and ps.status = 'active'
      and (ps.ends_at is null or ps.ends_at > now())
  )::integer + (
    select count(*) from public.black_slot_reservations r
    where r.professional_id = p_professional_id
      and ((r.status = 'pending' and r.expires_at > now()) or r.status = 'paid')
  )::integer;
$$;

create function public.reserve_black_slot(p_student_id uuid, p_minutes integer default 30) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_professional uuid;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('auge_fit_black_slots'));

  update public.black_slot_reservations
    set status = 'expired'
    where status = 'pending' and expires_at <= now();

  select id into v_existing from public.black_slot_reservations
    where student_id = p_student_id and status = 'pending' and expires_at > now()
    limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select pr.id into v_professional
  from public.professionals pr
  where pr.status = 'active' and pr.cref_verified_at is not null
    and public.black_slots_used(pr.id) < pr.capacity
  order by public.black_slots_used(pr.id), pr.created_at
  limit 1;

  if v_professional is null then
    return null;
  end if;

  insert into public.black_slot_reservations (professional_id, student_id, expires_at)
  values (v_professional, p_student_id, now() + make_interval(mins => p_minutes))
  returning id into v_id;
  return v_id;
end;
$$;

-- O vínculo inicia as 8 semanas e consome a reserva paga, se houver, do mesmo profissional.
create function public.link_black_student(
  p_subscription_id uuid, p_professional_id uuid, p_actor uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid;
  v_reserved uuid;
  v_capacity integer;
  v_link uuid;
  v_ends timestamptz := now() + interval '56 days';
begin
  perform pg_advisory_xact_lock(hashtext('auge_fit_black_slots'));

  select s.profile_id into v_student
  from public.subscriptions s
  join public.plan_prices pp on pp.id = s.plan_price_id
  join public.plans pl on pl.id = pp.plan_id
  where s.id = p_subscription_id and s.status = 'active' and pl.code = 'black'
    and s.current_period_end is null;
  if v_student is null then
    raise exception 'assinatura Black paga e sem vínculo não encontrada' using errcode = 'P0002';
  end if;

  select capacity into v_capacity from public.professionals
    where id = p_professional_id and status = 'active' and cref_verified_at is not null;
  if v_capacity is null then
    raise exception 'profissional inválido' using errcode = '23514';
  end if;

  select id into v_reserved from public.black_slot_reservations
    where subscription_id = p_subscription_id and professional_id = p_professional_id and status = 'paid'
    limit 1;

  if v_reserved is null and public.black_slots_used(p_professional_id) >= v_capacity then
    raise exception 'profissional sem vagas' using errcode = '23514';
  end if;

  update public.black_slot_reservations set status = 'linked'
    where subscription_id = p_subscription_id and status in ('pending', 'paid');

  insert into public.professional_students (professional_id, student_id, subscription_id, starts_at, ends_at)
  values (p_professional_id, v_student, p_subscription_id, now(), v_ends)
  returning id into v_link;

  update public.subscriptions set current_period_end = v_ends, grace_until = null
    where id = p_subscription_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (p_actor, 'black.link', 'professional_students', v_link::text,
          jsonb_build_object('subscription_id', p_subscription_id, 'professional_id', p_professional_id));
  return v_link;
end;
$$;

-- Resgate de cupom com trava na linha: limite de usos sem corrida.
create function public.redeem_coupon(p_coupon_id uuid, p_profile_id uuid, p_payment_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
  v_used integer;
begin
  select max_uses into v_max from public.coupons where id = p_coupon_id for update;
  if not found then
    return false;
  end if;
  select count(*) into v_used from public.coupon_redemptions where coupon_id = p_coupon_id;
  if v_max is not null and v_used >= v_max then
    return false;
  end if;
  insert into public.coupon_redemptions (coupon_id, profile_id, payment_id)
  values (p_coupon_id, p_profile_id, p_payment_id)
  on conflict (coupon_id, profile_id) do nothing;
  return found;
end;
$$;

-- Limite de uso: incrementa e devolve o total da janela.
create function public.rate_limit_hit(p_key text, p_window_seconds integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execução: o padrão do Postgres concede a PUBLIC; fechamos o que é exclusivo do servidor.
-- ---------------------------------------------------------------------------
revoke execute on function public.reserve_black_slot(uuid, integer) from public, anon, authenticated;
revoke execute on function public.link_black_student(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.redeem_coupon(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
revoke execute on function public.black_slots_used(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.reserve_black_slot(uuid, integer) to service_role;
grant execute on function public.link_black_student(uuid, uuid, uuid) to service_role;
grant execute on function public.redeem_coupon(uuid, uuid, uuid) to service_role;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
grant execute on function public.black_slots_used(uuid) to service_role;
