import type { SoundId } from '../../types';
import SegmentedOptionSelector, { type SegmentedOption } from './SegmentedOptionSelector';

const SOUND_OPTIONS: readonly SegmentedOption<SoundId>[] = [
  { label: 'Beep', value: 'beep' },
  { label: 'Chime', value: 'chime' },
  { label: 'Whistle', value: 'whistle' },
];

export interface SoundSelectorProps {
  value?: SoundId;
  onChange: (value: SoundId) => void;
  label?: string;
  disabled?: boolean;
}

export default function SoundSelector({
  value,
  onChange,
  label = 'Sound',
  disabled = false,
}: SoundSelectorProps) {
  return (
    <SegmentedOptionSelector
      label={label}
      value={value}
      options={SOUND_OPTIONS}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
