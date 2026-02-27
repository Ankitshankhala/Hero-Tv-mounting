import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tag, Plus, Search, Edit, Trash2, BarChart3, Eye } from 'lucide-react';
import { useCoupons, type Coupon, type CouponAnalytics } from '@/hooks/useCoupons';
import { CreateCouponModal } from './CreateCouponModal';
import { EditCouponModal } from './EditCouponModal';
import { CouponUsageModal } from './CouponUsageModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const CouponsManager = () => {
  const { coupons, loading, toggleCouponStatus, deleteCoupon, fetchCouponAnalytics } = useCoupons();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [analytics, setAnalytics] = useState<CouponAnalytics>({
    totalActiveCoupons: 0,
    totalRedemptionsThisMonth: 0,
    totalDiscountGivenThisMonth: 0,
    mostUsedCoupon: 'N/A',
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const data = await fetchCouponAnalytics();
    setAnalytics(data);
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return coupon.is_active && new Date(coupon.valid_until) > new Date();
    if (statusFilter === 'inactive') return !coupon.is_active;
    if (statusFilter === 'expired') return new Date(coupon.valid_until) < new Date();
    
    return true;
  });

  const getStatusBadge = (coupon: Coupon) => {
    if (!coupon.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (new Date(coupon.valid_until) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const handleEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setShowEditModal(true);
  };

  const handleViewUsage = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setShowUsageModal(true);
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    await toggleCouponStatus(coupon.id, coupon.is_active);
    await loadAnalytics();
  };

  const handleDelete = async (coupon: Coupon) => {
    if (confirm(`Are you sure you want to deactivate coupon "${coupon.code}"?`)) {
      await deleteCoupon(coupon.id);
      await loadAnalytics();
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalActiveCoupons}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemptions (Month)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalRedemptionsThisMonth}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discount Given (Month)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.totalDiscountGivenThisMonth.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.mostUsedCoupon}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Coupon Management
            </CardTitle>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Coupon
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Coupons</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8">Loading coupons...</div>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No coupons found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-semibold">
                        {coupon.code}
                      </TableCell>
                      <TableCell className="capitalize">
                        {coupon.discount_type}
                      </TableCell>
                      <TableCell>
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}%`
                          : `$${coupon.discount_value}`}
                        {coupon.max_discount_amount && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (max ${coupon.max_discount_amount})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(coupon)}</TableCell>
                      <TableCell>
                        {coupon.usage_count}
                        {coupon.usage_limit_total && ` / ${coupon.usage_limit_total}`}
                      </TableCell>
                      <TableCell>
                        {new Date(coupon.valid_until).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUsage(coupon)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(coupon)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(coupon)}
                          >
                            {coupon.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(coupon)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateCouponModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadAnalytics}
      />

      {selectedCoupon && (
        <>
          <EditCouponModal
            open={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedCoupon(null);
            }}
            coupon={selectedCoupon}
            onSuccess={loadAnalytics}
          />

          <CouponUsageModal
            open={showUsageModal}
            onClose={() => {
              setShowUsageModal(false);
              setSelectedCoupon(null);
            }}
            couponId={selectedCoupon.id}
            couponCode={selectedCoupon.code}
          />
        </>
      )}
    </div>
  );
};
