// Single source of truth for the Claude model ID used across the app.
//
// Use a ROLLING ALIAS (e.g. "claude-sonnet-4-6"), not a dated snapshot
// (e.g. "claude-sonnet-4-20250514"). Dated snapshots hard-retire on a
// schedule and return a 404 once retired, which takes the chatbot offline.
// Aliases are repointed by Anthropic and don't 404 the same way.
//
// The /api/health route checks this exact model against the Models API,
// so a future retirement shows up there before it breaks a user's chat.
export const MODEL = "claude-sonnet-4-6";
