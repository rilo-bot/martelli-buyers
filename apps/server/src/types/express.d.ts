import 'express';

/**
 * Request augmentation for auth + RBAC. `requireAuth` populates both:
 *  - `user`    — the resolved session User document
 *  - `auth`    — effective permissions for this request (see lib/permissions)
 */
declare global {
  namespace Express {
    interface Request {
      // Mongoose document; kept loose to avoid model-typing churn.
      user?: any;
      auth?: {
        user: any;
        permissions: Set<string>;
        isSuperAdmin: boolean;
      };
    }
  }
}
