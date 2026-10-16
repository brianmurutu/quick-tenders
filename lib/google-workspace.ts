/** Creates a unique internal company key for a Google consumer account. */
export function googleConsumerWorkspaceDomain(userId: string): string {
  return `google-${userId.replace(/-/g, '')}.oauth.invalid`
}
