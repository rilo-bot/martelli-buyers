import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** CSRF state for the in-flight Xero OAuth handshake. */
    xeroState?: string;
    /** CSRF state for the in-flight Outlook (Microsoft Graph) OAuth handshake. */
    outlookState?: string;
  }
}
