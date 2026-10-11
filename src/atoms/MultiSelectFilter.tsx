import React from "react";

interface Option {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select...",
  singleSelect = false,
}) => {
  const handleChange = (value: string) => {
    if (singleSelect) {
      onChange(selectedValues[0] === value ? [] : [value]);
      return;
    }
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selectedValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleChange(opt.value)}
            className={[
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              active
                ? "bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-[var(--primary)]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default MultiSelectFilter;
