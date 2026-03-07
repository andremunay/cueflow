import type { CueActionType } from '../../types';
import SegmentedOptionSelector, { type SegmentedOption } from './SegmentedOptionSelector';

const ACTION_TYPE_OPTIONS: readonly SegmentedOption<CueActionType>[] = [
  { label: 'TTS', value: 'tts' },
  { label: 'Sound', value: 'sound' },
  { label: 'Combo', value: 'combo' },
];

export interface ActionTypeSelectorProps {
  value: CueActionType;
  onChange: (value: CueActionType) => void;
  label?: string;
  disabled?: boolean;
}

export default function ActionTypeSelector({
  value,
  onChange,
  label = 'Action type',
  disabled = false,
}: ActionTypeSelectorProps) {
  return (
    <SegmentedOptionSelector
      label={label}
      value={value}
      options={ACTION_TYPE_OPTIONS}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
