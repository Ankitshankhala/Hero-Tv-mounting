
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface JobInstructionsProps {
  job: any;
}

const JobInstructions = ({ job }: JobInstructionsProps) => {
  return (
    <>
      {job.special_instructions && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-sm">
            <strong>Special Instructions:</strong> {job.special_instructions}
          </p>
        </div>
      )}

      {job.has_modifications && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <p className="text-blue-200 text-sm">
              <strong>Invoice has been modified.</strong> Customer approval may be required for payment changes.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default JobInstructions;
