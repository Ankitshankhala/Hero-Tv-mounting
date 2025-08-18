
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Settings, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import ChangePasswordModal from './ChangePasswordModal';

interface WorkerDashboardHeaderProps {
  workerName: string;
}

const WorkerDashboardHeader = ({ workerName }: WorkerDashboardHeaderProps) => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <header className="bg-slate-800/50 border-b border-slate-700 overflow-x-clip">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center justify-between sm:justify-start">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Link to="/" className="shrink-0">
                <Button variant="ghost" className="text-white hover:text-blue-400 p-2 sm:px-4">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden xs:inline ml-2">Back to Home</span>
                </Button>
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-white truncate">Worker Dashboard</h1>
                <p className="text-slate-300 text-sm truncate">{workerName}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:hidden">
              <div className="text-right">
                <p className="text-slate-400 text-xs">Today's Date</p>
                <p className="text-white font-medium text-sm">{new Date().toLocaleDateString()}</p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white hover:text-blue-400" size="sm">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                    <Key className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <Settings className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-slate-400">Today's Date</p>
              <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-blue-400" size="sm">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <Settings className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </header>
  );
};

export default WorkerDashboardHeader;
