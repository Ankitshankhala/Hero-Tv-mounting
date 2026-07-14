import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ShieldCheck, ShoppingCart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Admin-only runtime toggle that switches the storefront checkout engine
 * between the classic flow (V1) and the payment-first flow (V2).
 *
 * Reads/writes `app_settings.payment_first_enabled` ('true' | 'false').
 * Mirrors StripeModeToggle exactly — same visual language, same direct
 * supabase.from('app_settings').upsert() path, same admin RLS policy.
 */
export const PaymentFirstToggle: React.FC = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payment_first_enabled")
        .maybeSingle();
      if (error) throw error;
      const v = String(data?.value ?? "").trim().toLowerCase();
      setEnabled(v === "true");
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const requestSwitch = (next: boolean) => {
    if (next === enabled) return;
    setPendingValue(next);
  };

  const confirmSwitch = async () => {
    if (pendingValue === null) return;
    setSaving(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id ?? null;

      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: "payment_first_enabled",
            value: pendingValue ? "true" : "false",
            updated_by: userId,
          },
          { onConflict: "key" },
        );

      if (error) throw error;

      setEnabled(pendingValue);
      toast({
        title: `Checkout engine switched to ${
          pendingValue ? "Payment-First (V2)" : "Classic (V1)"
        }`,
        description:
          "Changes take effect for new page loads — customers already on the site keep the engine they loaded with.",
      });
      setPendingValue(null);
    } catch (err: any) {
      toast({
        title: "Failed to switch checkout engine",
        description: err?.message ?? "You may not have admin permissions.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        className={
          enabled
            ? "border-emerald-400/60 bg-emerald-50/30 dark:bg-emerald-950/20"
            : "border-slate-400/40"
        }
      >
        <CardHeader className="bg-secondary text-primary">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {enabled ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ShoppingCart className="h-5 w-5 text-secondary-foreground" />
                )}
                Checkout Engine
                <Badge
                  variant="outline"
                  className={
                    enabled
                      ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
                  }
                >
                  {enabled ? "PAYMENT-FIRST (V2)" : "CLASSIC (V1)"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Switch the storefront between the classic booking flow (V1)
                and the payment-first flow (V2), which authorizes the card
                before any booking row is created.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">V1</span>
              <Switch
                checked={enabled}
                disabled={loading || saving}
                onCheckedChange={(checked) => requestSwitch(checked)}
                aria-label="Toggle payment-first checkout engine"
              />
              <span className="text-xs text-muted-foreground">V2</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-foreground space-y-2 pt-4">
          <p>
            <strong className="text-foreground">Current engine:</strong>{" "}
            <span
              className={
                enabled
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-foreground"
              }
            >
              {enabled ? "Payment-First (V2)" : "Classic (V1)"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Changes apply on new page loads. Customers who already have the
            site open will keep the engine they loaded with until they
            refresh.
          </p>
          {enabled && (
            <p className="text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Payment-first is active — cards are authorized before any
                booking row is created, preventing abandoned{" "}
                <code className="px-1 rounded bg-muted">payment_pending</code>{" "}
                bookings.
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingValue !== null}
        onOpenChange={(open) => !open && setPendingValue(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className={
                  pendingValue
                    ? "h-5 w-5 text-emerald-600"
                    : "h-5 w-5 text-amber-600"
                }
              />
              Switch checkout engine to{" "}
              {pendingValue ? "Payment-First (V2)" : "Classic (V1)"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm">
                {pendingValue ? (
                  <p>
                    This routes all NEW customer bookings through the
                    payment-first engine (card authorized before the booking
                    is created). Continue?
                  </p>
                ) : (
                  <p>
                    This reverts new bookings to the classic flow. Continue?
                  </p>
                )}
                <p className="text-muted-foreground">
                  Changes apply to new page loads only.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmSwitch();
              }}
              disabled={saving}
              className={
                pendingValue
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching…
                </>
              ) : (
                `Yes, switch to ${pendingValue ? "V2" : "V1"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
