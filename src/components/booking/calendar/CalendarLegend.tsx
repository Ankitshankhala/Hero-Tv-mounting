
import React from 'react';

export const CalendarLegend = () => {
  return (
    <div className="mt-4 flex space-x-4 text-sm">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-green-600 rounded"></div>
        <span className="text-slate-300">Available</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-red-600 rounded"></div>
        <span className="text-slate-300">Booked</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-blue-600 rounded"></div>
        <span className="text-slate-300">Selected</span>
      </div>
    </div>
  );
};
