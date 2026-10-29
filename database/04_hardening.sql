-- Clio column privileges, forced RLS and row limits. Run after 03. Safe to re-run.

alter table public.profiles        force row level security;
alter table public.studies         force row level security;
alter table public.projects        force row level security;
alter table public.project_matches force row level security;

revoke update on public.projects        from authenticated;
revoke update on public.project_matches from authenticated;
grant  update (title, abstract, keywords)             on public.projects        to authenticated;
grant  update (relation, difference, shared_terms, score, score_method)
                                                       on public.project_matches to authenticated;

revoke insert on public.projects        from authenticated;
revoke insert on public.project_matches from authenticated;
grant  insert (title, abstract, keywords)                                   on public.projects        to authenticated;
grant  insert (project_id, study_id, score, score_method, shared_terms, relation, difference)
                                                                             on public.project_matches to authenticated;

revoke insert, delete on public.profiles from anon, authenticated;

revoke create on schema public from public, anon, authenticated;

create or replace function public.enforce_row_limits()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name = 'projects' then
    if (select count(*) from public.projects where user_id = new.user_id) >= 200 then
      raise exception 'project limit reached' using errcode = '54000';
    end if;
  elsif tg_table_name = 'project_matches' then
    if (select count(*) from public.project_matches where project_id = new.project_id) >= 100 then
      raise exception 'match limit reached for this project' using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_row_limit on public.projects;
create trigger projects_row_limit
  before insert on public.projects
  for each row execute function public.enforce_row_limits();

drop trigger if exists project_matches_row_limit on public.project_matches;
create trigger project_matches_row_limit
  before insert on public.project_matches
  for each row execute function public.enforce_row_limits();
