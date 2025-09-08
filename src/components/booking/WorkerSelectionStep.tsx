import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Star, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface WorkerSelectionStepProps {
  zipcode: string;
  selectedDate?: Date;
  selectedWorkerId?: string;
  onWorkerSelect: (workerId: string | null) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export const WorkerSelectionStep = ({
  zipcode,
  selectedDate,
  selectedWorkerId,
  onWorkerSelect,
  onContinue,
  onSkip
}: WorkerSelectionStepProps) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (zipcode && selectedDate) {
      fetchAvailableWorkers();
    }
  }, [zipcode, selectedDate]);

  const fetchAvailableWorkers = async () => {
    if (!zipcode || !selectedDate) return;
    
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      // Get workers who have coverage in this ZIP code
      const { data: availableWorkers, error } = await supabase.rpc('find_available_workers_by_zip', {
        p_zipcode: zipcode,
        p_date: dateStr,
        p_time: '09:00:00', // Use a sample time to check general availability
        p_duration_minutes: 60
      });

      if (error) {
        console.error('Error fetching workers:', error);
        setWorkers([]);
        return;
      }

      // Transform the data to our expected format
      const workersData = availableWorkers?.map((worker: any) => ({
        id: worker.worker_id,
        name: worker.worker_name || worker.name || 'Worker',
        email: worker.worker_email || worker.email || '',
        phone: worker.worker_phone || worker.phone,
        city: worker.worker_city || worker.city
      })) || [];

      setWorkers(workersData);
    } catch (error) {
      console.error('Error in fetchAvailableWorkers:', error);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Choose Your Worker</h3>
          <p className="text-slate-300">Loading available workers in your area...</p>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Choose Your Worker</h3>
        <p className="text-slate-300">
          Select a preferred worker or skip to get automatically assigned
        </p>
        <div className="mt-2">
          <div className="inline-flex items-center space-x-2 text-sm bg-blue-900/30 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30">
            <Users className="h-4 w-4" />
            <span>{workers.length} workers available in ZIP {zipcode}</span>
          </div>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto text-slate-500 mb-4" />
          <h4 className="text-xl font-semibold text-white mb-2">No Workers Available</h4>
          <p className="text-slate-400 mb-6">
            We don't have workers in your area for the selected date.
          </p>
          <Button 
            onClick={onSkip}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Continue Anyway
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Auto-assign option */}
          <div className="border-2 border-slate-600/50 rounded-lg p-4 bg-slate-800/50 backdrop-blur-sm">
            <div 
              className={cn(
                "flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                !selectedWorkerId 
                  ? "border-purple-500 bg-purple-600/20" 
                  : "border-slate-600 hover:border-slate-500"
              )}
              onClick={() => onWorkerSelect(null)}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white">Auto-Assign Worker</h4>
                <p className="text-sm text-slate-400">
                  We'll assign the best available worker for you
                </p>
              </div>
              {!selectedWorkerId && (
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              )}
            </div>
          </div>

          {/* Worker list */}
          <div className="space-y-3">
            {workers.map((worker) => (
              <div 
                key={worker.id}
                className={cn(
                  "flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  selectedWorkerId === worker.id 
                    ? "border-purple-500 bg-purple-600/20" 
                    : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
                )}
                onClick={() => onWorkerSelect(worker.id)}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {worker.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{worker.name}</h4>
                  <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
                    {worker.city && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3" />
                        <span>{worker.city}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-yellow-400" />
                      <span>4.8</span>
                    </div>
                  </div>
                </div>
                {selectedWorkerId === worker.id && (
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-6">
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Skip Selection
            </Button>
            <Button
              onClick={onContinue}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};