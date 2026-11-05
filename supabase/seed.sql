-- Estrutura e catálogo. Nunca usuários falsos. Preços são editáveis pelo admin depois.
insert into public.plans (code, name, features) values
  ('basic', 'Basic', '{"log_workouts": true, "progress": true, "library": true, "programs": false, "nutrition_app": false, "individual_plan": false, "checkins": false}'),
  ('pro', 'Pro', '{"log_workouts": true, "progress": true, "library": true, "programs": true, "nutrition_app": true, "individual_plan": false, "checkins": false}'),
  ('black', 'Black', '{"log_workouts": true, "progress": true, "library": true, "programs": true, "nutrition_app": true, "individual_plan": true, "checkins": true}')
on conflict (code) do nothing;

insert into public.plan_prices (plan_id, interval, amount_cents)
select p.id, v.interval, v.amount_cents
from public.plans p
join (values
  ('basic', 'month', 3790),
  ('basic', 'quarter', 9990),
  ('pro', 'month', 8790),
  ('pro', 'quarter', 24700),
  ('black', 'package', 69700)
) as v (code, interval, amount_cents) on v.code = p.code
on conflict (plan_id, interval) do nothing;
