import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';

interface Booking {
  id: string;
  status: string;
  payment_status?: string | null;
  total_price?: number | null;
  customer_address?: string | null;
  location_notes?: string | null;
  customer?: { name?: string | null } | null;
}

const WorkerDashboardSimple = () => {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const { services } = usePublicServicesData();

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchBookings();
    }
  }, [user, profile]);

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `id, status, payment_status, total_price, customer_address, location_notes,
         customer:users!bookings_customer_id_fkey(name)`
      )
      .eq('worker_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setBookings((data as Booking[]) || []);
    }
    setLoading(false);
  };

  const openAddServices = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowServicesModal(true);
  };

  const handleServiceToggle = (id: string, checked: boolean) => {
    setSelectedServices(prev => ({ ...prev, [id]: checked }));
  };

  const addServices = async () => {
    if (!selectedBooking) return;
    const selected = services.filter(s => selectedServices[s.id]);
    for (const svc of selected) {
      await supabase.from('booking_services').insert({
        booking_id: selectedBooking.id,
        service_id: svc.id,
        service_name: svc.name,
        base_price: svc.base_price,
        quantity: 1,
        configuration: {},
      });
    }
    setSelectedServices({});
    setShowServicesModal(false);
    fetchBookings();
  };

  const completeAndCapture = async (bookingId: string) => {
    await supabase.functions.invoke('capture-payment-intent', {
      body: { bookingId },
    });
    fetchBookings();
  };

  if (!user || profile?.role !== 'worker') {
    return <div className="p-8 text-center text-white">Please sign in as a worker.</div>;
  }

  if (loading) {
    return <div className="p-8 text-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>
      {bookings.map((b) => (
        <div key={b.id} className="bg-slate-700 p-4 rounded mb-4">
          <h2 className="font-semibold">{b.customer?.name || 'Customer'}</h2>
          <p className="text-sm">{b.location_notes || b.customer_address}</p>
          <p className="text-sm capitalize">Status: {b.status}</p>
          {b.payment_status === 'captured' && (
            <p className="text-green-400 mt-2">Final Total: ${b.total_price?.toFixed(2)}</p>
          )}
          <div className="mt-3 space-x-2">
            <Button variant="outline" onClick={() => openAddServices(b)}>
              Add Extra Services
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => completeAndCapture(b.id)}>
              Mark Job Completed + Capture Final Payment
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={showServicesModal} onOpenChange={setShowServicesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Extra Services</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto py-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={!!selectedServices[s.id]}
                  onCheckedChange={(c: any) => handleServiceToggle(s.id, !!c)}
                />
                <span className="text-sm">{s.name} (${s.base_price})</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={addServices}>Add Services</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerDashboardSimple;
