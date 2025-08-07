import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Mail, User, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailVerification {
  booking_id: string;
  success: boolean;
  email_address: string | null;
  customer_name: string | null;
  customer_type: 'registered' | 'guest' | null;
  service_name: string | null;
  scheduled_date: string | null;
  booking_status: string | null;
  error: string | null;
}

interface InvoiceEmailVerifierProps {
  bookingIds: string[];
  onVerificationComplete?: (verifications: EmailVerification[]) => void;
}

export function InvoiceEmailVerifier({ bookingIds, onVerificationComplete }: InvoiceEmailVerifierProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifications, setVerifications] = useState<EmailVerification[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const verifyEmails = async () => {
    if (bookingIds.length === 0) {
      toast({
        title: "No bookings selected",
        description: "Please provide booking IDs to verify email addresses.",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    try {
      console.log('Verifying emails for bookings:', bookingIds);
      
      const { data, error } = await supabase.functions.invoke('verify-invoice-emails', {
        body: { booking_ids: bookingIds }
      });

      if (error) {
        throw error;
      }

      setVerifications(data.verifications);
      setShowDetails(true);
      onVerificationComplete?.(data.verifications);

      const validEmails = data.verifications.filter((v: EmailVerification) => v.success);
      const invalidEmails = data.verifications.filter((v: EmailVerification) => !v.success);

      toast({
        title: "Email verification complete",
        description: `${validEmails.length} valid email(s), ${invalidEmails.length} invalid`,
        variant: validEmails.length === bookingIds.length ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Failed to verify emails:', error);
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify email addresses",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (verification: EmailVerification) => {
    if (verification.success) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Valid Email</Badge>;
    } else {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />No Email</Badge>;
    }
  };

  const getCustomerTypeBadge = (type: string | null) => {
    if (type === 'registered') {
      return <Badge variant="outline"><User className="w-3 h-3 mr-1" />Registered</Badge>;
    } else if (type === 'guest') {
      return <Badge variant="secondary"><User className="w-3 h-3 mr-1" />Guest</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Address Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={verifyEmails} 
                disabled={isVerifying || bookingIds.length === 0}
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {isVerifying ? 'Verifying...' : `Verify ${bookingIds.length} Email(s)`}
              </Button>
              
              {verifications.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              )}
            </div>

            {verifications.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {verifications.filter(v => v.success).length}
                    </div>
                    <div className="text-sm text-green-600">Valid Emails</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-red-50">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {verifications.filter(v => !v.success).length}
                    </div>
                    <div className="text-sm text-red-600">Invalid/Missing</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {verifications.length}
                    </div>
                    <div className="text-sm text-blue-600">Total Bookings</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {showDetails && verifications.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold">Email Verification Details:</h4>
                {verifications.map((verification) => (
                  <Card key={verification.booking_id} className="border-l-4 border-l-gray-200">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm text-gray-600">
                            Booking: {verification.booking_id.slice(0, 8)}...
                          </div>
                          {getStatusBadge(verification)}
                        </div>
                        
                        {verification.success ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-green-600">
                                {verification.email_address}
                              </span>
                              {getCustomerTypeBadge(verification.customer_type)}
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              Customer: {verification.customer_name}
                            </div>
                            
                            {verification.service_name && (
                              <div className="text-sm text-gray-600">
                                Service: {verification.service_name}
                              </div>
                            )}
                            
                            {verification.scheduled_date && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Calendar className="w-3 h-3" />
                                {new Date(verification.scheduled_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-red-600 text-sm">
                            ⚠️ {verification.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InvoiceEmailVerifier;