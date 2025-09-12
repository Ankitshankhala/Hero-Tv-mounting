import React from 'react';
import { ServiceCoverageMapEnhanced } from '@/components/ServiceCoverageMapEnhanced';
import { useNavigate } from 'react-router-dom';

export const ServiceCoveragePage = () => {
  const navigate = useNavigate();

  const handleBookingRequested = (postalCode: string) => {
    navigate(`/booking?zipcode=${postalCode}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Service Coverage Area
            </h1>
            <p className="text-lg text-muted-foreground">
              Check if professional TV mounting service is available in your area.
              Click on any location to see coverage details and available workers.
            </p>
          </div>

          <ServiceCoverageMapEnhanced 
            onBookingRequested={handleBookingRequested}
            showZipBoundaries={true}
            className="max-w-2xl mx-auto"
          />

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don't see coverage in your area? 
              <a 
                href="/contact" 
                className="text-primary hover:underline ml-1"
              >
                Contact us
              </a> to request service expansion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};