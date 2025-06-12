
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench } from 'lucide-react';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import {I'll update the worker onboarding flow to fix the popup message and email verification content. Let me make the necessary changes.

<lov-code>
I'll update the following components to improve the worker onboarding flow:

1. First, let's modify the `AddWorkerModal.tsx` component to show the correct confirmation message:

<lov-write file_path="src/components/admin/AddWorkerModal.tsx">
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkerForm } from '@/hooks/useWorkerForm';
import { WorkerPersonalInfoForm } from './WorkerPersonalInfoForm';
import { WorkerLocationForm } from './WorkerLocationForm';
import { WorkerAvailabilityForm } from './WorkerAvailabilityForm';
import { WorkerSkillsForm } from './WorkerSkillsForm';

interface AddWorkerModalProps {
  onClose: () => void;
  onWorkerAdded?: () => void;
}

export const AddWorkerModal = ({ onClose, onWorkerAdded }: AddWorkerModalProps) => {
  const { formData, handleInputChange, handleAvailabilityChange } = useWorkerForm();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);
    
    // Only block obviously fake domains
    const fakeDomains = ['example.com', 'test.com', 'fake.com', 'invalid.com'];
    const hasFakeDomain = fakeDomains.some(domain => email.toLowerCase().endsWith('@' + domain));
    
    return isValidFormat && !hasFakeDomain;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email format
      if (!validateEmail(formData.email)) {
        throw new Error('Please use a valid email address with a real domain');
      }

      console.log('Creating worker with data:', {
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        city: formData.city,
        region: formData.region,
        zipcode: formData.zipcode
      });

      // Create auth user first with custom email template
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'worker',
            name: formData.name
          },
          emailRedirectTo: `${window.location.origin}/`,
          // This will use the custom email template for worker verification
          emailOptions: {
            subject: "Verify your email - Hero TV Mounting",
            data: {
              custom_message: "You are being added as a Technician at Hero TV Mounting. Please verify your email to get started."
            }
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (authData?.user) {
        console.log('Auth user created:', authData.user.id);

        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            city: formData.city,
            region: formData.region,
            zipcode: formData.zipcode,
            role: 'worker',
          });

        if (profileError) {
          console.error('Profile error:', profileError);
          throw profileError;
        }

        console.log('User profile created successfully');

        // Add worker availability
        const availabilityEntries = Object.entries(formData.availability)
          .filter(([_, isAvailable]) => isAvailable)
          .map(([day, _]) => ({
            worker_id: authData.user.id,
            day_of_week: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day),
            start_time: '09:00:00',
            end_time: '17:00:00',
          }));

        if (availabilityEntries.length > 0) {
          const { error: availabilityError } = await supabase
            .from('worker_availability')
            .insert(availabilityEntries);

          if (availabilityError) {
            console.error('Availability error:', availabilityError);
            throw availabilityError;
          }

          console.log('Worker availability added successfully');
        }

        toast({
          title: "Success",
          description: "Check your email for verification.",
          variant: "default",
        });

        onWorkerAdded?.();
        onClose();
      }
    } catch (error: any) {
      console.error('Error creating worker:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create worker account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Add New Worker</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              <strong>Note:</strong> Please use a real email address. Try using Gmail, Yahoo, or your company domain instead of test domains.
            </div>

            <WorkerPersonalInfoForm
              formData={formData}
              onInputChange={handleInputChange}
            />

            <WorkerLocationForm
              formData={formData}
              onInputChange={handleInputChange}
            />

            <WorkerSkillsForm
              formData={formData}
              onInputChange={handleInputChange}
            />

            <WorkerAvailabilityForm
              formData={formData}
              onAvailabilityChange={handleAvailabilityChange}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Worker'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
