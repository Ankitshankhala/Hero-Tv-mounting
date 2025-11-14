import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCoupons, type CouponUsage } from '@/hooks/useCoupons';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CouponUsageModalProps {
  open: boolean;
  onClose: () => void;
  couponId: string;
  couponCode: string;
}

export const CouponUsageModal = ({ open, onClose, couponId, couponCode }: CouponUsageModalProps) => {
  const { fetchCouponUsage } = useCoupons();
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadUsage();
    }
  }, [open, couponId]);

  const loadUsage = async () => {
    setLoading(true);
    const data = await fetchCouponUsage(couponId);
    setUsage(data);
    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['Customer Email', 'Booking ID', 'Discount Amount', 'Order Total', 'Used At'];
    const rows = usage.map((u) => [
      u.customer_email,
      u.booking_id || 'N/A',
      `$${u.discount_amount.toFixed(2)}`,
      `$${u.order_total.toFixed(2)}`,
      new Date(u.used_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coupon-usage-${couponCode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Usage History: {couponCode}</DialogTitle>
            {usage.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                Export to CSV
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading usage history...</div>
        ) : usage.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            This coupon has not been used yet.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Email</TableHead>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Order Total</TableHead>
                  <TableHead>Used At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.customer_email}</TableCell>
                    <TableCell>
                      {u.booking_id ? (
                        <a
                          href={`/admin?tab=bookings&id=${u.booking_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {u.booking_id.substring(0, 8)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      -${u.discount_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>${u.order_total.toFixed(2)}</TableCell>
                    <TableCell>{new Date(u.used_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
