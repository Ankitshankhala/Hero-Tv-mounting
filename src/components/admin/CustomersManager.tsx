import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Phone, MapPin } from 'lucide-react';
import { CustomerHistoryModal } from './CustomerHistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { Toolbar } from '@/components/admin/ui/Toolbar';
import { DataTable, type Column } from '@/components/admin/ui/DataTable';
import { EmptyState } from '@/components/admin/ui/EmptyState';

interface Customer {
  email: string;
  name: string;
  phone?: string;
  city?: string;
  zipcode?: string;
  totalBookings: number;
  totalSpent: string;
  totalSpentNum: number;
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [debouncedSearch, page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_customer_stats', {
        search_term: debouncedSearch || null,
        limit_count: pageSize,
        offset_count: page * pageSize,
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

      const enrichedCustomers: Customer[] = data.map((row: any) => {
        const spent = Number(row.total_spent || 0);
        return {
          email: row.email,
          name: row.name || 'Unknown',
          phone: row.phone,
          city: row.city,
          zipcode: row.zipcode,
          totalBookings: Number(row.total_bookings || 0),
          totalSpent: `$${spent.toFixed(2)}`,
          totalSpentNum: spent,
          lastBooking: row.last_booking ? new Date(row.last_booking).toLocaleDateString() : 'No bookings',
        };
      });

      setCustomers(enrichedCustomers);
      setTotalCount(data[0]?.total_count || 0);
    } catch (error) {
      console.error('Error in fetchCustomers:', error);
      toast({ title: 'Error', description: 'Failed to load customers', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleViewHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      accessor: (c) => <span className="font-medium">{c.name}</span>,
      sortable: true,
      sortValue: (c) => c.name.toLowerCase(),
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (c) => <span className="text-muted-foreground">{c.email}</span>,
      sortable: true,
      sortValue: (c) => c.email.toLowerCase(),
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (c) => c.phone ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {c.phone}
        </span>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'location',
      header: 'Location',
      accessor: (c) => {
        const loc = [c.city, c.zipcode].filter(Boolean).join(' ');
        return loc ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            {loc}
          </span>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: 'bookings',
      header: 'Bookings',
      accessor: (c) => c.totalBookings,
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalBookings,
    },
    {
      key: 'spent',
      header: 'Total Spent',
      accessor: (c) => c.totalSpent,
      numeric: true,
      sortable: true,
      sortValue: (c) => c.totalSpentNum,
    },
    {
      key: 'last',
      header: 'Last Booking',
      accessor: (c) => c.lastBooking,
    },
    {
      key: 'actions',
      header: '',
      accessor: (c) => (
        <div className="text-right">
          <Button variant="outline" size="sm" onClick={() => handleViewHistory(c)}>
            View History
          </Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle="Search and review customer activity" />

      <Toolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search customers by name, email, or phone..."
      />

      <Card className="p-0 border-border shadow-sm overflow-hidden">
        <div className="p-4">
          <DataTable
            data={customers}
            columns={columns}
            rowKey={(c) => c.email}
            loading={loading}
            pageSize={pageSize}
            hideFooter
            empty={
              <EmptyState
                icon={Users}
                title={searchTerm ? 'No customers found' : 'No customers yet'}
                description={searchTerm ? 'Try a different search term.' : 'Customers will appear here after their first booking.'}
              />
            }
          />

          {/* Server-side pagination footer */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
              </span>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <CustomerHistoryModal
        customer={selectedCustomer}
        isOpen={showHistoryModal}
        onClose={() => {
          setSelectedCustomer(null);
          setShowHistoryModal(false);
        }}
      />
    </>
  );
};
