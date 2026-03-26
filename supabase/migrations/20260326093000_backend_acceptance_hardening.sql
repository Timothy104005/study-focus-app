create index if not exists discussion_posts_author_group_created_at_idx
  on public.discussion_posts (author_user_id, group_id, created_at desc);

create or replace function public.touch_profile_presence()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_email text;
  v_display_name text;
  v_avatar_url text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(au.email, ''),
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(au.email, ''), '@', 1),
      'student'
    ),
    nullif(au.raw_user_meta_data ->> 'avatar_url', '')
  into v_email, v_display_name, v_avatar_url
  from auth.users au
  where au.id = auth.uid();

  update public.profiles
  set email = coalesce(nullif(v_email, ''), public.profiles.email),
      avatar_url = coalesce(v_avatar_url, public.profiles.avatar_url),
      last_seen_at = timezone('utc', now())
  where id = auth.uid()
  returning * into v_profile;

  if v_profile.id is null then
    insert into public.profiles (id, email, display_name, avatar_url, last_seen_at)
    values (
      auth.uid(),
      coalesce(v_email, ''),
      coalesce(v_display_name, 'student'),
      v_avatar_url,
      timezone('utc', now())
    )
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

create or replace function public.report_study_session_interruption(
  p_session_id uuid,
  p_reason public.interruption_reason
)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_session
  from public.study_sessions
  where id = p_session_id
    and user_id = auth.uid()
  for update;

  if v_session.id is null then
    raise exception 'Study session not found';
  end if;

  if v_session.status = 'stopped' then
    raise exception 'Completed sessions cannot record new interruptions';
  end if;

  if v_session.status <> 'active' then
    raise exception 'Only active sessions can record interruptions';
  end if;

  if
    v_session.last_interruption_at is not null
    and v_session.last_interruption_reason = p_reason
    and v_session.last_interruption_at >= timezone('utc', now()) - interval '3 seconds'
  then
    return v_session;
  end if;

  update public.study_sessions
  set interruption_count = interruption_count + 1,
      last_interruption_at = timezone('utc', now()),
      last_interruption_reason = p_reason,
      integrity_status = public.session_integrity_from_interruption_count(interruption_count + 1)
  where id = p_session_id
  returning * into v_session;

  perform public.touch_profile_presence();

  return v_session;
end;
$$;

create or replace function public.flag_study_session_for_review(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.study_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_session
  from public.study_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Study session not found';
  end if;

  if not public.is_group_admin(v_session.group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  update public.study_sessions
  set integrity_status = 'flagged'
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.build_hidden_discussion_post_content(p_reason text default null)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_reason, '')), '') is not null then
      '[Hidden by moderator] A moderator removed this message from the discussion feed. Internal note: '
      || trim(p_reason)
    else
      '[Hidden by moderator] A moderator removed this message from the discussion feed.'
  end;
$$;

create or replace function public.hide_discussion_post(
  p_post_id uuid,
  p_reason text default null
)
returns public.discussion_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.discussion_posts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_post
  from public.discussion_posts
  where id = p_post_id
  for update;

  if v_post.id is null then
    raise exception 'Discussion post not found';
  end if;

  if not public.is_group_admin(v_post.group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  update public.discussion_posts
  set content = public.build_hidden_discussion_post_content(p_reason)
  where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;

create or replace function public.delete_discussion_post(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.discussion_posts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_post
  from public.discussion_posts
  where id = p_post_id
  for update;

  if v_post.id is null then
    raise exception 'Discussion post not found';
  end if;

  if v_post.author_user_id <> auth.uid() and not public.is_group_admin(v_post.group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  delete from public.discussion_posts
  where id = p_post_id;

  return p_post_id;
end;
$$;

revoke all on function public.flag_study_session_for_review(uuid) from anon, public;
revoke all on function public.hide_discussion_post(uuid, text) from anon, public;
revoke all on function public.delete_discussion_post(uuid) from anon, public;

grant execute on function public.flag_study_session_for_review(uuid) to authenticated, service_role;
grant execute on function public.hide_discussion_post(uuid, text) to authenticated, service_role;
grant execute on function public.delete_discussion_post(uuid) to authenticated, service_role;
