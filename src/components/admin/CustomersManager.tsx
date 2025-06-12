
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Phone, Mail, MapPin } from 'lucide-react';
import { CustomerHistoryModal } from './CustomerHistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const CustomersManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          bookings!customer_id(id, total_price, created_at, status)
        `)
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedCustomers = data?.map(user => {
        const userBookings = user.bookings || [];
        const totalSpent = userBookings.reduce((sum: number, booking: any) => sum + (booking.total_price || 0), 0);
        const lastBooking = userBookings.length > 0 
          ? new Date(Math.max(...userBookings.map((b: any) => new Date(b.created_at).getTime()))).toLocaleDateString()
          : 'Never';

        return {
          id: user.id,
          name: user.name || 'Unknown',
          email: user.email,
          phone: user.phone || 'N/A',
          address: `${user.city || ''}, ${user.region || ''}`.trim().replace(/^,|,$/, '') || 'N/A',
          totalBookings: userBookings.length,
          totalSpent: `$${totalSpent.toFixed(2)}`,
          lastBooking
        };
      }) || [];

      setCustomers(transformedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = (customer: any) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
  };

  const handleCloseHistoryModal = () => {
    setSelectedCustomer(null);
    setShowHistoryModal(false);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="h-64 bg-gray-200 animate-pulse rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Customer Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Total Bookings</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Last Booking</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <div className="font-medium">{customer.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-sm">
                              <Mail className="h-3 w-3" />
                              <span>{customer.email}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm">
                              <Phone className="h-3 w-3" />
                              <span>{customer.phone}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-sm">
                            <MapPin className="h-3 w-3" />
                            <span>{customer.address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {customer.totalBookings}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{customer.totalSpent}</TableCell>
                        <TableCell>{customer.lastBooking}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewHistory(customer)}
                          >
                            View History
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer History Modal */}
      <CustomerHistoryModal
        customer={selectedCustomer}
        isOpen={showHistoryModal}
        onClose={handleCloseHistoryModal}
      />
    </>
  );
};
