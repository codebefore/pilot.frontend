type SearchInputProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, placeholder, onChange }: SearchInputProps) {
  return (
    <input
      className="search-input"
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}
