/**
 * Clerk middleware — gates `/dashboard` and `/onboarding`.
 *
 * The matcher is narrow on purpose: marketing (`/`, `/pricing`),
 * sign-in/up, and the APK download endpoint are public and skip Clerk
 * entirely. Running Clerk middleware on those paths triggers browser-
 * only host validation against Clerk's API, which fails in e2e or
 * dev placeholder-key environments and breaks the page before any
 * SSR'd HTML reaches the client.
 *
 * Per CLAUDE.md / HANDOFF §3 (TODO open-question): the Free tier is
 * meant to require no account. The mobile app must NOT inherit a
 * Clerk-first gate either.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*'],
};
