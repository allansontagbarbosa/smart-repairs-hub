export const buildUserProfileLookup = (userId: string) => `user_id.eq.${userId},id.eq.${userId}`;

export const getSingleRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};