
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Service } from '@/hooks/useServicesData';

interface ServicesStatsProps {
  services: Service[];
}

export const ServicesStats: React.FC<ServicesStatsProps> = ({ services }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-0">
      <CardHeader>
        <CardTitle className="text-lg text-purple-900">Service Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <h4 className="font-bold text-2xl text-blue-600">{services.length}</h4>
            <p className="text-gray-600">Total Services</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <h4 className="font-bold text-2xl text-green-600">
              {formatPrice(services.reduce((avg, service) => avg + service.base_price, 0) / services.length || 0)}
            </h4>
            <p className="text-gray-600">Average Price</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <h4 className="font-bold text-2xl text-purple-600">
              {formatDuration(services.reduce((avg, service) => avg + service.duration_minutes, 0) / services.length || 0)}
            </h4>
            <p className="text-gray-600">Average Duration</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
