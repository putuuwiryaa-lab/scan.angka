create table if not exists public.adaptive_predictions (
  id uuid primary key default gen_random_uuid(),
  prediction_key text not null unique,
  market_id text not null references public.markets(id) on delete cascade,
  request_source text not null check (request_source in ('movement', 'batch_primary', 'batch_secondary')),
  source_result text not null check (source_result ~ '^\d{4}$'),
  source_history_size integer not null check (source_history_size >= 1),
  output_type text not null check (output_type in ('position', 'ai', 'bbfs')),
  target text not null,
  digit_count smallint not null check (digit_count between 1 and 9),
  selected_digits smallint[] not null,
  selected_method text not null,
  selected_window integer not null check (selected_window >= 14),
  l14_hit smallint not null check (l14_hit >= 0),
  l14_total smallint not null check (l14_total >= 0),
  selection_hit smallint not null check (selection_hit >= 0),
  selection_total smallint not null check (selection_total >= 0),
  confidence smallint not null check (confidence between 0 and 100),
  strength text not null check (strength in ('KUAT', 'CUKUP', 'PANTAU')),
  regime text not null check (regime in ('TREND', 'ZIGZAG', 'REVERSAL', 'STABIL', 'CHAOTIC')),
  tie_break_status text not null check (tie_break_status in ('not_needed', 'resolved', 'history_limit')),
  candidate_count integer not null check (candidate_count >= 1),
  probabilities jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'settled', 'invalidated')),
  actual_result text check (actual_result is null or actual_result ~ '^\d{4}$'),
  is_hit boolean,
  settlement_error text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint adaptive_predictions_selected_digits_valid check (
    cardinality(selected_digits) between 1 and 9
    and selected_digits <@ array[0,1,2,3,4,5,6,7,8,9]::smallint[]
  ),
  constraint adaptive_predictions_settlement_consistent check (
    (status = 'pending' and actual_result is null and is_hit is null and settled_at is null)
    or (status = 'settled' and actual_result is not null and is_hit is not null and settled_at is not null)
    or (status = 'invalidated' and actual_result is null and is_hit is null and settled_at is not null)
  )
);

create index if not exists adaptive_predictions_market_status_idx
  on public.adaptive_predictions (market_id, status, source_history_size);

create index if not exists adaptive_predictions_settled_at_idx
  on public.adaptive_predictions (settled_at desc)
  where status = 'settled';

create index if not exists adaptive_predictions_model_idx
  on public.adaptive_predictions (market_id, output_type, target, digit_count, selected_method, selected_window);

alter table public.adaptive_predictions enable row level security;

comment on table public.adaptive_predictions is
  'Immutable live Adaptive Movement predictions. Rows are settled only against the first result appended after source_history_size.';

comment on column public.adaptive_predictions.prediction_key is
  'Deterministic key preventing duplicate records when the same prediction is requested repeatedly.';
