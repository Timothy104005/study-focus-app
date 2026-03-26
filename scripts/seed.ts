import { createClient } from "@supabase/supabase-js";
import { env, requireSupabaseEnv } from "../src/lib/env";
import type { Database } from "../src/lib/supabase/database.types";

const supabaseEnv = requireSupabaseEnv();

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to run the seed script.");
}

const supabase = createClient<Database>(
  supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_SLUG = "study-focus-demo-group";
const GROUP_INVITE_CODE = "BIO101A1";

const SEED_USERS = [
  { email: "owner@example.com", displayName: "Avery Chen" },
  { email: "member1@example.com", displayName: "Ben Wu" },
  { email: "member2@example.com", displayName: "Nina Huang" },
] as const;

async function ensureUser(email: string, displayName: string) {
  const { data: listedUsers, error: listError } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (listError) {
    throw listError;
  }

  const existing = listedUsers.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Unable to create seed user for ${email}.`);
  }

  return data.user;
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number, extraHours = 0) {
  return isoHoursAgo(days * 24 + extraHours);
}

async function main() {
  const users = await Promise.all(
    SEED_USERS.map((user) => ensureUser(user.email, user.displayName)),
  );
  const [owner, member1, member2] = users;

  await supabase.from("profiles").upsert(
    [
      {
        id: owner.id,
        email: owner.email ?? SEED_USERS[0].email,
        display_name: SEED_USERS[0].displayName,
        timezone: "Asia/Taipei",
        last_seen_at: isoHoursAgo(0.1),
      },
      {
        id: member1.id,
        email: member1.email ?? SEED_USERS[1].email,
        display_name: SEED_USERS[1].displayName,
        timezone: "Asia/Taipei",
        last_seen_at: isoHoursAgo(0.3),
      },
      {
        id: member2.id,
        email: member2.email ?? SEED_USERS[2].email,
        display_name: SEED_USERS[2].displayName,
        timezone: "Asia/Taipei",
        last_seen_at: isoHoursAgo(6),
      },
    ],
    { onConflict: "id" },
  );

  await supabase.from("class_groups").upsert(
    {
      id: GROUP_ID,
      name: "Biology Sprint",
      slug: GROUP_SLUG,
      description: "Demo study group with real sessions, exams, discussion, and presence data.",
      owner_user_id: owner.id,
      invite_code: GROUP_INVITE_CODE,
    },
    { onConflict: "id" },
  );

  await supabase.from("group_members").upsert(
    [
      {
        id: "22222222-2222-4222-8222-222222222221",
        group_id: GROUP_ID,
        user_id: owner.id,
        role: "owner",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        group_id: GROUP_ID,
        user_id: member1.id,
        role: "member",
      },
      {
        id: "22222222-2222-4222-8222-222222222223",
        group_id: GROUP_ID,
        user_id: member2.id,
        role: "member",
      },
    ],
    { onConflict: "group_id,user_id" },
  );

  await supabase.from("exam_countdowns").upsert(
    [
      {
        id: "33333333-3333-4333-8333-333333333331",
        user_id: owner.id,
        group_id: GROUP_ID,
        title: "Biology Midterm",
        subject: "Biology",
        exam_at: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Focus on cellular respiration and genetics.",
      },
      {
        id: "33333333-3333-4333-8333-333333333332",
        user_id: member1.id,
        group_id: null,
        title: "English Quiz",
        subject: "Reading",
        exam_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Personal exam countdown demo entry.",
      },
    ],
    { onConflict: "id" },
  );

  await supabase.from("discussion_posts").upsert(
    [
      {
        id: "44444444-4444-4444-8444-444444444441",
        group_id: GROUP_ID,
        author_user_id: owner.id,
        content: "Let's review cellular respiration and genetics tonight at 8 PM.",
      },
      {
        id: "44444444-4444-4444-8444-444444444442",
        group_id: GROUP_ID,
        author_user_id: member1.id,
        content: "I will post a quick summary sheet later so everyone can revise from the same notes.",
      },
    ],
    { onConflict: "id" },
  );

  await supabase.from("study_sessions").upsert(
    [
      {
        id: "55555555-5555-4555-8555-555555555551",
        user_id: owner.id,
        group_id: GROUP_ID,
        title: "science",
        notes: "Live science review session.",
        status: "active",
        started_at: isoHoursAgo(1),
        last_resumed_at: isoHoursAgo(0.25),
        accumulated_focus_seconds: 1800,
        interruption_count: 1,
        integrity_status: "warning",
      },
      {
        id: "55555555-5555-4555-8555-555555555552",
        user_id: member1.id,
        group_id: GROUP_ID,
        title: "english",
        notes: "Paused English reading practice.",
        status: "paused",
        started_at: isoHoursAgo(3),
        last_paused_at: isoHoursAgo(2),
        accumulated_focus_seconds: 2700,
        interruption_count: 0,
        integrity_status: "clean",
      },
      {
        id: "55555555-5555-4555-8555-555555555553",
        user_id: member2.id,
        group_id: GROUP_ID,
        title: "mathematics",
        notes: "Completed math practice for leaderboard coverage.",
        status: "stopped",
        started_at: isoHoursAgo(6),
        ended_at: isoHoursAgo(4),
        accumulated_focus_seconds: 5400,
        effective_duration_seconds: 5400,
        interruption_count: 2,
        integrity_status: "warning",
      },
      {
        id: "55555555-5555-4555-8555-555555555554",
        user_id: owner.id,
        group_id: GROUP_ID,
        title: "chinese",
        notes: "Last night's reading review block.",
        status: "stopped",
        started_at: isoDaysAgo(1, 4),
        ended_at: isoDaysAgo(1, 2.75),
        accumulated_focus_seconds: 4500,
        effective_duration_seconds: 4500,
        interruption_count: 0,
        integrity_status: "clean",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        user_id: member1.id,
        group_id: GROUP_ID,
        title: "science",
        notes: "Science sprint from two days ago.",
        status: "stopped",
        started_at: isoDaysAgo(2, 3.5),
        ended_at: isoDaysAgo(2, 2.5),
        accumulated_focus_seconds: 3600,
        effective_duration_seconds: 3600,
        interruption_count: 1,
        integrity_status: "warning",
      },
      {
        id: "55555555-5555-4555-8555-555555555556",
        user_id: member2.id,
        group_id: GROUP_ID,
        title: "english",
        notes: "English practice from three days ago.",
        status: "stopped",
        started_at: isoDaysAgo(3, 5),
        ended_at: isoDaysAgo(3, 3.5),
        accumulated_focus_seconds: 5400,
        effective_duration_seconds: 5400,
        interruption_count: 0,
        integrity_status: "clean",
      },
      {
        id: "55555555-5555-4555-8555-555555555557",
        user_id: owner.id,
        group_id: GROUP_ID,
        title: "social_studies",
        notes: "Social studies review to keep the streak alive.",
        status: "stopped",
        started_at: isoDaysAgo(5, 2),
        ended_at: isoDaysAgo(5, 1.25),
        accumulated_focus_seconds: 2700,
        effective_duration_seconds: 2700,
        interruption_count: 0,
        integrity_status: "clean",
      },
      {
        id: "55555555-5555-4555-8555-555555555558",
        user_id: member1.id,
        group_id: GROUP_ID,
        title: "science",
        notes: "Extra science review to make the weekly leaderboard more realistic.",
        status: "stopped",
        started_at: isoDaysAgo(6, 4),
        ended_at: isoDaysAgo(6, 2.25),
        accumulated_focus_seconds: 6300,
        effective_duration_seconds: 6300,
        interruption_count: 2,
        integrity_status: "warning",
      },
    ],
    { onConflict: "id" },
  );

  console.log("Seed complete.");
  console.log(`Demo invite code: ${GROUP_INVITE_CODE}`);
  console.log(`Demo users: ${SEED_USERS.map((user) => user.email).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
