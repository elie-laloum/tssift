/**
 * Registers the background jobs. No `render` call here; this file only wires
 * the job functions so the jobs layer imports resolve.
 */

import { logPurgedUser } from "./cleanup-job";
import { buildDigest } from "./digest-job";
import { exportRow } from "./export-job";
import { reminderLine } from "./reminder-job";

export const jobs = {
  digest: buildDigest,
  cleanup: logPurgedUser,
  reminder: reminderLine,
  export: exportRow,
} as const;
