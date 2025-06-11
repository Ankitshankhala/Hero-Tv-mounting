
import React from 'react';

interface ModificationSummaryProps {
  originalTotal: number;
  newTotal: number;
}

export const ModificationSummary: React.FC<ModificationSummaryProps> = ({
  originalTotal,
  newTotal
}) => {
  const difference = newTotal - originalTotal;

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="bg-slate-700 p-3 rounded">
        <p className="text-slate-400">Original Total</p>
        <p className="text-white font-bold text-xl">${originalTotal.toFixed(2)}</p>
      </div>
      <div className="bg-slate-700 p-3 rounded">
        <p className="text-slate-400">New Total</p>
        <p className="text-white font-bold text-xl">${newTotal.toFixed(2)}</p>
      </div>
      <div className="bg-slate-700 p-3 rounded">
        <p className="text-slate-400">Difference</p>
        <p className={`font-bold text-xl ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {difference >= 0 ? '+' : ''}${difference.toFixed(2)}
        </p>
      </div>
    </div>
  );
};
