import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

interface SmsConsentTextProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export const SmsConsentText = ({ variant = 'dark', className = '' }: SmsConsentTextProps) => {
  const textColor = variant === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const linkColor = variant === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700';

  return (
    <p className={`text-xs ${textColor} mt-2 flex items-start gap-1.5 ${className}`}>
      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
      <span>
        By providing your phone number, you agree to receive SMS notifications regarding your bookings, 
        technician updates, and service reminders. Reply STOP to unsubscribe.{' '}
        <Link to="/privacy-policy" className={`underline ${linkColor}`}>
          Privacy Policy
        </Link>
      </span>
    </p>
  );
};
