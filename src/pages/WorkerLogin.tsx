import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import WorkerLoginForm from '@/components/worker/WorkerLoginForm';
import { ArrowLeft } from 'lucide-react';
import { SEO } from '@/components/SEO';


const WorkerLogin = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Redirect authenticated workers to dashboard
  useEffect(() => {
    if (user && profile?.role === 'worker') {
      navigate('/worker-dashboard');
    }
  }, [user, profile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <SEO title="Worker Login | Hero TV Mounting" description="Sign in to manage your jobs and schedule." noindex />
      {/* Back to Home Button */}
      <div className="absolute top-4 left-4">
        <Link 
          to="/"
          className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <WorkerLoginForm />
    </div>
  );
};

export default WorkerLogin;