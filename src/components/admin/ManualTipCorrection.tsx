import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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

interface BookingWithTransaction {
  booking_id: string;
  customer_name: string;
  customer_email: string;
  service_date: string;
  booking_status: string;
  payment_status: string;
  transaction_id: string;
  transaction_total: number;
  current_base_amount: number;
  current_tip_amount: number;
  booking_tip_amount: number;
}

export function ManualTipCorrection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<BookingWithTransaction | null>(null);
  const [correctedBase, setCorrectedBase] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const searchBooking = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a booking ID, customer name, or email",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setBooking(null);
      setCorrectedBase("");

      // Search bookings with transactions
      const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_date,
          status,
          payment_status,
          tip_amount,
          customer_id,
          guest_customer_info,
          users!customer_id (
            name,
            email
          ),
          transactions (
            id,
            amount,
            base_amount,
            tip_amount
          )
        `)
        .or(`id.eq.${searchQuery},guest_customer_info->>email.ilike.%${searchQuery}%`)
        .not('transactions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (bookingError) throw bookingError;

      // Also search by customer name/email if UUID search didn't work
      let finalBookings = bookings;
      if (!bookings || bookings.length === 0) {
        const { data: customerBookings, error: customerError } = await supabase
          .from('bookings')
          .select(`
            id,
            scheduled_date,
            status,
            payment_status,
            tip_amount,
            customer_id,
            guest_customer_info,
            users!customer_id (
              name,
              email
            ),
            transactions (
              id,
              amount,
              base_amount,
              tip_amount
            )
          `)
          .not('transactions', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (customerError) throw customerError;

        // Filter by customer name or email
        finalBookings = customerBookings?.filter((b: any) => {
          const users = b.users as any;
          const guestInfo = b.guest_customer_info as any;
          const name = users?.name || guestInfo?.name || '';
          const email = users?.email || guestInfo?.email || '';
          const query = searchQuery.toLowerCase();
          return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
        });
      }

      if (!finalBookings || finalBookings.length === 0) {
        toast({
          title: "No Results",
          description: "No booking found with the provided search term",
          variant: "destructive",
        });
        return;
      }

      // Use the first booking
      const foundBooking = finalBookings[0] as any;
      const transaction = (foundBooking.transactions as any[])?.[0];
      
      if (!transaction) {
        toast({
          title: "No Transaction",
          description: "This booking has no associated transaction",
          variant: "destructive",
        });
        return;
      }

      const users = foundBooking.users as any;
      const guestInfo = foundBooking.guest_customer_info as any;

      setBooking({
        booking_id: foundBooking.id,
        customer_name: users?.name || guestInfo?.name || 'Guest Customer',
        customer_email: users?.email || guestInfo?.email || 'N/A',
        service_date: foundBooking.scheduled_date,
        booking_status: foundBooking.status,
        payment_status: foundBooking.payment_status,
        transaction_id: transaction.id,
        transaction_total: Number(transaction.amount),
        current_base_amount: Number(transaction.base_amount || 0),
        current_tip_amount: Number(transaction.tip_amount || 0),
        booking_tip_amount: Number(foundBooking.tip_amount || 0),
      });

    } catch (error: any) {
      console.error('Error searching booking:', error);
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatedTip = booking && correctedBase 
    ? booking.transaction_total - Number(correctedBase)
    : 0;

  const isValid = booking && correctedBase && 
    Number(correctedBase) >= 0 && 
    calculatedTip >= 0 &&
    Number(correctedBase) + calculatedTip === booking.transaction_total;

  const hasIncorrectTip = booking && 
    booking.current_base_amount === 0 && 
    booking.current_tip_amount === booking.transaction_total;

  const applyCorrection = async () => {
    if (!booking || !isValid) return;

    try {
      setSaving(true);

      const baseAmount = Number(correctedBase);
      const tipAmount = calculatedTip;

      // Update transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          base_amount: baseAmount,
          tip_amount: tipAmount,
        })
        .eq('id', booking.transaction_id);

      if (transactionError) throw transactionError;

      // Update booking tip amount
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          tip_amount: tipAmount,
        })
        .eq('id', booking.booking_id);

      if (bookingError) throw bookingError;

      // Log the correction
      await supabase
        .from('booking_audit_log')
        .insert({
          booking_id: booking.booking_id,
          operation: 'manual_tip_correction',
          status: 'success',
          details: {
            old_base_amount: booking.current_base_amount,
            old_tip_amount: booking.current_tip_amount,
            new_base_amount: baseAmount,
            new_tip_amount: tipAmount,
            corrected_by: 'admin',
            corrected_at: new Date().toISOString(),
          },
        });

      toast({
        title: "Correction Applied",
        description: `Successfully updated tip amounts for booking ${booking.booking_id.slice(0, 8)}`,
      });

      // Reset form
      setBooking(null);
      setSearchQuery("");
      setCorrectedBase("");
      setShowConfirmDialog(false);

    } catch (error: any) {
      console.error('Error applying correction:', error);
      toast({
        title: "Correction Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Tip Correction Tool</CardTitle>
        <CardDescription>
          Search for bookings and manually correct tip amounts for one-off fixes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Section */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter booking ID, customer name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchBooking()}
            className="flex-1"
          />
          <Button onClick={searchBooking} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Booking Details */}
        {booking && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {booking.customer_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{booking.customer_email}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Booking ID: <span className="font-mono">{booking.booking_id.slice(0, 8)}...</span>
                  </p>
                </div>
                {hasIncorrectTip && (
                  <Alert className="w-auto border-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      100% recorded as tip
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div>
                  <span className="text-muted-foreground">Service Date:</span>
                  <p className="font-medium">{new Date(booking.service_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium capitalize">{booking.booking_status} | {booking.payment_status}</p>
                </div>
              </div>
            </div>

            {/* Current Values */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <h4 className="font-semibold text-sm mb-3">Current Values</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Transaction Total</span>
                  <p className="font-semibold text-lg">${booking.transaction_total.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Base Amount</span>
                  <p className={`font-semibold text-lg ${hasIncorrectTip ? 'text-destructive' : ''}`}>
                    ${booking.current_base_amount.toFixed(2)}
                    {hasIncorrectTip && " ⚠️"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tip Amount</span>
                  <p className={`font-semibold text-lg ${hasIncorrectTip ? 'text-destructive' : 'text-green-600'}`}>
                    ${booking.current_tip_amount.toFixed(2)}
                    {hasIncorrectTip && ` (100%)`}
                  </p>
                </div>
              </div>
            </div>

            {/* Correction Form */}
            <div className="border rounded-lg p-4 space-y-4 bg-primary/5">
              <h4 className="font-semibold text-sm">Correct Values</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Base Amount
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={booking.transaction_total}
                    placeholder="0.00"
                    value={correctedBase}
                    onChange={(e) => setCorrectedBase(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Tip Amount (auto-calculated)
                  </label>
                  <Input
                    type="text"
                    value={calculatedTip.toFixed(2)}
                    disabled
                    className="font-mono bg-muted"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Remaining
                  </label>
                  <Input
                    type="text"
                    value={(booking.transaction_total - (Number(correctedBase) || 0)).toFixed(2)}
                    disabled
                    className="font-mono bg-muted"
                  />
                </div>
              </div>

              {correctedBase && !isValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Base amount + Tip amount must equal the transaction total (${booking.transaction_total.toFixed(2)})
                  </AlertDescription>
                </Alert>
              )}

              {isValid && (
                <Alert className="border-green-600 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Values are valid. Base: ${Number(correctedBase).toFixed(2)} + Tip: ${calculatedTip.toFixed(2)} = ${booking.transaction_total.toFixed(2)}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={() => setShowConfirmDialog(true)}
                disabled={!isValid || saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying Correction...
                  </>
                ) : (
                  'Apply Correction'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Tip Correction</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to update the tip amounts for booking{" "}
                <span className="font-mono font-semibold">{booking?.booking_id.slice(0, 8)}</span>.
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base Amount:</span>
                    <span className="font-semibold">
                      ${booking?.current_base_amount.toFixed(2)} → ${Number(correctedBase).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tip Amount:</span>
                    <span className="font-semibold text-green-600">
                      ${booking?.current_tip_amount.toFixed(2)} → ${calculatedTip.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="mt-4">This action will update both the transaction and booking records.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={applyCorrection} disabled={saving}>
                {saving ? 'Applying...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
