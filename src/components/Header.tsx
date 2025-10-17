
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, LogOut, Briefcase, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export const Header = () => {
  const { user, signOut, profile } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="relative bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <div className="relative container mx-auto px-4 py-12">
        <div className="absolute top-4 right-4 flex space-x-2">
          {user ? (
            <div className="flex items-center space-x-2">
              {profile?.role === 'customer' && (
                <Link to="/customer-dashboard">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 bg-slate-800 text-white border-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
              )}
              {profile?.role === 'worker' && (
                <Link to="/worker-dashboard">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 bg-slate-800 text-white border-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
              )}
              {profile?.role === 'admin' && (
                <Link to="/admin">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 bg-slate-800 text-white border-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </Button>
                </Link>
              )}
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 bg-slate-800 text-white border-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          ) : null}
        </div>
        
        <div className="flex items-center justify-center mb-8">
          <img 
            src="/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png" 
            alt="Hero TV Mounting Logo" 
            className="h-16 w-16 mr-4"
          />
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent leading-tight pb-2">
            Hero TV Mounting
          </h1>
        </div>
        
        <div className="text-center">
          <a 
            href="tel:+15752088997"
            className="text-2xl md:text-3xl text-blue-400 hover:text-blue-300 transition-colors duration-200 font-semibold"
          >
            575-208-8997
          </a>
        </div>
      </div>
    </header>
  );
};
