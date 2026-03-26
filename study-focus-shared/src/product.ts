export const PRODUCT_CONSTANTS = {
  appName: "Study Focus TW",
  defaultLocale: "zh-TW",
  defaultTimezone: "Asia/Taipei",
  discussionPostMaxCharacters: 280,
  defaultLeaderboardLimit: 20,
  maxClassGroupMembers: 200,
  inviteCodeLength: 6,
  presenceHeartbeatIntervalSeconds: 30,
  minimumTrackedSessionMinutes: 1,
  supportedStudySubjects: [
    "mathematics",
    "english",
    "science",
    "social_studies",
    "chinese",
    "coding",
    "other",
  ],
} as const;

export type SupportedStudySubject =
  (typeof PRODUCT_CONSTANTS.supportedStudySubjects)[number];
