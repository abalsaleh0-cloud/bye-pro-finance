export function requireAuthenticatedUser(userId: string | undefined): string {
  if (!userId) throw new Error("Authentication required");
  return userId;
}
