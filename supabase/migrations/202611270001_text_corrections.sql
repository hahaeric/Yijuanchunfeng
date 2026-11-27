-- Public paragraph corrections. Restore is an explicit write of the project text.
create table if not exists public.text_corrections (
  lesson_id text primary key check (char_length(lesson_id) between 1 and 128),
  text text not null check (char_length(text) between 1 and 8000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.text_corrections enable row level security;
revoke all on public.text_corrections from anon, authenticated;
create or replace function public.text_get_corrections()
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('lessonId',lesson_id,'text',text,'updatedAt',updated_at) order by lesson_id), '[]'::jsonb) from public.text_corrections;
$$;
create or replace function public.text_apply_corrections(p_upserts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entry jsonb;
begin
 if p_upserts is null or jsonb_typeof(p_upserts) <> 'array' then
   raise exception 'Invalid text corrections payload' using errcode = '22023';
 end if;
 if jsonb_array_length(p_upserts) > 50 or octet_length(p_upserts::text) > 2000000 then
   raise exception 'Invalid text corrections payload' using errcode = '22023';
 end if;
 for entry in select * from jsonb_array_elements(p_upserts) loop
   if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'lessonId') is distinct from 'string'
      or jsonb_typeof(entry->'text') is distinct from 'string'
      or char_length(entry->>'lessonId') not between 1 and 128
      or char_length(entry->>'text') not between 1 and 8000 then
     raise exception 'Invalid text correction' using errcode = '22023';
   end if;
   insert into public.text_corrections(lesson_id,text,updated_at,updated_by)
   values(entry->>'lessonId',entry->>'text',clock_timestamp(),auth.uid())
   on conflict (lesson_id) do update set text=excluded.text,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 end loop;
 return public.text_get_corrections();
end $$;
revoke all on function public.text_get_corrections() from public;
revoke all on function public.text_apply_corrections(jsonb) from public;
grant execute on function public.text_get_corrections() to anon, authenticated;
grant execute on function public.text_apply_corrections(jsonb) to anon, authenticated;
