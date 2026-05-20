import { useState, useRef, useEffect } from 'react';

/**
 * Dropdown with checkboxes for multi-select.
 * Props:
 *   label      – button label when nothing selected (e.g. "All Ages")
 *   options    – array of primitives (string | number)
 *   selected   – Set of selected values
 *   onChange   – (newSet) => void
 *   size       – 'sm' | 'md'
 */
export default function MultiCheckSelect({ label, options = [], selected, onChange, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (val) => {
    const next = new Set(selected);
    next.has(val) ? next.delete(val) : next.add(val);
    onChange(next);
  };

  const sizeClasses = size === 'sm' ? 'px-3 py-2 text-sm min-h-[36px]' : 'px-4 py-3 text-base min-h-[48px]';
  const displayLabel = selected.size === 0 ? label : `${[...selected].sort((a, b) => a - b).join(', ')}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 border-2 rounded-xl font-medium text-left transition-all duration-150 select-none
          ${sizeClasses}
          ${open
            ? 'border-saffron-500 bg-white shadow-md ring-2 ring-saffron-100'
            : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${selected.size > 0 ? 'text-gray-900' : 'text-gray-400'}
        `}
      >
        <span className="truncate">{displayLabel}</span>
        <svg className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180 text-saffron-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[120px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-saffron-600 hover:bg-saffron-50 border-b border-gray-100"
            >
              Clear all
            </button>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-forest-50 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 rounded accent-saffron-500 cursor-pointer"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
