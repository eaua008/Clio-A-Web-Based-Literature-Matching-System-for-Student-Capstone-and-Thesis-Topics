-- Clio schema: tables, indexes, triggers. Run first. Safe to re-run.

create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now()
);

create table if not exists public.studies (
  id            uuid primary key default gen_random_uuid(),
  source_type   text not null
                check (source_type in ('paper', 'patent', 'github', 'local_thesis')),
  source_name   text not null,
  external_id   text,
  title         text not null check (char_length(btrim(title)) > 0),
  abstract      text,
  authors       text[] not null default '{}',
  year          smallint check (year between 1800 and 2100),
  venue         text,
  url           text check (url is null or url ~* '^https?://'),
  doi           text,
  keywords      text[] not null default '{}',
  study_type    text,
  cited_by      integer check (cited_by is null or cited_by >= 0),
  access        text,
  setting       text,
  license       text,
  data_source   text,
  fetched_at    timestamptz,
  is_sample     boolean not null default false,
  search        tsvector,
  created_at    timestamptz not null default now()
);

create unique index if not exists studies_source_external_uidx
  on public.studies (source_type, external_id) where external_id is not null;
create unique index if not exists studies_doi_uidx
  on public.studies (lower(doi)) where doi is not null;
create index if not exists studies_search_gin   on public.studies using gin (search);
create index if not exists studies_title_trgm   on public.studies using gin (title gin_trgm_ops);
create index if not exists studies_type_year_idx on public.studies (source_type, year desc);

create or replace function public.studies_set_search()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search :=
      setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
   || setweight(to_tsvector('english', coalesce(array_to_string(new.keywords, ' '), '')), 'B')
   || setweight(to_tsvector('english', coalesce(new.abstract, '')), 'C');
  return new;
end;
$$;

drop trigger if exists studies_set_search on public.studies;
create trigger studies_set_search
  before insert or update of title, abstract, keywords on public.studies
  for each row execute function public.studies_set_search();

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  abstract    text not null
              check (char_length(abstract) <= 10000
                 and array_length(regexp_split_to_array(btrim(abstract), '\s+'), 1) >= 50),
  keywords    text[] not null
              check (cardinality(keywords) between 1 and 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create table if not exists public.project_matches (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  study_id       uuid not null references public.studies (id) on delete cascade,
  score          numeric(5, 1) not null check (score between 0 and 100),
  score_method   text not null default 'tfidf_cosine',
  shared_terms   text[] not null default '{}',
  relation       text check (relation in ('Duplicate', 'Similar', 'Related background', 'Not relevant')),
  difference     text check (difference is null or char_length(difference) <= 5000),
  matched_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, study_id)
);

create index if not exists project_matches_project_score_idx
  on public.project_matches (project_id, score desc);
create index if not exists project_matches_study_idx
  on public.project_matches (study_id);

drop trigger if exists project_matches_touch_updated_at on public.project_matches;
create trigger project_matches_touch_updated_at
  before update on public.project_matches
  for each row execute function public.touch_updated_at();

create or replace view public.project_matches_view
with (security_invoker = true) as
select
  m.*,
  case when m.score >= 50 then 'High similarity'
       when m.score >= 20 then 'Medium similarity'
       else 'Low similarity' end as similarity
from public.project_matches m;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
