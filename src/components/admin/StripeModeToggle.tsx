import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AlertTriangle, TestTube, Zap, Loader2 } from "lucide-react";
import { useStripeMode } from "@/hooks/useStripeMode";
import { useToast } from "@/hooks/use-toast";
import type { StripeMode } from "@/lib/stripe";

/**
 * Admin-only runtime toggle that flips the entire app between Stripe
 * Test and Live modes. Updates the `app_settings.stripe_mode` row, which
 * is read by both the frontend (publishable key selection) and edge
 * functions (secret key selection).
 */
export const StripeModeToggle: React.FC = () => {
  const { mode, loading, setMode } = useStripeMode();
  const { toast } = useToast();
  const [pendingMode, setPendingMode] = useState<StripeMode | null>(null);
  const [saving, setSaving] = useState(false);

  const isTest = mode === "test";

  const requestSwitch = (next: StripeMode) => {
    if (next === mode) return;
    setPendingMode(next);
  };

  const confirmSwitch = async () => {
    if (!pendingMode) return;
    setSaving(true);
    try {
      await setMode(pendingMode);
      toast({
        title: `Stripe mode switched to ${pendingMode.toUpperCase()}`,
        description:
          pendingMode === "test"
            ? "All payments now use Stripe TEST keys. No real charges will be made."
            : "All payments now use Stripe LIVE keys. Real charges will be made.",
      });
      setPendingMode(null);
    } catch (err: any) {
      toast({
        title: "Failed to switch Stripe mode",
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
          isTest
            ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20"
            : "border-emerald-400/40"
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isTest ? (
                  <TestTube className="h-5 w-5 text-secondary-foreground" />
                ) : (
                  <Zap className="h-5 w-5 text-emerald-600" />
                )}
                Stripe Mode
                <Badge
                  variant="outline"
                  className={
                    isTest
                      ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }
                >
                  {isTest ? "TEST" : "LIVE"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Switch the entire application between Stripe Test and Live
                environments. Affects both the storefront and all backend edge
                functions.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">Live</span>
              <Switch
                checked={isTest}
                disabled={loading || saving}
                onCheckedChange={(checked) =>
                  requestSwitch(checked ? "test" : "live")
                }
                aria-label="Toggle Stripe test mode"
              />
              <span className="text-xs text-muted-foreground">Test</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-primary space-y-2">
          <p className="text-primary">
            <strong className="text-primary">Current mode:</strong>{" "}
            <span
              className={
                isTest ? "font-medium text-secondary-foreground" : "text-emerald-700 font-medium"
              }
            >
              {mode.toUpperCase()}
            </span>
          </p>
          <p className="text-secondary-foreground">
            <strong className="text-primary">Required secrets:</strong> Both{" "}
            <code className="px-1 rounded bg-muted text-destructive">STRIPE_SECRET_KEY</code> and{" "}
            <code className="px-1 rounded bg-muted text-destructive">STRIPE_SECRET_KEY_TEST</code>{" "}
            must be configured in Supabase Edge Function Secrets for the toggle
            to work in either direction.
          </p>
          {isTest && (
            <p className="text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                You are in TEST mode. Use Stripe test cards (e.g. 4242 4242
                4242 4242). Do not share this URL with real customers.
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingMode !== null}
        onOpenChange={(open) => !open && setPendingMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className={
                  pendingMode === "live" ? "h-5 w-5 text-emerald-600" : "h-5 w-5 text-amber-600"
                }
              />
              Switch Stripe to {pendingMode?.toUpperCase()} mode?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm">
                {pendingMode === "test" ? (
                  <>
                    <p>
                      You are about to switch the entire site to Stripe{" "}
                      <strong>TEST</strong> mode. This means:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>No real charges will be processed.</li>
                      <li>
                        Any customer who attempts checkout right now will need
                        to use a Stripe test card.
                      </li>
                      <li>
                        In-flight checkouts (customers currently on the payment
                        screen) may fail with a key-mismatch error and need to
                        retry.
                      </li>
                    </ul>
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Remember to switch back to LIVE before serving real
                      customers.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      You are about to switch the entire site to Stripe{" "}
                      <strong>LIVE</strong> mode. From this moment on, real
                      cards will be charged real money.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Any test booking left in an authorized state will not
                        be capturable in live mode.
                      </li>
                      <li>
                        Make sure all testing is complete before switching.
                      </li>
                    </ul>
                  </>
                )}
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
                pendingMode === "test"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching…
                </>
              ) : (
                `Yes, switch to ${pendingMode?.toUpperCase()}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
