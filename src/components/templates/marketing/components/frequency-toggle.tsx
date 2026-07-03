'use client';

interface FrequencyToggleProps {
  value: 'monthly' | 'yearly';
  onChange: (value: 'monthly' | 'yearly') => void;
}

export const FrequencyToggle = ({ value, onChange }: FrequencyToggleProps) => {
  const monthlyWidth = 100.992; // Width of "Monthly" option in pixels
  const yearlyWidth = 102.992; // Width of "Yearly" option in pixels

  return (
    <fieldset aria-label="Payment frequency">
      <div className="bg-card border border-border relative flex rounded-full text-center p-0.5">
        <div
          className="absolute rounded-full transition-all bg-card border border-border"
          style={{
            left: '2px',
            width: `${value === 'monthly' ? monthlyWidth : yearlyWidth}px`,
            top: '2px',
            bottom: '2px',
            transitionDuration: '200ms',
            transitionTimingFunction: 'ease-out',
          }}
        />
        <label className="group relative cursor-pointer rounded-full border border-transparent pill-padding-md-sm text-base leading-[1]">
          <input
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 absolute inset-0 cursor-pointer appearance-none rounded-full"
            type="radio"
            value="monthly"
            checked={value === 'monthly'}
            onChange={() => onChange('monthly')}
            name="frequency"
          />
          <span className="text-font">Monthly</span>
        </label>
        <label className="group relative cursor-pointer rounded-full border border-transparent pill-padding-md-sm text-base leading-[1]">
          <input
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 absolute inset-0 cursor-pointer appearance-none rounded-full"
            type="radio"
            value="yearly"
            checked={value === 'yearly'}
            onChange={() => onChange('yearly')}
            name="frequency"
          />
          <span className="text-muted-foreground group-hover:text-font">Yearly</span>
        </label>
      </div>
    </fieldset>
  );
};
