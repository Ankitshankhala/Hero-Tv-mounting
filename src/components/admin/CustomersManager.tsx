
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
  email: string;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(25);
  const { toast } = useToast();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [debouncedSearch, page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      // Use optimized database function with pagination
      const { data, error } = await supabase.rpc('get_customer_stats', {
        search_term: debouncedSearch || null,
        limit_count: pageSize,
        offset_count: page * pageSize
      });

      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setCustomers([]);
        setTotalCount(0);
        return;
      }

      // Transform database response to component format
      const enrichedCustomers: Customer[] = data.map((row: any) => ({
        email: row.email,
        name: row.name || 'Unknown',
        phone: row.phone,
        city: row.city,
        zipcode: row.zipcode,
        totalBookings: Number(row.total_bookings || 0),
        totalSpent: `$${Number(row.total_spent || 0).toFixed(2)}`,
        lastBooking: row.last_booking ? new Date(row.last_booking).toLocaleDateString() : 'No bookings'
      }));

      setCustomers(enrichedCustomers);
      setTotalCount(data[0]?.total_count || 0);
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

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
  };

  const handleCloseHistoryModal = () => {
    setSelectedCustomer(null);
    setShowHistoryModal(false);
  };

  const LoadingSkeleton = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Customer Management</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="h-10 bg-muted animate-pulse rounded-md max-w-md"></div>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md"></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (loading && customers.length === 0) {
    return <LoadingSkeleton />;
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

            {customers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No customers found matching your search.' : 'No customers found.'}
                </p>
              </div>
            ) : (
              <>
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
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <TableRow key={i}>
                            {[...Array(8)].map((_, j) => (
                              <TableCell key={j}>
                                <div className="h-4 bg-muted animate-pulse rounded"></div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        customers.map((customer) => (
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
                      ))
                    )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} customers
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1 || loading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
