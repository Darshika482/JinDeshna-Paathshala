import { useState, useRef, useEffect } from 'react';

/**
 * Custom styled dropdown replacing native <select>.
 *
 * Props:
 *   value       – current value
 *   onChange    – (value) => void
 *   options     – [{ value, label }] or ['string', ...]
 *   placeholder – text shown when value is empty
 *   className   – extra classes for the trigger button
 *   size        – 'sm' | 'md' (default 'md')
 *   disabled    – boolean
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  className = '',
  size = 'md',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Normalise options to { value, label }
  const normalised = options.map(o =>
    typeof o === 'string' || typeof o === 'number'
      ? { value: o, label: String(o) }
      : o
  );

  const selected = normalised.find(o => String(o.value) === String(value));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const sizeClasses = size === 'sm'
    ? 'px-3 py-2 text-sm min-h-[36px]'
    : 'px-4 py-3 text-base min-h-[48px]';

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          border-2 rounded-xl font-medium text-left
          transition-all duration-150 select-none
          ${sizeClasses}
          ${disabled
            ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
            : open
              ? 'border-saffron-500 bg-white shadow-md ring-2 ring-saffron-100'
              : 'border-gray-200 bg-white hover:border-gray-300 focus:outline-none focus:border-saffron-500'
          }
        `}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`flex-shrink-0 w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180 text-saffron-500' : 'text-gray-400'}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="
          absolute z-50 mt-1 w-full
          bg-white border border-gray-200 rounded-2xl shadow-xl
          overflow-hidden
          animate-dropdown
        ">
          <div className="max-h-56 overflow-y-auto py-1">
            {normalised.map((opt) => {
              const isActive = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`
                    w-full text-left px-4 py-2.5 text-sm font-medium
                    flex items-center justify-between gap-2
                    transition-colors duration-100
                    ${isActive
                      ? 'bg-saffron-50 text-saffron-700'
                      : 'text-gray-800 hover:bg-forest-50 hover:text-forest-800'
                    }
                  `}
                >
                  <span>{opt.label}</span>
                  {isActive && (
                    <svg className="w-4 h-4 text-saffron-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
