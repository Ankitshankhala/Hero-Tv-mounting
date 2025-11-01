import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TipBookingDetailsRowProps {
  workerId: string;
  workerName: string;
  startDate?: string;
  endDate?: string;
}

interface BookingDetail {
  booking_id: string;
  customer_name: string;
  customer_email: string | null;
  tip_amount: number;
  service_date: string;
  booking_status: string;
  payment_status: string;
  has_duplicate_transactions: boolean;
}

export function TipBookingDetailsRow({ workerId, workerName, startDate, endDate }: TipBookingDetailsRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<BookingDetail[]>([]);
  const { toast } = useToast();

  const loadBookingDetails = async () => {
    if (!isOpen || bookingDetails.length > 0) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_worker_tip_booking_details', {
        p_worker_id: workerId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

      if (error) throw error;
      setBookingDetails(data || []);
    } catch (error: any) {
      console.error('Error loading booking details:', error);
      toast({
        title: "Failed to load booking details",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBookingDetails();
    }
  }, [isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start p-0 h-auto hover:bg-transparent">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-1" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Loading booking details...
          </div>
        ) : bookingDetails.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No booking details available
          </div>
        ) : (
          <div className="ml-6 border-l-2 border-muted pl-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Individual Tips for {workerName}
            </div>
            <div className="border rounded-lg overflow-hidden bg-muted/10">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2">Booking ID</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-right p-2">Tip Amount</th>
                    <th className="text-left p-2">Service Date</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingDetails.map((booking) => (
                    <tr key={booking.booking_id} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-mono text-xs">
                        {booking.booking_id.slice(0, 8)}...
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span>{booking.customer_name}</span>
                          {booking.customer_email && (
                            <span className="text-xs text-muted-foreground">{booking.customer_email}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right font-semibold text-green-600">
                        ${booking.tip_amount.toFixed(2)}
                        {booking.has_duplicate_transactions && (
                          <span title="Multiple transactions detected">
                            <AlertTriangle className="inline h-3 w-3 ml-1 text-orange-500" />
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {new Date(booking.service_date).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {booking.booking_status}
                          </Badge>
                          <Badge variant={booking.payment_status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {booking.payment_status}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              Total: {bookingDetails.length} booking{bookingDetails.length !== 1 ? 's' : ''} with tips •
              Sum: ${bookingDetails.reduce((sum, b) => sum + b.tip_amount, 0).toFixed(2)}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
