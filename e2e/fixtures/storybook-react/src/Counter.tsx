import * as React from 'react';

export interface CounterProps {
  label: string;
  onChange?: (value: number) => void;
}

export function Counter({ label, onChange }: CounterProps) {
  const [count, setCount] = React.useState(0);
  const increment = () => {
    setCount(count + 1);
    onChange?.(count + 1);
  };

  return (
    <div className={count > 0 ? 'counter counter--active' : 'counter'}>
      <span role="status" aria-label={label}>
        {count}
      </span>
      <button type="button" onClick={increment}>
        Add
      </button>
    </div>
  );
}
