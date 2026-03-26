create extension if not exists pgcrypto;

create type public.group_member_role as enum ('owner', 'admin', 'member');
create type public.study_session_status as enum ('active', 'paused', 'stopped');
create type public.session_integrity_status as enum ('clean', 'warning', 'flagged');
create type public.interruption_reason as enum ('tab_hidden', 'window_blur', 'manual');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  timezone text not null default 'UTC',
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique,
  description text check (description is null or char_length(description) <= 240),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  unique (group_id, user_id)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.class_groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 500),
  status public.study_session_status not null default 'active',
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  accumulated_focus_seconds integer not null default 0 check (accumulated_focus_seconds >= 0),
  effective_duration_seconds integer check (effective_duration_seconds is null or effective_duration_seconds >= 0),
  last_resumed_at timestamptz,
  last_paused_at timestamptz,
  interruption_count integer not null default 0 check (interruption_count >= 0),
  last_interruption_at timestamptz,
  last_interruption_reason public.interruption_reason,
  integrity_status public.session_integrity_status not null default 'clean',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'stopped' and ended_at is not null)
    or status in ('active', 'paused')
  )
);

create table public.exam_countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  subject text check (subject is null or char_length(subject) <= 120),
  exam_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_groups (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index class_groups_owner_user_id_idx on public.class_groups (owner_user_id);
create index group_members_user_id_group_id_idx on public.group_members (user_id, group_id);
create index study_sessions_group_id_status_idx on public.study_sessions (group_id, status);
create index study_sessions_user_id_started_at_idx on public.study_sessions (user_id, started_at desc);
create unique index study_sessions_one_open_session_per_user_idx
  on public.study_sessions (user_id)
  where status in ('active', 'paused');
create index exam_countdowns_user_id_exam_at_idx on public.exam_countdowns (user_id, exam_at);
create index exam_countdowns_group_id_exam_at_idx on public.exam_countdowns (group_id, exam_at);
create index discussion_posts_group_id_created_at_idx on public.discussion_posts (group_id, created_at desc);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.sanitize_slug(p_input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(coalesce(p_input, 'group'))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 8));
$$;

create or replace function public.session_integrity_from_interruption_count(p_count integer)
returns public.session_integrity_status
language sql
immutable
as $$
  select case
    when coalesce(p_count, 0) >= 4 then 'flagged'::public.session_integrity_status
    when coalesce(p_count, 0) >= 1 then 'warning'::public.session_integrity_status
    else 'clean'::public.session_integrity_status
  end;
$$;

create or replace function public.compute_live_effective_seconds(p_session public.study_sessions)
returns integer
language sql
stable
as $$
  select case
    when p_session.status = 'active' and p_session.last_resumed_at is not null then
      p_session.accumulated_focus_seconds
      + greatest(0, floor(extract(epoch from (timezone('utc', now()) - p_session.last_resumed_at)))::integer)
    when p_session.status = 'paused' then
      p_session.accumulated_focus_seconds
    else
      coalesce(p_session.effective_duration_seconds, p_session.accumulated_focus_seconds)
  end;
$$;

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = coalesce(p_user_id, auth.uid())
      and gm.role in ('owner', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'student'
  );

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    v_display_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, public.profiles.email),
      display_name = coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), public.profiles.display_name),
      avatar_url = coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), public.profiles.avatar_url)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_updated();

create or replace function public.touch_profile_presence()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set last_seen_at = timezone('utc', now())
  where id = auth.uid()
  returning * into v_profile;

  if v_profile.id is null then
    insert into public.profiles (id, email, display_name, last_seen_at)
    select
      au.id,
      coalesce(au.email, ''),
      coalesce(split_part(coalesce(au.email, ''), '@', 1), 'student'),
      timezone('utc', now())
    from auth.users au
    where au.id = auth.uid()
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

create or replace function public.create_class_group(p_name text, p_description text default null)
returns public.class_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.class_groups;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.touch_profile_presence();

  v_slug := public.sanitize_slug(p_name) || '-' || lower(public.generate_invite_code());

  insert into public.class_groups (name, slug, description, owner_user_id, invite_code)
  values (
    trim(p_name),
    v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid(),
    public.generate_invite_code()
  )
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$;

create or replace function public.join_group_by_invite(p_invite_code text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.class_groups;
  v_member public.group_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.touch_profile_presence();

  select *
  into v_group
  from public.class_groups
  where invite_code = upper(trim(p_invite_code))
  limit 1;

  if v_group.id is null then
    raise exception 'Group invite code not found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do update
    set role = public.group_members.role
  returning * into v_member;

  return v_member;
end;
$$;

create or replace function public.create_study_session(
  p_group_id uuid,
  p_title text,
  p_notes text default null
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

  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'You must belong to the group to start a study session';
  end if;

  if exists (
    select 1
    from public.study_sessions s
    where s.user_id = auth.uid()
      and s.status in ('active', 'paused')
  ) then
    raise exception 'You already have an open study session';
  end if;

  perform public.touch_profile_presence();

  insert into public.study_sessions (
    user_id,
    group_id,
    title,
    notes,
    status,
    started_at,
    last_resumed_at,
    integrity_status
  )
  values (
    auth.uid(),
    p_group_id,
    trim(p_title),
    nullif(trim(coalesce(p_notes, '')), ''),
    'active',
    timezone('utc', now()),
    timezone('utc', now()),
    'clean'
  )
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.pause_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_session public.study_sessions;
  v_effective integer;
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

  if v_session.status <> 'active' then
    raise exception 'Only active sessions can be paused';
  end if;

  v_effective := public.compute_live_effective_seconds(v_session);

  update public.study_sessions
  set status = 'paused',
      accumulated_focus_seconds = v_effective,
      last_paused_at = v_now,
      last_resumed_at = null
  where id = p_session_id
  returning * into v_session;

  perform public.touch_profile_presence();

  return v_session;
end;
$$;

create or replace function public.resume_study_session(p_session_id uuid)
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

  if v_session.status <> 'paused' then
    raise exception 'Only paused sessions can be resumed';
  end if;

  update public.study_sessions
  set status = 'active',
      last_paused_at = null,
      last_resumed_at = timezone('utc', now())
  where id = p_session_id
  returning * into v_session;

  perform public.touch_profile_presence();

  return v_session;
end;
$$;

create or replace function public.stop_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_session public.study_sessions;
  v_effective integer;
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
    return v_session;
  end if;

  v_effective := public.compute_live_effective_seconds(v_session);

  update public.study_sessions
  set status = 'stopped',
      ended_at = v_now,
      accumulated_focus_seconds = v_effective,
      effective_duration_seconds = v_effective,
      last_paused_at = case when v_session.status = 'paused' then v_session.last_paused_at else null end,
      last_resumed_at = null
  where id = p_session_id
  returning * into v_session;

  perform public.touch_profile_presence();

  return v_session;
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

create or replace function public.get_group_currently_studying_count(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  select count(*)::integer
  into v_count
  from public.study_sessions s
  where s.group_id = p_group_id
    and s.status = 'active';

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.get_group_presence_snapshot(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz,
  active_session_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return query
  with active_sessions as (
    select distinct on (s.user_id)
      s.user_id,
      s.id as active_session_id
    from public.study_sessions s
    where s.group_id = p_group_id
      and s.status = 'active'
    order by s.user_id, s.started_at desc
  )
  select
    gm.user_id,
    p.display_name,
    p.avatar_url,
    p.last_seen_at,
    a.active_session_id,
    case
      when a.active_session_id is not null then 'studying'
      when p.last_seen_at is not null and p.last_seen_at >= timezone('utc', now()) - interval '2 minutes' then 'idle'
      else 'offline'
    end as status
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join active_sessions a on a.user_id = gm.user_id
  where gm.group_id = p_group_id
  order by
    case
      when a.active_session_id is not null then 0
      when p.last_seen_at is not null and p.last_seen_at >= timezone('utc', now()) - interval '2 minutes' then 1
      else 2
    end,
    p.display_name asc;
end;
$$;

create or replace function public.get_group_leaderboard(
  p_group_id uuid,
  p_range text default 'daily',
  p_timezone text default 'UTC'
)
returns table (
  group_id uuid,
  range_type text,
  window_start timestamptz,
  window_end timestamptz,
  user_id uuid,
  display_name text,
  avatar_url text,
  total_seconds integer,
  sessions_completed integer,
  interruption_count integer,
  integrity_status public.session_integrity_status,
  rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_range text := lower(coalesce(nullif(trim(p_range), ''), 'daily'));
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'Forbidden';
  end if;

  return query
  with bounds as (
    select
      case
        when v_range = 'weekly' then timezone(v_timezone, date_trunc('week', now() at time zone v_timezone))
        else timezone(v_timezone, date_trunc('day', now() at time zone v_timezone))
      end as window_start,
      case
        when v_range = 'weekly' then timezone(v_timezone, date_trunc('week', now() at time zone v_timezone) + interval '7 days')
        else timezone(v_timezone, date_trunc('day', now() at time zone v_timezone) + interval '1 day')
      end as window_end
  ),
  members as (
    select
      gm.user_id,
      p.display_name,
      p.avatar_url
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id
  ),
  aggregates as (
    select
      m.user_id,
      m.display_name,
      m.avatar_url,
      coalesce(sum(public.compute_live_effective_seconds(s)), 0)::integer as total_seconds,
      count(s.id) filter (where s.status = 'stopped')::integer as sessions_completed,
      coalesce(sum(s.interruption_count), 0)::integer as interruption_count
    from members m
    cross join bounds b
    left join public.study_sessions s
      on s.user_id = m.user_id
     and s.group_id = p_group_id
     and s.started_at >= b.window_start
     and s.started_at < b.window_end
    group by m.user_id, m.display_name, m.avatar_url
  )
  select
    p_group_id as group_id,
    case when v_range = 'weekly' then 'weekly' else 'daily' end as range_type,
    b.window_start,
    b.window_end,
    a.user_id,
    a.display_name,
    a.avatar_url,
    a.total_seconds,
    a.sessions_completed,
    a.interruption_count,
    public.session_integrity_from_interruption_count(a.interruption_count) as integrity_status,
    dense_rank() over (
      order by
        a.total_seconds desc,
        a.sessions_completed desc,
        a.interruption_count asc,
        a.display_name asc
    )::integer as rank
  from aggregates a
  cross join bounds b
  order by rank, a.display_name asc;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create trigger class_groups_set_updated_at
before update on public.class_groups
for each row execute function public.handle_updated_at();

create trigger study_sessions_set_updated_at
before update on public.study_sessions
for each row execute function public.handle_updated_at();

create trigger exam_countdowns_set_updated_at
before update on public.exam_countdowns
for each row execute function public.handle_updated_at();

create trigger discussion_posts_set_updated_at
before update on public.discussion_posts
for each row execute function public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.class_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.study_sessions enable row level security;
alter table public.exam_countdowns enable row level security;
alter table public.discussion_posts enable row level security;

alter table public.profiles force row level security;
alter table public.class_groups force row level security;
alter table public.group_members force row level security;
alter table public.study_sessions force row level security;
alter table public.exam_countdowns force row level security;
alter table public.discussion_posts force row level security;

create policy "profiles_select_self_or_groupmates"
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members viewer
    join public.group_members teammate on teammate.group_id = viewer.group_id
    where viewer.user_id = auth.uid()
      and teammate.user_id = public.profiles.id
  )
);

create policy "profiles_insert_self"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "class_groups_select_members"
on public.class_groups
for select
using (public.is_group_member(id, auth.uid()));

create policy "class_groups_insert_owner"
on public.class_groups
for insert
with check (owner_user_id = auth.uid());

create policy "class_groups_update_admins"
on public.class_groups
for update
using (public.is_group_admin(id, auth.uid()))
with check (public.is_group_admin(id, auth.uid()));

create policy "class_groups_delete_owner"
on public.class_groups
for delete
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = public.class_groups.id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  )
);

create policy "group_members_select_members"
on public.group_members
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "group_members_insert_admins"
on public.group_members
for insert
with check (public.is_group_admin(group_id, auth.uid()));

create policy "group_members_update_admins"
on public.group_members
for update
using (public.is_group_admin(group_id, auth.uid()))
with check (public.is_group_admin(group_id, auth.uid()));

create policy "group_members_delete_self_or_admin"
on public.group_members
for delete
using (
  user_id = auth.uid()
  or public.is_group_admin(group_id, auth.uid())
);

create policy "study_sessions_select_group_members"
on public.study_sessions
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "study_sessions_insert_own"
on public.study_sessions
for insert
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "study_sessions_update_own"
on public.study_sessions
for update
using (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "exam_countdowns_select_owner_or_group"
on public.exam_countdowns
for select
using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_group_member(group_id, auth.uid())
  )
);

create policy "exam_countdowns_insert_own"
on public.exam_countdowns
for insert
with check (
  user_id = auth.uid()
  and (
    group_id is null
    or public.is_group_member(group_id, auth.uid())
  )
);

create policy "exam_countdowns_update_own"
on public.exam_countdowns
for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    group_id is null
    or public.is_group_member(group_id, auth.uid())
  )
);

create policy "exam_countdowns_delete_own"
on public.exam_countdowns
for delete
using (user_id = auth.uid());

create policy "discussion_posts_select_group_members"
on public.discussion_posts
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "discussion_posts_insert_own"
on public.discussion_posts
for insert
with check (
  author_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "discussion_posts_update_own"
on public.discussion_posts
for update
using (
  author_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
)
with check (
  author_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

create policy "discussion_posts_delete_own"
on public.discussion_posts
for delete
using (
  author_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
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
