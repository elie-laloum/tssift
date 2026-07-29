/**
 * Wires the endpoint handlers together. No call to `render` here — this file
 * exists so the api layer reads like a real router and imports resolve.
 */

import { showAdmin } from "./admin-endpoint";
import { getProfile } from "./profile-endpoint";
import { previewSearchHit } from "./search-endpoint";
import { getAdminView, getUserView } from "./user-endpoint";

export const routes = {
  "GET /users/:id": getUserView,
  "GET /users/:id/admin": getAdminView,
  "GET /profile": getProfile,
  "GET /admin": showAdmin,
  "GET /search": previewSearchHit,
} as const;
