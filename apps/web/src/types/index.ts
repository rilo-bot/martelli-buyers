// Domain types now live in the shared workspace package so the API and the
// web client agree on a single source of truth. Re-exported here so existing
// `@/types` imports across the app keep working unchanged.
export * from '@rilo/shared';
