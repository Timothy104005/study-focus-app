export const GROUP_PRESENCE_CHANNEL_PREFIX = "group-presence";

export function buildGroupPresenceChannel(groupId: string) {
  return `${GROUP_PRESENCE_CHANNEL_PREFIX}:${groupId}`;
}

