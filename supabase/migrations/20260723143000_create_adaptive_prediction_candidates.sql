create table if not exists public.adaptive_prediction_candidates (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.adaptive_predictions(id) on delete cascade,
  initial_rank smallint not null check (initial_rank >= 1),
  method text not null,
  "window" integer not null check ("window" >= 14),
  selected_digits smallint[] not null,
  probabilities jsonb not null default '[]'::jsonb,
  selection_score numeric(12, 9) not null check (selection_score >= 0 and selection_score <= 1),
  runner_up_score numeric(12, 9) not null check (runner_up_score >= 0 and runner_up_score <= 1),
  margin numeric(12, 9) not null check (margin >= 0 and margin <= 1),
  l14_hit smallint not null check (l14_hit >= 0),
  l14_total smallint not null check (l14_total >= 0),
  l7_hit smallint not null check (l7_hit >= 0),
  l3_hit smallint not null check (l3_hit >= 0),
  mean_probability numeric(7, 2) not null check (mean_probability >= 0),
  is_selected boolean not null default false,
  is_hit boolean,
  created_at timestamptz not null default now(),
  constraint adaptive_prediction_candidates_unique unique (prediction_id, method, "window"),
  constraint adaptive_prediction_candidates_digits_valid check (
    cardinality(selected_digits) between 1 and 9
    and selected_digits <@ array[0,1,2,3,4,5,6,7,8,9]::smallint[]
  )
);

create index if not exists adaptive_prediction_candidates_prediction_idx
  on public.adaptive_prediction_candidates (prediction_id, initial_rank);

create index if not exists adaptive_prediction_candidates_model_idx
  on public.adaptive_prediction_candidates (method, "window", is_hit);

create index if not exists adaptive_prediction_candidates_selected_idx
  on public.adaptive_prediction_candidates (prediction_id)
  where is_selected;

alter table public.adaptive_prediction_candidates enable row level security;

comment on table public.adaptive_prediction_candidates is
  'Live shadow outputs for every method-window candidate evaluated alongside one published adaptive prediction.';

comment on column public.adaptive_prediction_candidates."window" is
  'Training-window size for this shadow candidate. The identifier is quoted because WINDOW is a PostgreSQL keyword.';

comment on column public.adaptive_prediction_candidates.is_hit is
  'Null while the parent prediction is pending or invalidated; set against the same first appended result when the parent settles.';