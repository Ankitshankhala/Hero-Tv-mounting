
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createTestBooking } from '@/utils/createTestBooking';

const TestBookingCreator = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateTestBooking = async () => {
    setLoading(true);
    try {
      await createTestBooking();
      toast({
        title: "Success",
        description: "Test booking created and assigned to worker",
      });
      // Refresh the page to see the new booking
      window.location.reload();
    } catch (error) {
      console.error('Error creating test booking:', error);
      toast({
        title: "Error",
        description: "Failed to create test booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 mb-6">
      <CardHeader>
        <CardTitle className="text-white">Testing Tools</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300 mb-4">
          Create a test booking to verify dashboard functionality
        </p>
        <Button 
          onClick={handleCreateTestBooking}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Creating...' : 'Create Test Booking'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TestBookingCreator;
