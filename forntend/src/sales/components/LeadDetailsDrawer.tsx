import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { type LeadRecord } from '@/lib/leadApi';

interface LeadDetailsDrawerProps {
  lead: LeadRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

const fields = [
  ['Company', 'companyName'],
  ['Contact', 'contactPerson'],
  ['Email', 'email'],
  ['Source', 'sourceOfLead'],
  ['Assigned To', 'assignedTo'],
] as const;

export function LeadDetailsDrawer({ lead, isOpen, onClose }: LeadDetailsDrawerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      document.body.style.overflow = 'hidden';
      return undefined;
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  if (!isOpen && !visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <aside
        className={`max-h-[85vh] w-full max-w-[500px] overflow-y-auto rounded-xl bg-white shadow-2xl transition-all duration-200 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(event) => event.stopPropagation()}
        aria-label="Lead details"
      >
        <div className="flex items-center justify-between border-b border-[#EFECE5] bg-[#FAF8F2] px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Lead Details</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-gray-600 hover:bg-white" aria-label="Close lead details">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          {fields.map(([label, key]) => {
            const rawValue = lead?.[key];
            const value = rawValue === undefined || rawValue === null || rawValue === ''
              ? key === 'assignedTo' ? 'Unassigned' : '-'
              : String(rawValue);
            return (
              <div key={key} className="flex items-start justify-between gap-4 border-b border-[#EFECE5] pb-3 last:border-b-0">
                <span className="text-sm font-semibold text-gray-500">{label}</span>
                <span className="max-w-[65%] break-words text-right text-sm text-gray-900">{value}</span>
              </div>
            );
          })}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
