import { Search, X } from 'lucide-react';

export const SearchBox = ({
  value,
  onChange,
  placeholder,
  wrapperClassName = 'glass-search',
  clearClassName = 'search-clear',
}) => (
  <div className={wrapperClassName}>
    <Search size={14} />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button className={clearClassName} onClick={() => onChange('')} aria-label="Clear search">
        <X size={14} />
      </button>
    )}
  </div>
);
