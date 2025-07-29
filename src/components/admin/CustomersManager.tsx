
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
  email: string; // Use email as unique identifier for guests
  name: string;
  phone?: string;
  city?: string;
  zipcode?: string;
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
      console.log('Fetching guest customers...');

      // Fetch all guest bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          scheduled_date,
          status,
          guest_customer_info
        `)
        .not('guest_customer_info', 'is', null)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching guest bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Raw guest bookings data:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No guest customers found');
        setCustomers([]);
        return;
      }

      // Group bookings by customer email and calculate statistics
      const customerMap = new Map<string, any>();
      
      bookingsData.forEach((booking) => {
        const guestInfo = booking.guest_customer_info as any;
        if (!guestInfo || !guestInfo.email) return;

        const email = guestInfo.email;
        
        if (!customerMap.has(email)) {
          customerMap.set(email, {
            email,
            name: guestInfo.name || 'No name provided',
            phone: guestInfo.phone,
            city: guestInfo.city,
            zipcode: guestInfo.zipcode,
            bookings: [],
            totalSpent: 0
          });
        }

        const customer = customerMap.get(email);
        customer.bookings.push(booking);

        // Calculate total spent from completed bookings - will be handled in future implementation
        if (booking.status === 'completed') {
          // For now, set a default value since pricing calculation is complex
          customer.totalSpent += 100; // Placeholder amount
        }
      });

      // Convert map to array and create enriched customer objects
      const enrichedCustomers: Customer[] = Array.from(customerMap.values()).map((customer) => {
        const totalBookings = customer.bookings.length;
        
        // Get last booking date
        const lastBookingDate = customer.bookings.length > 0 
          ? new Date(Math.max(...customer.bookings.map((b: any) => new Date(b.created_at).getTime())))
          : null;

        return {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          zipcode: customer.zipcode,
          totalBookings,
          totalSpent: `$${customer.totalSpent.toFixed(2)}`,
          lastBooking: lastBookingDate ? lastBookingDate.toLocaleDateString() : 'No bookings'
        };
      });

      console.log('Enriched guest customers:', enrichedCustomers);
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
                    <TableHead>Email</TableHead>
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
                      <TableRow key={customer.email}>
                        <TableCell className="font-medium">
                          {customer.email}
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
                              {customer.zipcode ? ` ${customer.zipcode}` : ''}
                              {!customer.city && !customer.zipcode ? 'Not provided' : ''}
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
