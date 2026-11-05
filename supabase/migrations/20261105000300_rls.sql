-- Auge Fit: RLS ligada em todas as tabelas do schema public.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_linked_professional(id) or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- student_profiles
create policy student_profiles_select on public.student_profiles for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_linked_professional(profile_id) or public.is_admin());
create policy student_profiles_update on public.student_profiles for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- consents
create policy consents_select on public.consents for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy consents_insert on public.consents for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy consents_update on public.consents for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- plans e plan_prices
create policy plans_select on public.plans for select to anon, authenticated
  using (active or public.is_admin());
create policy plans_admin_insert on public.plans for insert to authenticated with check (public.is_admin());
create policy plans_admin_update on public.plans for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy plans_admin_delete on public.plans for delete to authenticated using (public.is_admin());

create policy plan_prices_select on public.plan_prices for select to anon, authenticated
  using (active or public.is_admin());
create policy plan_prices_admin_insert on public.plan_prices for insert to authenticated with check (public.is_admin());
create policy plan_prices_admin_update on public.plan_prices for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy plan_prices_admin_delete on public.plan_prices for delete to authenticated using (public.is_admin());

-- subscriptions e payments: escrita só pelo servidor
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and s.profile_id = (select auth.uid())
    )
  );

-- webhook_events e audit_logs: só leitura do admin; escrita pelo servidor
create policy webhook_events_select on public.webhook_events for select to authenticated using (public.is_admin());
create policy audit_logs_select on public.audit_logs for select to authenticated using (public.is_admin());

-- coupons
create policy coupons_admin_select on public.coupons for select to authenticated using (public.is_admin());
create policy coupons_admin_insert on public.coupons for insert to authenticated with check (public.is_admin());
create policy coupons_admin_update on public.coupons for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_select on public.coupon_redemptions for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- professionals
create policy professionals_select on public.professionals for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy professionals_admin_update on public.professionals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- professional_students
create policy professional_students_select on public.professional_students for select to authenticated
  using (
    student_id = (select auth.uid())
    or professional_id = public.current_professional_id()
    or public.is_admin()
  );
create policy professional_students_student_update on public.professional_students for update to authenticated
  using (student_id = (select auth.uid()) or public.is_admin())
  with check (student_id = (select auth.uid()) or public.is_admin());
create policy professional_students_admin_insert on public.professional_students for insert to authenticated
  with check (public.is_admin());
create policy professional_students_admin_delete on public.professional_students for delete to authenticated
  using (public.is_admin());

-- black_slot_reservations
create policy black_slot_select on public.black_slot_reservations for select to authenticated
  using (student_id = (select auth.uid()) or public.is_admin());

-- waitlist_entries: só o servidor grava, só o admin lê
create policy waitlist_select on public.waitlist_entries for select to authenticated using (public.is_admin());

-- exercises
create policy exercises_select on public.exercises for select to authenticated
  using (published or public.current_professional_id() is not null or public.is_admin());
create policy exercises_admin_insert on public.exercises for insert to authenticated with check (public.is_admin());
create policy exercises_admin_update on public.exercises for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy exercises_admin_delete on public.exercises for delete to authenticated using (public.is_admin());

-- workout_plans, workouts, workout_exercises. Admin só lê prescribed e catalog e nunca escreve.
create policy workout_plans_select on public.workout_plans for select to authenticated
  using (public.can_read_plan_row(kind, student_id, author_professional_id, status));
create policy workout_plans_insert on public.workout_plans for insert to authenticated
  with check (
    public.can_write_plan_row(kind, student_id, author_professional_id)
    and (kind <> 'own' or public.has_entitlement((select auth.uid()), 'log_workouts'))
  );
create policy workout_plans_update on public.workout_plans for update to authenticated
  using (public.can_write_plan_row(kind, student_id, author_professional_id))
  with check (public.can_write_plan_row(kind, student_id, author_professional_id));
create policy workout_plans_delete on public.workout_plans for delete to authenticated
  using (public.can_write_plan_row(kind, student_id, author_professional_id));

create policy workouts_select on public.workouts for select to authenticated using (public.can_read_plan(plan_id));
create policy workouts_insert on public.workouts for insert to authenticated with check (public.can_write_plan(plan_id));
create policy workouts_update on public.workouts for update to authenticated
  using (public.can_write_plan(plan_id)) with check (public.can_write_plan(plan_id));
create policy workouts_delete on public.workouts for delete to authenticated using (public.can_write_plan(plan_id));

create policy workout_exercises_select on public.workout_exercises for select to authenticated
  using (public.can_read_workout(workout_id));
create policy workout_exercises_insert on public.workout_exercises for insert to authenticated
  with check (public.can_write_workout(workout_id));
create policy workout_exercises_update on public.workout_exercises for update to authenticated
  using (public.can_write_workout(workout_id)) with check (public.can_write_workout(workout_id));
create policy workout_exercises_delete on public.workout_exercises for delete to authenticated
  using (public.can_write_workout(workout_id));

-- workout_logs e set_logs: assinatura vencida lê, mas não registra novos treinos
create policy workout_logs_select on public.workout_logs for select to authenticated
  using (student_id = (select auth.uid()) or public.is_linked_professional(student_id));
create policy workout_logs_insert on public.workout_logs for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and public.has_entitlement((select auth.uid()), 'log_workouts')
    and (workout_id is null or public.can_read_workout(workout_id))
  );
create policy workout_logs_update on public.workout_logs for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy workout_logs_delete on public.workout_logs for delete to authenticated
  using (student_id = (select auth.uid()));

create policy set_logs_select on public.set_logs for select to authenticated
  using (
    public.log_student(workout_log_id) = (select auth.uid())
    or public.is_linked_professional(public.log_student(workout_log_id))
  );
create policy set_logs_insert on public.set_logs for insert to authenticated
  with check (
    public.log_student(workout_log_id) = (select auth.uid())
    and public.has_entitlement((select auth.uid()), 'log_workouts')
  );
create policy set_logs_update on public.set_logs for update to authenticated
  using (public.log_student(workout_log_id) = (select auth.uid()))
  with check (public.log_student(workout_log_id) = (select auth.uid()));
create policy set_logs_delete on public.set_logs for delete to authenticated
  using (public.log_student(workout_log_id) = (select auth.uid()));

-- body_measurements
create policy body_measurements_select on public.body_measurements for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_linked_professional(profile_id));
create policy body_measurements_insert on public.body_measurements for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.has_consent((select auth.uid()), 'health_data')
    and public.has_entitlement((select auth.uid()), 'progress')
  );
create policy body_measurements_update on public.body_measurements for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy body_measurements_delete on public.body_measurements for delete to authenticated
  using (profile_id = (select auth.uid()));

-- progress_photos: admin sem acesso
create policy progress_photos_select on public.progress_photos for select to authenticated
  using (profile_id = (select auth.uid()) or public.professional_can_view_photos(profile_id));
create policy progress_photos_insert on public.progress_photos for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.has_consent((select auth.uid()), 'photos')
    and public.has_entitlement((select auth.uid()), 'progress')
  );
create policy progress_photos_delete on public.progress_photos for delete to authenticated
  using (profile_id = (select auth.uid()));

-- checkins: admin sem acesso à tabela; status só por admin_checkin_status()
create policy checkins_select on public.checkins for select to authenticated
  using (
    public.link_student(professional_student_id) = (select auth.uid())
    or public.link_is_mine_and_active(professional_student_id)
  );
create policy checkins_professional_insert on public.checkins for insert to authenticated
  with check (public.link_is_mine_and_active(professional_student_id));
create policy checkins_update on public.checkins for update to authenticated
  using (
    public.link_student(professional_student_id) = (select auth.uid())
    or public.link_is_mine_and_active(professional_student_id)
  )
  with check (
    public.link_student(professional_student_id) = (select auth.uid())
    or public.link_is_mine_and_active(professional_student_id)
  );

-- feedbacks
create policy feedbacks_select on public.feedbacks for select to authenticated
  using (
    (published_at is not null and public.checkin_student(checkin_id) = (select auth.uid()))
    or (author_professional_id = public.current_professional_id() and public.checkin_is_mine_as_professional(checkin_id))
  );
create policy feedbacks_insert on public.feedbacks for insert to authenticated
  with check (
    author_professional_id = public.current_professional_id()
    and public.checkin_is_mine_as_professional(checkin_id)
  );
create policy feedbacks_update on public.feedbacks for update to authenticated
  using (author_professional_id = public.current_professional_id() and public.checkin_is_mine_as_professional(checkin_id))
  with check (author_professional_id = public.current_professional_id() and public.checkin_is_mine_as_professional(checkin_id));

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- rate_limits: RLS ligada e nenhuma política; só a chave de serviço acessa.
