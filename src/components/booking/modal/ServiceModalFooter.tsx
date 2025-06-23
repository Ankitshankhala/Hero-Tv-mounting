
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

interface ServiceModalFooterProps {
  serviceName: string;
  quantity: number;
  selectedOptions: ServiceOption[];
  totalPrice: number;
  onCancel: () => void;
  onComplete: () => void;
}

export const ServiceModalFooter = ({
  serviceName,
  quantity,
  selectedOptions,
  totalPrice,
  onCancel,
  onComplete
}: ServiceModalFooterProps) => {
  return (
    <div className="border-t pt-6 space-y-4">
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-lg text-gray-900">Total Price</h4>
              <p className="text-sm text-gray-600">
                {quantity} × {serviceName} {selectedOptions.length > 0 && `+ ${selectedOptions.length} options`}
              </p>
            </div>
            <div className="text-right">
              <div className="font-bold text-3xl text-green-600">${totalPrice}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
        <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button 
          onClick={onComplete}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          Add to Booking - ${totalPrice}
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2">
          <Shield className="h-4 w-4 text-green-600" />
          <span className="text-sm text-gray-700">Professional installation guaranteed</span>
        </div>
      </div>
    </div>
  );
};
