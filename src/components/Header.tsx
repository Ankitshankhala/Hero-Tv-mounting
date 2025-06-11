
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from './auth/AuthModal';

const Header = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDashboardClick = () => {
    if (profile?.role === 'admin') {
      navigate('/admin');
    } else if (profile?.role === 'worker') {
      navigate('/worker');
    } else {
      navigate('/customer');
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            HandyConnect
          </Link>
          
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-blue-600">
              Home
            </Link>
            <Link to="/book" className="text-gray-600 hover:text-blue-600">
              Book Service
            </Link>
            <Link to="/worker-application" className="text-gray-600 hover:text-blue-600">
              Join as Worker
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleDashboardClick}
                >
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setShowAuthModal(true)}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal} 
      />
    </>
  );
};

export default Header;
