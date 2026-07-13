# Complete the users PII containment fix — frontend migration

Migration is already applied. Now execute the frontend changes so admin screens and the auth profile fetch keep working.

## Files to edit (all use `.from('admin_worker_directory' as any)` cast because generated types may lag)

1. `src/hooks/useBookingManager.tsx` — 2 sites (lines 59-63, 241-245): `.from('users')` → `.from('admin_worker_directory' as any)`. Columns unchanged (`id, name, email, phone`).
2. `src/hooks/useAdminServiceAreas.ts` — 2 sites (lines 50-54, 180-184): same rewrite. Keep `.eq('role', 'worker')`.
3. `src/components/admin/AssignWorkerModal.tsx` — line 87 worker query (`id, name, city, phone, email`) → view. Line 246 (customer `email`): keep raw `.from('users')` — admin-only route, but that select requests `email` which is now blocked; migrate to view too and select `id, email` filtered by `id = customer_id` (view is scoped to admins with any role filter — need to allow non-worker rows). **Adjust the view to NOT filter by role**: it should return any `users` row when caller is admin. Update migration if needed — or keep the customer-email fetch on `users` and read the email via the RPC or via a dedicated admin function. Simpler: change the view to `SELECT ... FROM users WHERE get_current_user_role()='admin'` (already correct — the view has no role filter; the code has `.eq('role','worker')` in some callers only). ✅ Already fine — just verify.
4. `src/components/admin/EditBookingModal.tsx` — line 86: view.
5. `src/components/admin/CreateBookingModal.tsx` — line 80: view.
6. `src/components/admin/AdminCalendarView.tsx` — line 71: view.
7. `src/components/admin/WorkerWeeklyPayments.tsx` — line 69 (worker `email`): view. Line 113 (customers `id, name`): can stay on `users` (safe columns still granted).
8. `src/components/admin/WorkersManager.tsx` — line 78 with embedded `worker_availability` join. **Split into two queries**: fetch workers from `admin_worker_directory`, then `worker_availability` where `worker_id in (...)`, then merge in JS. Preserves the shape `worker.worker_availability = [...]` that the component reads later.
9. `src/components/admin/ZctaManagementDashboard.tsx` — line 81: view.
10. `src/components/admin/WorkerAssignmentManager.tsx` — lines 28 (worker email/name) and 107 (customer email): both to view.
11. `src/components/admin/PendingWorkersManager.tsx` — line 33: view.
12. `src/hooks/useAuth.tsx` — lines 99-103: replace with `const { data } = await supabase.rpc('get_my_profile' as any); setProfile(data);`.

## Verification after edits

- Typecheck.
- Regenerated Supabase types should now include the view + RPC; the `as any` casts remain as belt-and-suspenders in case regen races.
- Manual: admin log in → BookingsManager, WorkersManager, AssignWorkerModal, Weekly Payments, Zcta dashboard all still show worker email/phone.
- Manual: customer log in → CustomerDashboard still shows assigned worker's `name` + `phone` (uses the still-granted columns via the `bookings` FK embed).
- Manual: any user → own-profile screen still renders (`get_my_profile` RPC path).
- Adversarial: log in as customer, run `supabase.from('users').select('email').eq('role','worker')` in DevTools — response should have `email: null` for every row (PostgREST omits ungranted columns) and `.from('admin_worker_directory').select('email')` returns empty (view predicate blocks non-admin).

## Rollback

If a regression appears, single migration:
```sql
GRANT SELECT ON public.users TO authenticated;
```
restores the previous read shape without any code rollback needed (the `as any` cast on `admin_worker_directory` still resolves; it just returns rows since the view predicate stays admin-only).
