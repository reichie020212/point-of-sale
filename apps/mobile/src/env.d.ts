/**
 * Ambient type declarations for the mobile workspace.
 *
 * `expo` Babel transforms `process.env.EXPO_PUBLIC_*` into inlined
 * string literals at build time, but TypeScript doesn't know the
 * variable exists because we don't pull in `@types/node` (it would
 * pollute the RN-only globals). Declare just the env shape we use.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_SENTRY_DSN?: string;
    EXPO_PUBLIC_SENTRY_ENVIRONMENT?: string;
    EXPO_PUBLIC_POSTHOG_KEY?: string;
    EXPO_PUBLIC_POSTHOG_HOST?: string;
  };
};
