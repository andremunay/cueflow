import type { HeadsUpOverride } from '../../types';
import SegmentedOptionSelector, { type SegmentedOption } from './SegmentedOptionSelector';

const HEADS_UP_OVERRIDE_OPTIONS: readonly SegmentedOption<HeadsUpOverride>[] = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'Off', value: 'off' },
  { label: 'On', value: 'on' },
];

export interface HeadsUpOverrideSelectorProps {
  value: HeadsUpOverride;
  onChange: (value: HeadsUpOverride) => void;
  label?: string;
  disabled?: boolean;
}

export default function HeadsUpOverrideSelector({
  value,
  onChange,
  label = 'Heads-up override',
  disabled = false,
}: HeadsUpOverrideSelectorProps) {
  return (
    <SegmentedOptionSelector
      label={label}
      value={value}
      options={HEADS_UP_OVERRIDE_OPTIONS}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
