/**
 * Shared helpers for extracting a booking's street address and instructions.
 *
 * Newer bookings pack the address into `job.location_notes` using " | " as
 * a separator and a trailing " | Notes: ..." suffix for special instructions,
 * e.g. "House #608 | Apt: Encore Lakeside | 1120 Town Creek Drive | Notes: ring bell".
 * Older bookings use `guest_customer_info.address`.
 */

export interface JobLike {
  location_notes?: string | null;
  special_instructions?: string | null;
  customer_address?: string | null;
  guest_customer_info?: {
    address?: string;
    unit?: string;
    apartment_name?: string;
    city?: string;
    state?: string;
    zipcode?: string;
  } | null;
}

const NOTES_MARKER = 'Notes:';
const LEGACY_MARKER = 'Special Instructions:';

function addressFromLocationNotes(locationNotes: string): string | null {
  const notesIdx = locationNotes.indexOf(NOTES_MARKER);
  const legacyIdx = locationNotes.indexOf(LEGACY_MARKER);
  let addressPart = locationNotes;
  if (notesIdx !== -1) addressPart = locationNotes.substring(0, notesIdx);
  else if (legacyIdx !== -1) addressPart = locationNotes.substring(0, legacyIdx);
  addressPart = addressPart.replace(/\s*\|\s*$/, '').trim();
  return addressPart || null;
}

/**
 * Returns the street address for a job.
 * @param job booking-like object
 * @param opts.singleLine if true, joins " | " segments with ", "
 */
export function getJobAddress(
  job: JobLike,
  opts: { singleLine?: boolean } = {}
): string | null {
  if (job.location_notes) {
    const addr = addressFromLocationNotes(job.location_notes);
    if (addr) {
      return opts.singleLine ? addr.replace(/\s*\|\s*/g, ', ') : addr;
    }
  }

  const g = job.guest_customer_info;
  if (g?.address) {
    const parts = [g.address];
    if (g.unit) parts.push(g.unit);
    if (g.city) parts.push(g.city);
    if (g.zipcode) parts.push(g.zipcode);
    return parts.join(opts.singleLine ? ', ' : ' | ');
  }

  if (job.customer_address) return job.customer_address;

  return null;
}

/**
 * Returns special instructions for a job, or null.
 */
export function getJobInstructions(job: JobLike): string | null {
  if (job.special_instructions && job.special_instructions.trim()) {
    return job.special_instructions.trim();
  }
  const ln = job.location_notes;
  if (ln) {
    const notesIdx = ln.indexOf(NOTES_MARKER);
    if (notesIdx !== -1) {
      const t = ln.substring(notesIdx + NOTES_MARKER.length).trim();
      return t || null;
    }
    const legacyIdx = ln.indexOf(LEGACY_MARKER);
    if (legacyIdx !== -1) {
      const t = ln.substring(legacyIdx + LEGACY_MARKER.length).trim();
      return t || null;
    }
  }
  return null;
}
