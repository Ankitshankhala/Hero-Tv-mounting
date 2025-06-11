
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, MapPin } from 'lucide-react';
import { useModificationApproval } from '@/hooks/useModificationApproval';
import { ModificationApprovalModal } from './ModificationApprovalModal';
import { formatDistanceToNow } from 'date-fns';

export const PendingModifications = () => {
  const { pendingModifications, loading, refetch } = useModificationApproval();
  const [selectedModification, setSelectedModification] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const handleViewModification = (modification: any) => {
    setSelectedModification(modification);
    setShowApprovalModal(true);
  };

  const handleApprovalComplete = () => {
    refetch();
    setSelectedModification(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Pending Invoice Approvals</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Loading pending modifications...</p>
        </CardContent>
      </Card>
    );
  }

  if (pendingModifications.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>Pending Invoice Approvals</span>
            <Badge variant="destructive">{pendingModifications.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingModifications.map((modification: any) => {
            const priceDifference = modification.modified_total - modification.original_total;
            
            return (
              <Card key={modification.id} className="border-orange-100 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          Job #{modification.booking_id.slice(0, 8)}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {formatDistanceToNow(new Date(modification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(modification.booking.scheduled_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-xs">
                            {modification.booking.customer_address}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Price Change:</span>
                        <Badge 
                          variant={priceDifference >= 0 ? "destructive" : "outline"}
                          className={priceDifference < 0 ? "text-green-700 border-green-700" : ""}
                        >
                          {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
                        </Badge>
                      </div>

                      {modification.modification_reason && (
                        <p className="text-sm text-gray-700 italic">
                          "{modification.modification_reason}"
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={() => handleViewModification(modification)}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      Review Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      <ModificationApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        modification={selectedModification}
        onApprovalComplete={handleApprovalComplete}
      />
    </>
  );
};
