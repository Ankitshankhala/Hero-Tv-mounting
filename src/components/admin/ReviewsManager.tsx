import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Image as ImageIcon, Edit, Trash2, Eye, Plus, Check, X } from 'lucide-react';
import { ReviewModal, type AdminReview } from './ReviewModal';
import { CreateReviewModal, type NewReviewInput } from './CreateReviewModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ReviewsManager = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load reviews', description: error.message, variant: 'destructive' });
    } else {
      setReviews((data as AdminReview[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleView = (r: AdminReview) => { setSelectedReview(r); setShowModal(true); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review permanently?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Review deleted' });
    load();
  };

  const setStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    const patch: any = { status };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from('reviews').update(patch).eq('id', id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    toast({ title: `Review ${status}` });
    load();
  };

  const handleSaveFromModal = async (updated: AdminReview) => {
    const patch: any = {
      status: updated.status,
      title: updated.title,
      comment: updated.comment,
      rating: updated.rating,
      is_featured: updated.is_featured,
    };
    if (updated.status === 'approved') patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from('reviews').update(patch).eq('id', updated.id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Review updated' });
    setShowModal(false);
    load();
  };

  const handleCreate = async (input: NewReviewInput) => {
    const { error } = await supabase.from('reviews').insert({
      customer_name: input.customer_name,
      city: input.city || null,
      rating: input.rating,
      title: input.title || null,
      comment: input.comment,
      image_url: input.image_url || null,
      status: input.status,
      is_featured: input.is_featured,
      approved_at: input.status === 'approved' ? new Date().toISOString() : null,
    });
    if (error) return toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Review created' });
    setShowCreateModal(false);
    load();
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return reviews.filter((r) => {
      const matchesSearch =
        !term ||
        r.customer_name?.toLowerCase().includes(term) ||
        r.title?.toLowerCase().includes(term) ||
        r.comment?.toLowerCase().includes(term);
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [reviews, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const approved = reviews.filter((r) => r.status === 'approved');
    const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
    return {
      avg: avg.toFixed(1),
      total: reviews.length,
      pending: reviews.filter((r) => r.status === 'pending').length,
      withImages: reviews.filter((r) => !!r.image_url).length,
    };
  }, [reviews]);

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      approved: { label: 'Approved', variant: 'default' },
      pending: { label: 'Pending', variant: 'secondary' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };
    const c = cfg[status] || cfg.pending;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
      ))}
      <span className="text-sm font-medium ml-1">{rating}/5</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6">
          <div className="flex items-center space-x-2"><Star className="h-4 w-4 text-yellow-500" /><span className="text-sm text-gray-600">Average Rating</span></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.avg}</div>
          <div className="text-xs text-gray-500">Across approved reviews</div>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <div className="text-sm text-gray-600">Total Reviews</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <div className="text-sm text-gray-600">Pending Approval</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.pending}</div>
          <div className="text-xs text-orange-600">{stats.pending > 0 ? 'Needs attention' : 'All clear'}</div>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <div className="flex items-center space-x-2"><ImageIcon className="h-4 w-4 text-blue-600" /><span className="text-sm text-gray-600">With Images</span></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.withImages}</div>
          <div className="text-xs text-gray-500">{stats.total ? `${Math.round((stats.withImages / stats.total) * 100)}% of reviews` : '—'}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2"><Star className="h-5 w-5" /><span>Reviews Management</span></CardTitle>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />Add New Review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input placeholder="Search reviews..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No reviews found</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.customer_name}</div>
                      {r.city && <div className="text-xs text-gray-500">{r.city}</div>}
                    </TableCell>
                    <TableCell>{renderStars(r.rating)}</TableCell>
                    <TableCell className="font-medium">{r.title || '—'}</TableCell>
                    <TableCell className="max-w-xs"><p className="text-sm truncate">{r.comment}</p></TableCell>
                    <TableCell>{r.image_url ? <ImageIcon className="h-4 w-4 text-blue-600" /> : <span className="text-sm text-gray-400">—</span>}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" onClick={() => handleView(r)} title="View / Edit"><Eye className="h-4 w-4" /></Button>
                        {r.status !== 'approved' && (
                          <Button variant="outline" size="sm" onClick={() => setStatus(r.id, 'approved')} title="Approve"><Check className="h-4 w-4 text-green-600" /></Button>
                        )}
                        {r.status !== 'rejected' && (
                          <Button variant="outline" size="sm" onClick={() => setStatus(r.id, 'rejected')} title="Reject"><X className="h-4 w-4 text-red-600" /></Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleDelete(r.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReviewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveFromModal}
        review={selectedReview}
      />

      <CreateReviewModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};
