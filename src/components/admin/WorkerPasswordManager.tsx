import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Eye, EyeOff, Key, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WorkerPasswordManagerProps {
  workerId: string;
  workerEmail: string;
  workerName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkerPasswordManager: React.FC<WorkerPasswordManagerProps> = ({
  workerId,
  workerEmail,
  workerName,
  isOpen,
  onClose,
}) => {
  const [customPassword, setCustomPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

  const generateTemporaryPassword = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('manage-worker-password', {
        body: { 
          workerId, 
          action: 'generate' 
        }
      });

      if (error) {
        throw error;
      }

      if (data.temporaryPassword) {
        setGeneratedPassword(data.temporaryPassword);
        toast({
          title: "Success",
          description: "Temporary password generated successfully",
        });
      }
    } catch (error: any) {
      console.error('Error generating password:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setCustomPasswordHandler = async () => {
    if (!customPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive",
      });
      return;
    }

    if (customPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('manage-worker-password', {
        body: { 
          workerId, 
          action: 'set',
          newPassword: customPassword
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Password set successfully",
      });
      
      setCustomPassword('');
    } catch (error: any) {
      console.error('Error setting password:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to set password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCustomPassword('');
    setGeneratedPassword('');
    setShowCustomPassword(false);
    setShowGeneratedPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Manage Worker Password
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">{workerName}</p>
            <p className="text-sm text-muted-foreground">{workerEmail}</p>
          </div>

          {/* Generate Temporary Password */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generate Temporary Password</Label>
            <div className="flex gap-2">
              <Button
                onClick={generateTemporaryPassword}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Generate
              </Button>
              {generatedPassword && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type={showGeneratedPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                  >
                    {showGeneratedPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(generatedPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Set Custom Password */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Set Custom Password</Label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type={showCustomPassword ? 'text' : 'password'}
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCustomPassword(!showCustomPassword)}
                >
                  {showCustomPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                onClick={setCustomPasswordHandler}
                disabled={loading || !customPassword.trim()}
                className="flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                Set
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};