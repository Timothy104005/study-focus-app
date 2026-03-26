create index if not exists study_sessions_group_id_started_at_idx
  on public.study_sessions (group_id, started_at desc);

revoke usage on schema public from anon, public;
grant usage on schema public to authenticated, service_role;

revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

revoke all on function public.touch_profile_presence() from anon, public;
revoke all on function public.create_class_group(text, text) from anon, public;
revoke all on function public.join_group_by_invite(text) from anon, public;
revoke all on function public.create_study_session(uuid, text, text) from anon, public;
revoke all on function public.pause_study_session(uuid) from anon, public;
revoke all on function public.resume_study_session(uuid) from anon, public;
revoke all on function public.stop_study_session(uuid) from anon, public;
revoke all on function public.report_study_session_interruption(uuid, public.interruption_reason) from anon, public;
revoke all on function public.get_group_currently_studying_count(uuid) from anon, public;
revoke all on function public.get_group_presence_snapshot(uuid) from anon, public;
revoke all on function public.get_group_leaderboard(uuid, text, text) from anon, public;

grant execute on function public.touch_profile_presence() to authenticated, service_role;
grant execute on function public.create_class_group(text, text) to authenticated, service_role;
grant execute on function public.join_group_by_invite(text) to authenticated, service_role;
grant execute on function public.create_study_session(uuid, text, text) to authenticated, service_role;
grant execute on function public.pause_study_session(uuid) to authenticated, service_role;
grant execute on function public.resume_study_session(uuid) to authenticated, service_role;
grant execute on function public.stop_study_session(uuid) to authenticated, service_role;
grant execute on function public.report_study_session_interruption(uuid, public.interruption_reason) to authenticated, service_role;
grant execute on function public.get_group_currently_studying_count(uuid) to authenticated, service_role;
grant execute on function public.get_group_presence_snapshot(uuid) to authenticated, service_role;
grant execute on function public.get_group_leaderboard(uuid, text, text) to authenticated, service_role;
