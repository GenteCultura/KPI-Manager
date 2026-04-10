import { motion } from 'motion/react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Toggle = ({ checked, onChange, label, description }: ToggleProps) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col gap-0.5">
        {label && <span className="text-sm font-medium text-gray-900">{label}</span>}
        {description && <span className="text-xs text-gray-500">{description}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        />
      </button>
    </div>
  );
};

import { X, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  placeholder?: string;
}

export const MultiSelect = ({ options, selected = [], onChange, label, placeholder }: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeSelected = Array.isArray(selected) ? selected : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (safeSelected.includes(value)) {
      onChange(safeSelected.filter((item) => item !== value));
    } else {
      onChange([...safeSelected, value]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex min-h-[40px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
        >
          {safeSelected.length > 0 ? (
            safeSelected.map((value) => {
              const option = options.find(o => o.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {option ? option.label : value}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-indigo-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(value);
                    }}
                  />
                </span>
              );
            })
          ) : (
            <span className="text-gray-400">{placeholder || 'Selecione...'}</span>
          )}
          <ChevronDown className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`flex cursor-pointer items-center px-3 py-2 text-sm hover:bg-gray-100 ${
                  safeSelected.includes(option.value) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                }`}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
