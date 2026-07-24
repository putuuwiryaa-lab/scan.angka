alter table public.adaptive_predictions
  add column if not exists chance_probability double precision,
  add column if not exists chance_unique_target_count smallint,
  add column if not exists chance_model_version text,
  add column if not exists chance_benchmarked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'adaptive_predictions_chance_probability_valid'
      and conrelid = 'public.adaptive_predictions'::regclass
  ) then
    alter table public.adaptive_predictions
      add constraint adaptive_predictions_chance_probability_valid
      check (
        chance_probability is null
        or (chance_probability >= 0 and chance_probability <= 1)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'adaptive_predictions_chance_target_count_valid'
      and conrelid = 'public.adaptive_predictions'::regclass
  ) then
    alter table public.adaptive_predictions
      add constraint adaptive_predictions_chance_target_count_valid
      check (
        chance_unique_target_count is null
        or chance_unique_target_count between 1 and 4
      );
  end if;
end;
$$;

create or replace function public.adaptive_combination(
  p_total integer,
  p_selected integer
)
returns numeric
language plpgsql
immutable
strict
as $$
declare
  reduced integer;
  index_value integer;
  result numeric := 1;
begin
  if p_total < 0 or p_selected < 0 or p_selected > p_total then
    return 0;
  end if;

  reduced := least(p_selected, p_total - p_selected);
  if reduced = 0 then
    return 1;
  end if;

  for index_value in 1..reduced loop
    result := result * (p_total - reduced + index_value) / index_value;
  end loop;

  return result;
end;
$$;

create or replace function public.adaptive_target_segment(
  p_actual_result text,
  p_output_type text,
  p_target text
)
returns text
language plpgsql
immutable
strict
as $$
begin
  if p_actual_result !~ '^\d{4}$' then
    return null;
  end if;

  if p_output_type = 'position' then
    return case p_target
      when 'A' then substr(p_actual_result, 1, 1)
      when 'C' then substr(p_actual_result, 2, 1)
      when 'K' then substr(p_actual_result, 3, 1)
      when 'E' then substr(p_actual_result, 4, 1)
      else null
    end;
  end if;

  return case p_target
    when '2d_depan' then substr(p_actual_result, 1, 2)
    when '2d_tengah' then substr(p_actual_result, 2, 2)
    when '2d_belakang' then substr(p_actual_result, 3, 2)
    when '3d_depan' then substr(p_actual_result, 1, 3)
    when '3d_belakang' then substr(p_actual_result, 2, 3)
    when '4d' then substr(p_actual_result, 1, 4)
    else null
  end;
end;
$$;

create or replace function public.adaptive_unique_target_count(
  p_actual_result text,
  p_output_type text,
  p_target text
)
returns integer
language plpgsql
immutable
strict
as $$
declare
  segment text;
  unique_count integer;
begin
  segment := public.adaptive_target_segment(
    p_actual_result,
    p_output_type,
    p_target
  );

  if segment is null or segment = '' then
    return 0;
  end if;

  select count(distinct digit)::integer
    into unique_count
  from unnest(string_to_array(segment, null)) as digit;

  return coalesce(unique_count, 0);
end;
$$;

create or replace function public.adaptive_chance_probability(
  p_output_type text,
  p_target text,
  p_digit_count integer,
  p_actual_result text
)
returns double precision
language plpgsql
immutable
strict
as $$
declare
  normalized_digit_count integer := greatest(1, least(9, p_digit_count));
  unique_target_count integer;
  total_selections numeric;
  favorable_selections numeric;
  probability numeric := 0;
begin
  unique_target_count := public.adaptive_unique_target_count(
    p_actual_result,
    p_output_type,
    p_target
  );

  if unique_target_count < 1 then
    return null;
  end if;

  total_selections := public.adaptive_combination(10, normalized_digit_count);

  if p_output_type = 'position' then
    probability := normalized_digit_count::numeric / 10;
  elsif p_output_type = 'ai' then
    favorable_selections := public.adaptive_combination(
      10 - unique_target_count,
      normalized_digit_count
    );
    probability := 1 - favorable_selections / total_selections;
  elsif p_output_type = 'bbfs' then
    if normalized_digit_count < unique_target_count then
      probability := 0;
    else
      favorable_selections := public.adaptive_combination(
        10 - unique_target_count,
        normalized_digit_count - unique_target_count
      );
      probability := favorable_selections / total_selections;
    end if;
  else
    return null;
  end if;

  return greatest(0, least(1, probability::double precision));
end;
$$;

create or replace function public.set_adaptive_prediction_chance_benchmark()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'settled'
    and new.actual_result is not null
    and new.actual_result ~ '^\d{4}$'
  then
    new.chance_probability := public.adaptive_chance_probability(
      new.output_type,
      new.target,
      new.digit_count,
      new.actual_result
    );
    new.chance_unique_target_count := public.adaptive_unique_target_count(
      new.actual_result,
      new.output_type,
      new.target
    );
    new.chance_model_version := 'conditional-combinatorial-v1';
    new.chance_benchmarked_at := coalesce(new.chance_benchmarked_at, now());
  elsif new.status <> 'settled' then
    new.chance_probability := null;
    new.chance_unique_target_count := null;
    new.chance_model_version := null;
    new.chance_benchmarked_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists adaptive_predictions_chance_benchmark_trg
  on public.adaptive_predictions;

create trigger adaptive_predictions_chance_benchmark_trg
before insert or update
on public.adaptive_predictions
for each row
execute function public.set_adaptive_prediction_chance_benchmark();

update public.adaptive_predictions
set
  chance_probability = public.adaptive_chance_probability(
    output_type,
    target,
    digit_count,
    actual_result
  ),
  chance_unique_target_count = public.adaptive_unique_target_count(
    actual_result,
    output_type,
    target
  ),
  chance_model_version = 'conditional-combinatorial-v1',
  chance_benchmarked_at = coalesce(chance_benchmarked_at, now())
where status = 'settled'
  and actual_result is not null
  and actual_result ~ '^\d{4}$';

create index if not exists adaptive_predictions_chance_benchmark_idx
  on public.adaptive_predictions (
    market_id,
    output_type,
    target,
    digit_count,
    settled_at desc
  )
  where status = 'settled'
    and chance_probability is not null;

comment on column public.adaptive_predictions.chance_probability is
  'Exact conditional probability that a uniformly random digit set of digit_count would satisfy the configured Position, AI, or BBFS objective for actual_result.';

comment on column public.adaptive_predictions.chance_unique_target_count is
  'Number of distinct target digits in actual_result used by the exact combinatorial benchmark.';

comment on column public.adaptive_predictions.chance_model_version is
  'Version identifier for the chance benchmark formula. This metric is audit-only and never gates publication.';
