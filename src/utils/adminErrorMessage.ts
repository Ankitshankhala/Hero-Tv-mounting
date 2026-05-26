/**
 * Translate a Supabase / Postgres / network error into a precise,
 * admin-facing message. Never returns a generic "Failed to ..." string —
 * always surfaces the actual code, message, details, and hint so the
 * admin knows exactly why the operation was blocked.
 */
export interface AdminErrorInfo {
  title: string;
  description: string;
  code?: string;
}

const RLS_RE = /row-level security|violates row-level security|permission denied/i;
const JWT_RE = /jwt|token.*(expired|invalid)|not authenticated/i;

export function formatAdminError(error: unknown, op = 'operation'): AdminErrorInfo {
  // Network / fetch failure (no Supabase response object)
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return {
      title: 'Network error',
      description: `Could not reach Supabase to ${op}. Check your connection. (${error.message})`,
    };
  }

  const err = (error || {}) as Record<string, any>;
  const code: string | undefined = err.code;
  const message: string = err.message || err.error_description || String(error || 'Unknown error');
  const details: string | undefined = err.details;
  const hint: string | undefined = err.hint;
  const status: number | undefined = err.status;

  const append = (base: string) => {
    const extras = [details, hint && `Hint: ${hint}`, code && `[code ${code}]`]
      .filter(Boolean)
      .join(' · ');
    return extras ? `${base} — ${extras}` : base;
  };

  // Postgres error codes
  switch (code) {
    case '23503': {
      // FK violation. details usually contains the offending table/constraint.
      // e.g. "Key (id)=(...) is still referenced from table \"bookings\"."
      const tableMatch = details?.match(/from table "([^"]+)"/);
      const refTable = tableMatch?.[1];
      return {
        code,
        title: 'Cannot delete — record is still in use',
        description: append(
          refTable
            ? `Blocked by foreign key: this row is still referenced by the \`${refTable}\` table. Archive (deactivate) instead of deleting to preserve history.`
            : `Blocked by foreign key constraint. Archive (deactivate) instead of deleting to preserve history.`,
        ),
      };
    }
    case '23505':
      return {
        code,
        title: 'Duplicate value',
        description: append(`A record with this value already exists. ${message}`),
      };
    case '23502':
      return {
        code,
        title: 'Missing required field',
        description: append(message),
      };
    case '23514':
      return {
        code,
        title: 'Check constraint failed',
        description: append(message),
      };
    case '42501':
      return {
        code,
        title: 'Blocked by Row Level Security',
        description: append(
          `Your account is not allowed to ${op} this row. Either the RLS policy doesn't grant access to the admin role, or your session is not recognized as admin.`,
        ),
      };
    case 'P0001':
      // RAISE EXCEPTION from a trigger — show the trigger's message verbatim
      return {
        code,
        title: 'Database rule blocked this action',
        description: append(message),
      };
    case 'PGRST301':
    case 'PGRST302':
      return {
        code,
        title: 'Session expired',
        description: 'Please sign out and sign back in as admin, then retry.',
      };
    case 'PGRST116':
      return {
        code,
        title: 'No matching row',
        description: append(`The target row no longer exists or is not visible to your role.`),
      };
  }

  // Pattern fallbacks
  if (RLS_RE.test(message)) {
    return {
      code,
      title: 'Blocked by Row Level Security',
      description: append(
        `RLS prevented this ${op}. Confirm your user has role='admin' in public.users and that the table has an admin policy.`,
      ),
    };
  }
  if (JWT_RE.test(message)) {
    return {
      code,
      title: 'Session expired',
      description: 'Please sign out and sign back in as admin, then retry.',
    };
  }
  if (status && status >= 500) {
    return {
      code,
      title: 'Supabase server error',
      description: append(`${status} — ${message}`),
    };
  }

  return {
    code,
    title: `Could not ${op}`,
    description: append(message || 'Unknown error'),
  };
}
