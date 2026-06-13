import { Router } from 'express';
import { z } from 'zod';
import { ALL_PERMISSIONS } from '@rilo/shared';
import { Role, User } from '../models';
import { asyncHandler } from '../middleware/error';
import { requirePermission, requireSuperAdmin, invalidateRolesCache } from '../lib/permissions';

export const rolesRouter = Router();

const ALL_PERMISSION_SET = new Set(ALL_PERMISSIONS);

const permissionsSchema = z
  .array(z.string())
  .transform((arr) => Array.from(new Set(arr)))
  .refine((arr) => arr.every((p) => ALL_PERMISSION_SET.has(p)), {
    message: 'One or more permissions are not recognised.',
  });

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  description: z.string().trim().max(200).optional().default(''),
  permissions: permissionsSchema.optional().default([]),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  permissions: permissionsSchema.optional(),
});

/** Slugify a role name into a stable key (lowercase, hyphenated). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** GET /api/roles — list all roles (needs team:view). */
rolesRouter.get(
  '/',
  requirePermission('team:view'),
  asyncHandler(async (_req, res) => {
    const roles = await Role.find().sort({ isSystem: -1, createdAt: 1 });
    res.json(roles.map((r) => r.toJSON()));
  }),
);

/** POST /api/roles — create a custom role (super admin only). */
rolesRouter.post(
  '/',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { name, description, permissions } = createSchema.parse(req.body ?? {});
    const key = slugify(name);
    if (!key) {
      res.status(400).json({ error: 'Name must contain at least one letter or number.' });
      return;
    }
    if (await Role.exists({ key })) {
      res.status(400).json({ error: 'A role with a similar name already exists.' });
      return;
    }
    const role = await Role.create({ key, name, description, permissions, isSystem: false });
    invalidateRolesCache();
    res.status(201).json(role.toJSON());
  }),
);

/** PATCH /api/roles/:id — edit name/description/permissions (super admin only). */
rolesRouter.patch(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const patch = updateSchema.parse(req.body ?? {});
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    // key + isSystem are immutable; only name/description/permissions change.
    if (patch.name !== undefined) role.set('name', patch.name);
    if (patch.description !== undefined) role.set('description', patch.description);
    if (patch.permissions !== undefined) role.set('permissions', patch.permissions);
    await role.save();
    invalidateRolesCache();
    res.json(role.toJSON());
  }),
);

/** DELETE /api/roles/:id — delete a custom role (super admin only). */
rolesRouter.delete(
  '/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (role.get('isSystem')) {
      res.status(400).json({ error: 'Built-in roles cannot be deleted.' });
      return;
    }
    const inUse = await User.countDocuments({ role: role.get('key') });
    if (inUse > 0) {
      res.status(400).json({
        error: `${inUse} user${inUse === 1 ? '' : 's'} still use this role. Reassign them first.`,
      });
      return;
    }
    await role.deleteOne();
    invalidateRolesCache();
    res.json({ ok: true });
  }),
);
