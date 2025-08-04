
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddWorkerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface WorkerCreationResult {
  email: string;
  temporaryPassword: string;
}

export const AddWorkerModal = ({ onClose, onSuccess }: AddWorkerModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    zipCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [workerCreationResult, setWorkerCreationResult] = useState<WorkerCreationResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  // Generate a secure temporary password
  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate temporary password
      const temporaryPassword = generateTemporaryPassword();

      // Create auth user with temporary password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: temporaryPassword,
        email_confirm: true
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw authError;
      }

      // Create user profile
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          city: formData.city,
          zip_code: formData.zipCode,
          role: 'worker',
          is_active: true,
        });

      if (userError) {
        console.error('Error creating user profile:', userError);
        throw userError;
      }

      // Show success and temporary password
      setWorkerCreationResult({
        email: formData.email,
        temporaryPassword: temporaryPassword
      });
      setShowPasswordModal(true);

      toast({
        title: "Success",
        description: "Technician has been added successfully",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error adding worker:', error);
      
      let errorMessage = "Failed to add technician";
      if (error?.message?.includes('duplicate key')) {
        errorMessage = "A user with this email already exists";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setWorkerCreationResult(null);
    setShowPassword(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Add New Technician</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                required
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Technician'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Temporary Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Technician Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-3">
                Technician account has been successfully created for:
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Email:</label>
                  <p className="font-medium">{workerCreationResult?.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Temporary Password:</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 p-2 bg-gray-100 rounded border font-mono text-sm">
                      {showPassword ? workerCreationResult?.temporaryPassword : '••••••••••••'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(workerCreationResult?.temporaryPassword || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Share these credentials with the technician securely. 
                They should change their password on first login.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClosePasswordModal}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
