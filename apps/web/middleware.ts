/**
 * Clerk middleware — runs before every request. Public routes (marketing
 * landing, pricing, sign-in/up, the APK download endpoint) are listed
 * explicitly; everything else (the dashboard) requires an authenticated
 * Clerk session.
 *
 * Per CLAUDE.md / HANDOFF §3 (TODO open-question): the Free tier is meant
 * to require no account. This middleware currently gates `/dashboard`,
 * which is correct, but mobile W2+ must NOT inherit a Clerk-first gate.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
