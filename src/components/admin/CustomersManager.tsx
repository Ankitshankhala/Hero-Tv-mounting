
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Phone, Mail, MapPin } from 'lucide-react';
import { CustomerHistoryModal } from './CustomerHistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  zip_code?: string;
  totalBookings: number;
  totalSpent: string;
  lastBooking?: string;
}

export const CustomersManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log('Fetching customers...');

      // Fetch all customers (users with role 'customer')
      const { data: customersData, error: customersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        throw customersError;
      }

      console.log('Raw customers data:', customersData);

      if (!customersData || customersData.length === 0) {
        console.log('No customers found');
        setCustomers([]);
        return;
      }

      // Enrich customer data with booking statistics
      const enrichedCustomers = await Promise.all(
        customersData.map(async (customer) => {
          // Get booking count and total spent
          const { data: bookingsData, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
              id,
              created_at,
              status,
              services (base_price)
            `)
            .eq('customer_id', customer.id);

          if (bookingsError) {
            console.error('Error fetching bookings for customer:', customer.id, bookingsError);
          }

          const bookings = bookingsData || [];
          const totalBookings = bookings.length;
          
          // Calculate total spent from completed bookings
          const totalSpent = bookings
            .filter(booking => booking.status === 'completed')
            .reduce((sum, booking) => {
              const price = booking.services?.base_price || 0;
              return sum + Number(price);
            }, 0);

          // Get last booking date
          const lastBookingDate = bookings.length > 0 
            ? new Date(Math.max(...bookings.map(b => new Date(b.created_at).getTime())))
            : null;

          const enrichedCustomer: Customer = {
            id: customer.id,
            name: customer.name || 'No name provided',
            email: customer.email,
            phone: customer.phone,
            city: customer.city,
            zip_code: customer.zip_code,
            totalBookings,
            totalSpent: `$${totalSpent.toFixed(2)}`,
            lastBooking: lastBookingDate ? lastBookingDate.toLocaleDateString() : 'No bookings'
          };

          return enrichedCustomer;
        })
      );

      console.log('Enriched customers:', enrichedCustomers);
      setCustomers(enrichedCustomers);
    } catch (error) {
      console.error('Error in fetchCustomers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
  };

  const handleCloseHistoryModal = () => {
    setSelectedCustomer(null);
    setShowHistoryModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm ? 'No customers found matching your search.' : 'No customers found.'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Total Bookings</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Booking</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{customer.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-sm">
                              <Mail className="h-3 w-3" />
                              <span>{customer.email}</span>
                            </div>
                            {customer.phone && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Phone className="h-3 w-3" />
                                <span>{customer.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-sm">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {customer.city ? `${customer.city}` : ''}
                              {customer.zip_code ? ` ${customer.zip_code}` : ''}
                              {!customer.city && !customer.zip_code ? 'Not provided' : ''}
                            </span>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
