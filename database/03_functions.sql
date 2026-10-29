-- Clio TF-IDF matching function match_studies(). Run after 02. Safe to re-run.

create or replace function public.match_studies(
  p_title    text,
  p_abstract text,
  p_keywords text[],
  p_limit    integer default 5
)
returns table (
  study_id     uuid,
  title        text,
  score        numeric,
  similarity   text,
  source       text,
  kind         text,
  year         smallint,
  authors      text,
  abstract     text,
  shared_terms text[],
  url          text,
  study_type   text,
  cited_by     integer,
  access       text,
  setting      text,
  is_sample    boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_limit    integer := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_keywords text[]  := coalesce(p_keywords, '{}');
  v_text     text;
begin
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if array_length(regexp_split_to_array(btrim(coalesce(p_abstract, '')), '\s+'), 1) < 50 then
    raise exception 'abstract must be at least 50 words' using errcode = '22023';
  end if;
  if cardinality(v_keywords) = 0 then
    raise exception 'at least one keyword is required' using errcode = '22023';
  end if;

  v_text := p_title || ' ' || array_to_string(v_keywords, ' ') || ' ' || p_abstract;

  return query
  with corpus as (
    select count(*)::float8 as n from public.studies where search is not null
  ),
  idf as (
    select st.word as lexeme, ln((1 + c.n) / (1 + st.ndoc)) + 1 as idf
    from ts_stat('select search from public.studies where search is not null') st, corpus c
  ),
  q as (
    select t.lexeme,
           (1 + ln(coalesce(cardinality(t.positions), 1))) * coalesce(i.idf, ln(1 + c.n) + 1) as w
    from unnest(to_tsvector('english', v_text)) t
    cross join corpus c
    left join idf i on i.lexeme = t.lexeme
  ),
  q_len as (
    select sqrt(sum(q.w * q.w)) as len from q
  ),
  d as (
    select s.id, t.lexeme, (1 + ln(coalesce(cardinality(t.positions), 1))) * i.idf as w
    from public.studies s
    cross join lateral unnest(s.search) t
    join idf i on i.lexeme = t.lexeme
    where s.search is not null
  ),
  d_len as (
    select d.id, sqrt(sum(d.w * d.w)) as len from d group by d.id
  ),
  shared as (
    select d.id, d.lexeme, d.w * q.w as part from d join q on q.lexeme = d.lexeme
  ),
  scored as (
    select sh.id, round((100 * sum(sh.part) / (dl.len * ql.len))::numeric, 1) as sc
    from shared sh
    join d_len dl on dl.id = sh.id
    cross join q_len ql
    group by sh.id, dl.len, ql.len
  ),
  words as (
    select distinct on (x.lexeme) x.lexeme, x.word
    from (
      select w.word, (select t.lexeme from unnest(to_tsvector('english', w.word)) t limit 1) as lexeme
      from regexp_split_to_table(lower(v_text), '[^a-z0-9]+') as w(word)
      where length(w.word) > 2
    ) x
    where x.lexeme is not null
    order by x.lexeme, length(x.word), x.word
  )
  select
    s.id,
    s.title,
    sc.sc,
    case when sc.sc >= 50 then 'High similarity'
         when sc.sc >= 20 then 'Medium similarity'
         else 'Low similarity' end,
    s.source_name,
    s.source_type,
    s.year,
    array_to_string(s.authors, ', '),
    s.abstract,
    coalesce((
      select array_agg(top.word order by top.part desc)
      from (
        select wd.word, sh.part
        from shared sh join words wd on wd.lexeme = sh.lexeme
        where sh.id = s.id
        order by sh.part desc
        limit 8
      ) top
    ), '{}'),
    s.url,
    s.study_type,
    s.cited_by,
    s.access,
    s.setting,
    s.is_sample
  from scored sc
  join public.studies s on s.id = sc.id
  where sc.sc > 0
  order by sc.sc desc, s.year desc nulls last, s.id
  limit v_limit;
end;
$$;

revoke execute on function public.match_studies(text, text, text[], integer) from public;
grant  execute on function public.match_studies(text, text, text[], integer) to anon, authenticated;

alter table public.project_matches alter column score_method set default 'tfidf_cosine';
