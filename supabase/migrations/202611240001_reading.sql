-- Run once in the free Supabase project's SQL Editor.
-- Only application reading data lives here; passwords belong to Supabase Auth.
create table if not exists public.reading_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.reading_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  read_bits bit varying not null default B'',
  read_count bigint generated always as (bit_count(read_bits)) stored,
  primary key(user_id, day),
  check (bit_length(read_bits) <= 16384)
);
alter table public.reading_progress enable row level security;
alter table public.reading_daily enable row level security;
-- No direct writes: all updates must pass authenticated, validated RPCs.
revoke all on public.reading_progress, public.reading_daily from anon, authenticated;
grant select on public.reading_progress, public.reading_daily to authenticated;
drop policy if exists reading_progress_owner on public.reading_progress;
create policy reading_progress_owner on public.reading_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists reading_daily_owner on public.reading_daily;
create policy reading_daily_owner on public.reading_daily for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.reading_get_backup()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid();
  row_value public.reading_progress%rowtype;
  counts jsonb;
  today_ids jsonb;
  today_key date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if who is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into row_value from public.reading_progress where user_id = who;
  select coalesce(jsonb_object_agg(day::text, read_count), '{}'::jsonb) into counts from public.reading_daily where user_id = who;
  select coalesce(jsonb_agg(i), '[]'::jsonb) into today_ids
  from public.reading_daily d cross join lateral generate_series(0, bit_length(d.read_bits) - 1) i
  where d.user_id = who and d.day = today_key and get_bit(d.read_bits, i) = 1;
  return jsonb_build_object('revision', coalesce(row_value.revision, 0), 'updated', row_value.updated_at,
    'snapshot', coalesce(row_value.progress, '{}'::jsonb) || jsonb_build_object('dailyCounts', counts, 'history', jsonb_build_object(today_key::text, today_ids)));
end $$;

create or replace function public.reading_save_backup(p_revision bigint, p_progress jsonb, p_days jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid();
  current_revision bigint;
  day_entry record;
  day_value date;
  id_value jsonb;
  id_index integer;
  bits bit varying;
  today_key date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if who is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_revision is null or p_revision < 0 or p_progress is null or jsonb_typeof(p_progress) <> 'object'
    or octet_length(p_progress::text) > 150000 or p_days is null or jsonb_typeof(p_days) <> 'object'
    or octet_length(p_days::text) > 2000000 then raise exception 'Invalid backup' using errcode = '22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_progress) k where k not in ('currentLessonId','contentRevision','zhouyiOrderVersion','positions','readIndices')) then
    raise exception 'Only reading progress may be uploaded' using errcode = '22023'; end if;
  if (p_progress ? 'positions' and jsonb_typeof(p_progress->'positions') <> 'object')
    or (p_progress ? 'readIndices' and jsonb_typeof(p_progress->'readIndices') <> 'array') then raise exception 'Invalid progress' using errcode = '22023'; end if;
  insert into public.reading_progress(user_id) values(who) on conflict do nothing;
  select revision into current_revision from public.reading_progress where user_id = who for update;
  if current_revision <> p_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  for day_entry in select * from jsonb_each(p_days) loop
    if day_entry.key !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(day_entry.value) <> 'array' then raise exception 'Invalid reading day' using errcode = '22023'; end if;
    day_value := day_entry.key::date;
    if day_value > today_key or day_value < date '2020-01-01' then raise exception 'Invalid reading day' using errcode = '22023'; end if;
    select read_bits into bits from public.reading_daily where user_id = who and day = day_value;
    bits := coalesce(bits, B'');
    for id_value in select * from jsonb_array_elements(day_entry.value) loop
      if jsonb_typeof(id_value) <> 'number' or id_value::text !~ '^\d+$' then raise exception 'Invalid reading ID' using errcode = '22023'; end if;
      id_index := id_value::text::integer;
      if id_index < 0 or id_index >= 16384 then raise exception 'Invalid reading ID' using errcode = '22023'; end if;
      if bit_length(bits) <= id_index then bits := (bits::text || repeat('0', id_index + 1 - bit_length(bits)))::bit varying; end if;
      bits := set_bit(bits, id_index, 1);
    end loop;
    insert into public.reading_daily(user_id,day,read_bits) values(who,day_value,bits)
    on conflict(user_id,day) do update set read_bits = excluded.read_bits;
  end loop;
  update public.reading_progress set progress=p_progress, revision=current_revision+1, updated_at=now() where user_id=who;
  return public.reading_get_backup();
end $$;

create or replace function public.reading_admin_stats(p_from date default null, p_to date default null, p_username text default '', p_offset integer default 0, p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Administrator required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into result from (
    select split_part(u.email,'@',1) as username, d.day::text as date, d.read_count as count
    from public.reading_daily d join auth.users u on u.id=d.user_id
    where (p_from is null or d.day >= p_from) and (p_to is null or d.day <= p_to)
      and position(lower(coalesce(p_username,'')) in lower(split_part(u.email,'@',1))) > 0
    order by d.day desc, u.id limit greatest(1,least(p_limit,500)) offset greatest(0,p_offset)
  ) t;
  return result;
end $$;
revoke all on function public.reading_get_backup() from public, anon;
revoke all on function public.reading_save_backup(bigint,jsonb,jsonb) from public, anon;
revoke all on function public.reading_admin_stats(date,date,text,integer,integer) from public, anon;
grant execute on function public.reading_get_backup() to authenticated;
grant execute on function public.reading_save_backup(bigint,jsonb,jsonb) to authenticated;
grant execute on function public.reading_admin_stats(date,date,text,integer,integer) to authenticated;
