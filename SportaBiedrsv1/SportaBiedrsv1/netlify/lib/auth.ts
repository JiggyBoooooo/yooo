import { createClerkClient } from '@clerk/backend';

export type AuthUser = { userId: string; sessionId?: string | null; email: string | null; firstName: string; lastName: string };

export async function requireClerkUser(request: Request): Promise<AuthUser> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) throw new Error('CLERK_NOT_CONFIGURED');

  const client = createClerkClient({ secretKey, publishableKey });
  const parties = (process.env.CLERK_AUTHORIZED_PARTIES || new URL(request.url).origin).split(',').map(v => v.trim()).filter(Boolean);
  const state = await client.authenticateRequest(request, {
    publishableKey,
    authorizedParties: parties,
  });
  if (!state.isAuthenticated) throw new Error('UNAUTHORIZED');
  const auth = state.toAuth();
  if (!auth.userId) throw new Error('UNAUTHORIZED');
  const user = await client.users.getUser(auth.userId);
  const primaryEmail = user.emailAddresses?.find((item: any) => item.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
  return {
    userId: auth.userId,
    sessionId: auth.sessionId,
    email: primaryEmail ? String(primaryEmail).trim().toLowerCase() : null,
    firstName: String(user.firstName || '').trim(),
    lastName: String(user.lastName || '').trim(),
  };
}
