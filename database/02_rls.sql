-- Clio row level security and grants. Run after 01. Safe to re-run.

alter table public.profiles        enable row level security;
alter table public.studies         enable row level security;
alter table public.projects        enable row level security;
alter table public.project_matches enable row level security;

revoke all on public.profiles, public.studies, public.projects,
              public.project_matches, public.project_matches_view
  from anon, authenticated;

grant select on public.studies to anon, authenticated;
grant select, update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_matches to authenticated;
grant select on public.project_matches_view to authenticated;

drop policy if exists studies_read_all on public.studies;
create policy studies_read_all on public.studies
  for select to anon, authenticated
  using (true);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists project_matches_owner_all on public.project_matches;
create policy project_matches_owner_all on public.project_matches
  for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_matches.project_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_matches.project_id and p.user_id = (select auth.uid())
  ));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
