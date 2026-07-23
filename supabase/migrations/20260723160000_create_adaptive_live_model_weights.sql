create table if not exists public.adaptive_live_model_weights (
  market_id text not null references public.markets(id) on delete cascade,
  output_type text not null
    check (output_type in ('position', 'ai', 'bbfs')),
  target text not null,
  digit_count smallint not null
    check (digit_count between 1 and 9),
  method text not null
    check (
      method in (
        'delta',
        'motif',
        'cycle',
        'cross',
        'joint_pair',
        'momentum_decay',
        'transition_matrix',
        'regime_adaptive',
        'consensus',
        'walk_forward_weighted'
      )
    ),
  "window" integer not null
    check ("window" >= 14),
  decayed_hits double precision not null default 0
    check (decayed_hits >= 0),
  decayed_total double precision not null default 0
    check (decayed_total >= 0),
  observations integer not null default 0
    check (observations >= 0),
  last_candidate_id uuid references public.adaptive_prediction_candidates(id) on delete set null,
  last_result text
    check (last_result is null or last_result ~ '^\d{4}$'),
  updated_at timestamptz not null default now(),
  primary key (
    market_id,
    output_type,
    target,
    digit_count,
    method,
    "window"
  ),
  constraint adaptive_live_model_weights_hits_valid
    check (decayed_hits <= decayed_total + 0.0000001)
);

create table if not exists public.adaptive_live_weight_events (
  candidate_id uuid primary key
    references public.adaptive_prediction_candidates(id)
    on delete cascade,
  prediction_id uuid not null
    references public.adaptive_predictions(id)
    on delete cascade,
  market_id text not null references public.markets(id) on delete cascade,
  output_type text not null,
  target text not null,
  digit_count smallint not null,
  method text not null,
  "window" integer not null,
  actual_result text not null
    check (actual_result ~ '^\d{4}$'),
  is_hit boolean not null,
  applied_at timestamptz not null default now()
);

create index if not exists adaptive_live_model_weights_lookup_idx
  on public.adaptive_live_model_weights (
    market_id,
    output_type,
    target,
    digit_count,
    updated_at desc
  );

create index if not exists adaptive_live_weight_events_market_idx
  on public.adaptive_live_weight_events (
    market_id,
    applied_at desc
  );

alter table public.adaptive_live_model_weights enable row level security;
alter table public.adaptive_live_weight_events enable row level security;

create or replace function public.refresh_adaptive_live_weights_for_market(
  p_market_id text,
  p_decay double precision default 0.97
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  bounded_decay double precision := greatest(0, least(1, coalesce(p_decay, 0.97)));
  applied_count integer := 0;
begin
  for candidate in
    select
      c.id as candidate_id,
      c.prediction_id,
      c.method,
      c."window" as training_window,
      c.is_hit,
      p.market_id,
      p.output_type,
      p.target,
      p.digit_count,
      p.actual_result
    from public.adaptive_prediction_candidates c
    join public.adaptive_predictions p
      on p.id = c.prediction_id
    left join public.adaptive_live_weight_events e
      on e.candidate_id = c.id
    where p.market_id = p_market_id
      and p.status = 'settled'
      and p.actual_result is not null
      and c.is_hit is not null
      and e.candidate_id is null
    order by p.settled_at asc, c.initial_rank asc
  loop
    insert into public.adaptive_live_weight_events (
      candidate_id,
      prediction_id,
      market_id,
      output_type,
      target,
      digit_count,
      method,
      "window",
      actual_result,
      is_hit
    ) values (
      candidate.candidate_id,
      candidate.prediction_id,
      candidate.market_id,
      candidate.output_type,
      candidate.target,
      candidate.digit_count,
      candidate.method,
      candidate.training_window,
      candidate.actual_result,
      candidate.is_hit
    )
    on conflict (candidate_id) do nothing;

    if not found then
      continue;
    end if;

    insert into public.adaptive_live_model_weights (
      market_id,
      output_type,
      target,
      digit_count,
      method,
      "window",
      decayed_hits,
      decayed_total,
      observations,
      last_candidate_id,
      last_result,
      updated_at
    ) values (
      candidate.market_id,
      candidate.output_type,
      candidate.target,
      candidate.digit_count,
      candidate.method,
      candidate.training_window,
      case when candidate.is_hit then 1 else 0 end,
      1,
      1,
      candidate.candidate_id,
      candidate.actual_result,
      now()
    )
    on conflict (
      market_id,
      output_type,
      target,
      digit_count,
      method,
      "window"
    ) do update set
      decayed_hits =
        public.adaptive_live_model_weights.decayed_hits * bounded_decay
        + case when excluded.decayed_hits > 0 then 1 else 0 end,
      decayed_total =
        public.adaptive_live_model_weights.decayed_total * bounded_decay + 1,
      observations = public.adaptive_live_model_weights.observations + 1,
      last_candidate_id = excluded.last_candidate_id,
      last_result = excluded.last_result,
      updated_at = now();

    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;

revoke all on function public.refresh_adaptive_live_weights_for_market(text, double precision)
  from public, anon, authenticated;
grant execute on function public.refresh_adaptive_live_weights_for_market(text, double precision)
  to service_role;

comment on table public.adaptive_live_model_weights is
  'Exponentially decayed live hit statistics per market, output configuration, method, and training window.';

comment on table public.adaptive_live_weight_events is
  'Idempotency ledger ensuring each settled shadow candidate updates persistent live weights exactly once.';

comment on function public.refresh_adaptive_live_weights_for_market(text, double precision) is
  'Applies all unprocessed settled shadow candidates for one market to the persistent live-weight table.';
