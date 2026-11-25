-- Public pinyin corrections: last write wins, no review queue.
-- Guests (anon) and signed-in users may read and apply corrections.
create table if not exists public.pinyin_corrections (
  lesson_id text not null,
  char_index integer not null,
  character text not null,
  original_pinyin text not null default '',
  corrected_pinyin text not null,
  citation text not null default '',
  source_text text not null default '',
  source text not null default 'manual-in-app',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (lesson_id, char_index),
  check (char_index >= 0 and char_index < 100000),
  check (char_length(lesson_id) between 1 and 128),
  check (char_length(character) between 1 and 8),
  check (char_length(corrected_pinyin) between 1 and 32),
  check (char_length(original_pinyin) <= 32),
  check (char_length(citation) <= 256),
  check (char_length(source_text) <= 8000),
  check (char_length(source) <= 64)
);
alter table public.pinyin_corrections enable row level security;
revoke all on public.pinyin_corrections from anon, authenticated;

create or replace function public.pinyin_corrections_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'lessonId', lesson_id,
    'index', char_index,
    'character', character,
    'originalPinyin', original_pinyin,
    'correctedPinyin', corrected_pinyin,
    'citation', citation,
    'sourceText', source_text,
    'source', source,
    'updatedAt', updated_at
  ) order by lesson_id, char_index), '[]'::jsonb)
  from public.pinyin_corrections;
$$;

create or replace function public.pinyin_get_corrections()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.pinyin_corrections_snapshot();
end $$;

create or replace function public.pinyin_apply_corrections(p_upserts jsonb, p_deletes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  who uuid := auth.uid();
  entry jsonb;
  lesson text;
  idx integer;
  glyph text;
  original text;
  corrected text;
  citation text;
  source_text text;
  source text;
begin
  if p_upserts is null or jsonb_typeof(p_upserts) <> 'array'
    or p_deletes is null or jsonb_typeof(p_deletes) <> 'array'
    or jsonb_array_length(p_upserts) > 200
    or jsonb_array_length(p_deletes) > 200
    or octet_length(p_upserts::text) > 500000
    or octet_length(p_deletes::text) > 50000 then
    raise exception 'Invalid pinyin corrections payload' using errcode = '22023';
  end if;

  for entry in select * from jsonb_array_elements(p_deletes) loop
    if jsonb_typeof(entry) <> 'object' then raise exception 'Invalid pinyin delete' using errcode = '22023'; end if;
    lesson := entry->>'lessonId';
    begin idx := (entry->>'index')::integer; exception when others then raise exception 'Invalid pinyin delete' using errcode = '22023'; end;
    if lesson is null or char_length(lesson) < 1 or char_length(lesson) > 128 or idx is null or idx < 0 or idx >= 100000 then
      raise exception 'Invalid pinyin delete' using errcode = '22023';
    end if;
    delete from public.pinyin_corrections where lesson_id = lesson and char_index = idx;
  end loop;

  for entry in select * from jsonb_array_elements(p_upserts) loop
    if jsonb_typeof(entry) <> 'object' then raise exception 'Invalid pinyin upsert' using errcode = '22023'; end if;
    lesson := entry->>'lessonId';
    begin idx := (entry->>'index')::integer; exception when others then raise exception 'Invalid pinyin upsert' using errcode = '22023'; end;
    glyph := entry->>'character';
    original := coalesce(entry->>'originalPinyin', '');
    corrected := entry->>'correctedPinyin';
    citation := coalesce(entry->>'citation', '');
    source_text := coalesce(entry->>'sourceText', '');
    source := coalesce(nullif(entry->>'source', ''), 'manual-in-app');
    if lesson is null or char_length(lesson) < 1 or char_length(lesson) > 128
      or idx is null or idx < 0 or idx >= 100000
      or glyph is null or char_length(glyph) < 1 or char_length(glyph) > 8
      or corrected is null or char_length(corrected) < 1 or char_length(corrected) > 32
      or char_length(original) > 32 or char_length(citation) > 256
      or char_length(source_text) > 8000 or char_length(source) > 64 then
      raise exception 'Invalid pinyin upsert' using errcode = '22023';
    end if;
    insert into public.pinyin_corrections(
      lesson_id, char_index, character, original_pinyin, corrected_pinyin,
      citation, source_text, source, updated_at, updated_by
    ) values (
      lesson, idx, glyph, original, corrected, citation, source_text, source, now(), who
    )
    on conflict (lesson_id, char_index) do update set
      character = excluded.character,
      original_pinyin = excluded.original_pinyin,
      corrected_pinyin = excluded.corrected_pinyin,
      citation = excluded.citation,
      source_text = excluded.source_text,
      source = excluded.source,
      updated_at = now(),
      updated_by = excluded.updated_by;
  end loop;

  return public.pinyin_corrections_snapshot();
end $$;

revoke all on function public.pinyin_corrections_snapshot() from public, anon, authenticated;
revoke all on function public.pinyin_get_corrections() from public;
revoke all on function public.pinyin_apply_corrections(jsonb, jsonb) from public;
grant execute on function public.pinyin_get_corrections() to anon, authenticated;
grant execute on function public.pinyin_apply_corrections(jsonb, jsonb) to anon, authenticated;
