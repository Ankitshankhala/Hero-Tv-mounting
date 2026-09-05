import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  Phone,
  Clock,
  Navigation,
} from 'lucide-react';
import { formatBookingTimeForContext, convertUTCToLocal } from '@/utils/timeUtils';
import { getJobAddress } from '@/utils/jobAddress';
import { calculateWorkerEarnings, formatCurrency } from '@/utils/workerEarningsCalculator';

interface CompactJobCardProps {
  job: any;
  isExpanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  onDirections: () => void;
  onJobUpdated?: () => void;
}

export const CompactJobCard = ({
  job,
  isExpanded,
  onToggle,
  onCall,
  onDirections,
}: CompactJobCardProps) => {
  const [timeToStart, setTimeToStart] = useState<string | null>(null);
  const [isToday, setIsToday] = useState(false);

  const isArchived = !!job.is_archived;

  // ---------- date/time helpers ----------
  const formatCompactDateTime = (booking: any) => {
    try {
      return formatBookingTimeForContext(booking, 'worker', 'America/Chicago');
    } catch {
      return 'Invalid date';
    }
  };

  const getJobStartTime = (j: any) => {
    if (j.preferred_start_time) return new Date(j.preferred_start_time);
    if (j.start_time) return new Date(j.start_time);
    if (j.preferred_date && j.preferred_time) {
      const tz = j.service?.timezone || 'America/Chicago';
      try {
        const l = convertUTCToLocal(
          new Date(`${j.preferred_date}T${j.preferred_time}`),
          tz
        );
        return new Date(`${l.date}T${l.time}`);
      } catch {
        return new Date(`${j.preferred_date}T${j.preferred_time}`);
      }
    }
    return null;
  };

  useEffect(() => {
    const calc = () => {
      const startTime = getJobStartTime(job);
      if (!startTime) {
        setTimeToStart(null);
        setIsToday(false);
        return;
      }
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const jobIsToday =
        startTime >= today && startTime < new Date(today.getTime() + 86400000);
      setIsToday(jobIsToday);
      if (!jobIsToday) {
        setTimeToStart(null);
        return;
      }
      const mins = Math.floor((startTime.getTime() - now.getTime()) / 60000);
      if (mins < 0) setTimeToStart('Started');
      else if (mins < 60) setTimeToStart(`${mins}m`);
      else {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setTimeToStart(m > 0 ? `${h}h ${m}m` : `${h}h`);
      }
    };
    calc();
    const i = setInterval(calc, 60000);
    return () => clearInterval(i);
  }, [job]);

  const getCountdownBadgeStyle = () => {
    const startTime = getJobStartTime(job);
    if (!startTime || !isToday) return '';
    const mins = Math.floor((startTime.getTime() - Date.now()) / 60000);
    if (mins < 0) return 'bg-status-progress text-white border-status-progress';
    if (mins <= 30) return 'bg-status-cancelled text-white border-status-cancelled';
    if (mins <= 120) return 'bg-action-warning text-white border-action-warning';
    return 'bg-action-info text-white border-action-info';
  };

  // ---------- display helpers ----------
  const getServiceSummary = () => {
    if (job.booking_services && job.booking_services.length > 0) {
      return job.booking_services
        .map((s: any) => `${s.service_name} × ${s.quantity}`)
        .join(', ');
    }
    return job.service?.name || 'Service';
  };

  const getCustomerName = () =>
    job.guest_customer_info?.name || job.customer?.name || 'Customer';

  const getShortAddress = () => {
    const notes: string = job.location_notes || '';
    const beforeNotes = notes.split(/notes\s*:/i)[0] || '';
    if (beforeNotes.includes('|')) {
      const segs = beforeNotes.split('|').map((s) => s.trim()).filter(Boolean);
      const street = segs[segs.length - 1];
      const zip = job.guest_customer_info?.zipcode || job.customer?.zipcode;
      if (street) return zip ? `${street} · ${zip}` : street;
    }
    return getJobAddress(job, { singleLine: true }) || 'Address not available';
  };

  const getCustomerPhone = () =>
    job.guest_customer_info?.phone || job.customer?.phone || '';

  const getStatusColor = (status: string) => {
    if (isArchived) return 'bg-status-completed text-white border-status-completed';
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'scheduled':
        return 'bg-status-confirmed text-white border-status-confirmed';
      case 'in_progress':
        return 'bg-status-progress text-white border-status-progress';
      case 'completed':
        return 'bg-status-completed text-white border-status-completed';
      case 'cancelled':
        return 'bg-status-cancelled text-white border-status-cancelled';
      default:
        return 'bg-status-pending text-white border-status-pending';
    }
  };

  // Left accent bar color mapped to --status-* tokens
  const getAccentStyle = (): React.CSSProperties => {
    const s = isArchived ? 'completed' : (job.status || 'pending').toLowerCase();
    let token = '--status-pending';
    if (s === 'confirmed' || s === 'scheduled') token = '--status-confirmed';
    else if (s === 'in_progress') token = '--status-progress';
    else if (s === 'completed') token = '--status-completed';
    else if (s === 'cancelled') token = '--status-cancelled';
    return { backgroundColor: `hsl(var(${token}))` };
  };

  const getDisplayStatus = (status: string) =>
    isArchived ? 'COMPLETED' : (status || '').replace('_', ' ').toUpperCase();

  const getPaymentDisplay = (paymentStatus: string) => {
    if (isArchived) {
      return {
        text: 'PAID',
        color: 'bg-action-success text-white border-action-success',
      };
    }
    switch (paymentStatus?.toLowerCase()) {
      case 'authorized':
        return {
          text: 'AUTHORIZED',
          color: 'bg-action-warning text-white border-action-warning',
        };
      case 'captured':
      case 'completed':
        return {
          text: 'CAPTURED',
          color: 'bg-action-success text-white border-action-success',
        };
      case 'pending':
        return {
          text: 'PENDING',
          color: 'bg-action-info text-white border-action-info',
        };
      case 'failed':
      case 'cancelled':
        return {
          text: 'FAILED',
          color: 'bg-destructive text-white border-destructive',
        };
      default:
        return {
          text: paymentStatus?.toUpperCase() || 'UNKNOWN',
          color: 'bg-muted text-muted-foreground border-border',
        };
    }
  };

  const getTipBadge = () => {
    const tip = job.tip_amount;
    if (!tip || tip <= 0) return null;
    return {
      text: `Tip $${tip.toFixed(2)}`,
      color: 'bg-muted text-foreground border-border',
    };
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const payment = getPaymentDisplay(job.payment_status);
  const tipBadge = getTipBadge();
  const phone = getCustomerPhone();

  const earnings =
    job.booking_services && job.booking_services.length > 0
      ? calculateWorkerEarnings(job.booking_services, job.tip_amount || 0)
      : null;

  return (
    <Card
      onClick={onToggle}
      className={`
        relative overflow-hidden cursor-pointer transition-all duration-200
        hover:shadow-md bg-card border border-border
        ${isExpanded ? 'shadow-lg ring-1 ring-primary/30' : 'shadow-sm'}
        ${isArchived ? 'opacity-80' : ''}
      `}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={getAccentStyle()}
        aria-hidden="true"
      />

      <CardContent className="p-3 pl-4">
        <div className="flex items-center gap-3">
          {/* Main info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {getCustomerName()}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge
                variant="outline"
                className={`text-[11px] leading-none py-0.5 px-1.5 font-medium ${getStatusColor(job.status)}`}
              >
                {getDisplayStatus(job.status)}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[11px] leading-none py-0.5 px-1.5 font-medium ${payment.color}`}
              >
                {payment.text}
              </Badge>
              {tipBadge && (
                <Badge
                  variant="outline"
                  className={`text-[11px] leading-none py-0.5 px-1.5 font-medium ${tipBadge.color}`}
                >
                  {tipBadge.text}
                </Badge>
              )}
              {earnings && (
                <Badge
                  variant="outline"
                  className="text-[11px] leading-none py-0.5 px-1.5 font-medium bg-action-success text-white border-action-success"
                >
                  Earn {formatCurrency(earnings.totalEarnings)}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground truncate">
              <span className="hidden sm:inline">{getServiceSummary()} · </span>
              <span>{getShortAddress()}</span>
            </div>
          </div>

          {/* Time + countdown */}
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="text-xs font-medium text-foreground whitespace-nowrap">
              {formatCompactDateTime(job)}
            </span>
            {timeToStart && isToday && !isArchived && (
              <Badge
                variant="outline"
                className={`mt-1 text-[10px] font-medium flex items-center gap-1 ${getCountdownBadgeStyle()}`}
              >
                <Clock className="h-3 w-3" />
                {timeToStart === 'Started' ? 'Started' : `in ${timeToStart}`}
              </Badge>
            )}
          </div>

          {/* Icon actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={stop}>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                stop(e);
                onDirections();
              }}
              className="h-11 w-11 sm:h-9 sm:w-9"
              aria-label="Get directions"
            >
              <Navigation className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                stop(e);
                onCall();
              }}
              disabled={!phone}
              className="h-11 w-11 sm:h-9 sm:w-9"
              aria-label="Call customer"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                stop(e);
                onToggle();
              }}
              className="h-11 w-11 sm:h-9 sm:w-9"
              aria-label={isExpanded ? 'Collapse job details' : 'Expand job details'}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </Button>
          </div>
        </div>

        {/* Mobile time row */}
        <div className="sm:hidden mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">{formatCompactDateTime(job)}</span>
          {timeToStart && isToday && !isArchived && (
            <Badge
              variant="outline"
              className={`text-[10px] font-medium flex items-center gap-1 ${getCountdownBadgeStyle()}`}
            >
              <Clock className="h-3 w-3" />
              {timeToStart === 'Started' ? 'Started' : `in ${timeToStart}`}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
