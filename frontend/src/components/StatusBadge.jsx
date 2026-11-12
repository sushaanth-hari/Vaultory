import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';

export default function StatusBadge({ status, remainingDays, size = 'sm' }) {
  const s = (status || '').toLowerCase();
  
  let bg = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = null;
  let text = status || 'Unknown';

  if (s === 'active') {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    icon = <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />;
    text = remainingDays !== undefined ? `Active (${remainingDays}d)` : 'Active';
  } else if (s === 'expiring_soon' || s === 'expiring') {
    bg = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />;
    text = remainingDays !== undefined ? `Expiring (${remainingDays}d)` : 'Expiring Soon';
  } else if (s === 'expired') {
    bg = 'bg-rose-50 text-rose-700 border-rose-200';
    icon = <AlertOctagon className="w-3.5 h-3.5 mr-1 text-rose-600" />;
    text = 'Expired';
  } else if (s === 'completed') {
    bg = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-blue-600" />;
    text = 'Completed';
  } else if (s === 'in progress' || s === 'pending') {
    bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    icon = <Clock className="w-3.5 h-3.5 mr-1 text-indigo-600" />;
    text = status;
  }

  const sizeClass = size === 'xs' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-medium border rounded-full ${bg} ${sizeClass}`}>
      {icon}
      {text}
    </span>
  );
}

