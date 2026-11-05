-- Auge Fit: tabelas. Valores em centavos, datas em timestamptz, enums por check.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'professional', 'admin')),
  full_name text not null default '' check (char_length(full_name) <= 120),
  birth_date date,
  status text not null default 'active' check (status in ('active', 'suspended')),
  marketing_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create table public.student_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  goal text check (goal in ('hypertrophy', 'definition', 'conditioning', 'calisthenics', 'organization')),
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  onboarded_at timestamptz
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('terms', 'privacy', 'health_data', 'photos', 'photos_professional', 'marketing')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_profile_idx on public.consents (profile_id, type);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basic', 'pro', 'black')),
  name text not null,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete restrict,
  interval text not null check (interval in ('month', 'quarter', 'package')),
  amount_cents integer not null check (amount_cents > 0),
  provider_ref text,
  active boolean not null default true,
  unique (plan_id, interval)
);
create index plan_prices_plan_idx on public.plan_prices (plan_id);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 40),
  discount_percent integer not null check (discount_percent between 1 and 100),
  campaign text,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Conta excluída: o registro financeiro permanece sem vínculo com a pessoa (profile_id nulo).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  plan_price_id uuid not null references public.plan_prices (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired', 'refunded')),
  expected_amount_cents integer not null check (expected_amount_cents >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  current_period_end timestamptz,
  grace_until timestamptz,
  provider_id text unique,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_profile_idx on public.subscriptions (profile_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  status text not null check (status in ('pending', 'approved', 'rejected', 'refunded', 'cancelled', 'amount_mismatch')),
  amount_cents integer not null check (amount_cents >= 0),
  method text,
  provider_payment_id text not null unique,
  paid_at timestamptz,
  refund_requested_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_subscription_idx on public.payments (subscription_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_key text not null unique,
  topic text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, profile_id)
);
create index coupon_redemptions_profile_idx on public.coupon_redemptions (profile_id);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete restrict,
  cref_number text not null check (char_length(cref_number) between 3 and 20),
  cref_uf text not null check (cref_uf ~ '^[A-Z]{2}$'),
  cref_verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  capacity integer not null default 15 check (capacity >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.professional_students (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  photos_allowed boolean not null default false
);
create index professional_students_pro_idx on public.professional_students (professional_id, status);
create index professional_students_student_idx on public.professional_students (student_id, status);
create unique index professional_students_one_active_idx
  on public.professional_students (professional_id, student_id) where status = 'active';

create table public.black_slot_reservations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'linked', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);
create index black_slot_reservations_pro_idx on public.black_slot_reservations (professional_id, status);
create index black_slot_reservations_student_idx on public.black_slot_reservations (student_id, status);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  source text not null check (source in ('landing', 'black_sold_out')),
  plan_code text check (plan_code in ('basic', 'pro', 'black')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email, source)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  muscle_group text not null check (char_length(muscle_group) between 2 and 60),
  instructions text,
  media_path text,
  reviewed_by uuid references public.professionals (id) on delete restrict,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint exercises_published_requires_review check (not published or reviewed_by is not null)
);
create index exercises_published_idx on public.exercises (published);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('own', 'prescribed', 'catalog')),
  name text not null check (char_length(name) between 1 and 120),
  student_id uuid references public.profiles (id) on delete cascade,
  author_professional_id uuid references public.professionals (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plans_kind_shape check (
    (kind = 'own' and student_id is not null and author_professional_id is null)
    or (kind = 'prescribed' and student_id is not null and author_professional_id is not null)
    or (kind = 'catalog' and student_id is null and author_professional_id is not null)
  )
);
create index workout_plans_student_idx on public.workout_plans (student_id, kind);
create index workout_plans_author_idx on public.workout_plans (author_professional_id);
create index workout_plans_kind_status_idx on public.workout_plans (kind, status);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0
);
create index workouts_plan_idx on public.workouts (plan_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets integer not null default 3 check (sets between 1 and 20),
  reps_target text check (char_length(reps_target) <= 20),
  rest_seconds integer check (rest_seconds between 0 and 900),
  notes text check (char_length(notes) <= 500)
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  workout_name text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index workout_logs_student_idx on public.workout_logs (student_id, started_at desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_number integer not null check (set_number between 1 and 50),
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps integer not null check (reps between 0 and 1000),
  client_uuid uuid not null unique,
  logged_at timestamptz not null default now()
);
create index set_logs_log_idx on public.set_logs (workout_log_id);
create index set_logs_exercise_idx on public.set_logs (exercise_id, logged_at desc);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg > 0),
  waist_cm numeric(5, 2) check (waist_cm > 0),
  chest_cm numeric(5, 2) check (chest_cm > 0),
  hip_cm numeric(5, 2) check (hip_cm > 0),
  arm_cm numeric(5, 2) check (arm_cm > 0),
  thigh_cm numeric(5, 2) check (thigh_cm > 0),
  created_at timestamptz not null default now()
);
create index body_measurements_profile_idx on public.body_measurements (profile_id, measured_on desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  pose text not null check (pose in ('front', 'side', 'back')),
  taken_on date not null,
  created_at timestamptz not null default now()
);
create index progress_photos_profile_idx on public.progress_photos (profile_id, taken_on desc);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  professional_student_id uuid not null references public.professional_students (id) on delete cascade,
  due_on date not null,
  submitted_at timestamptz,
  answers jsonb,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'reviewed')),
  unique (professional_student_id, due_on)
);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  author_professional_id uuid not null references public.professionals (id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index feedbacks_checkin_idx on public.feedbacks (checkin_id);
create index feedbacks_author_idx on public.feedbacks (author_professional_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  template text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  dedupe_key text unique,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- Limite de uso sem infraestrutura adicional: contador por janela, acessado só pelo servidor.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
