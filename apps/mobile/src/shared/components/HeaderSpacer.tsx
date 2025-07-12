import { MotiView } from 'moti';
import type React from 'react';

interface HeaderSpacerProps {
  hideHeader: boolean;
  height: number;
  backgroundColor?: string;
}

export const HeaderSpacer: React.FC<HeaderSpacerProps> = ({
  hideHeader,
  height,
  backgroundColor = '#DCDCDE',
}) => {
  return (
    <MotiView
      from={{ height }}
      animate={{ height: hideHeader ? 0 : height }}
      transition={{ type: 'timing', duration: 300 }}
      className="w-full"
      style={{ backgroundColor }}
    />
  );
};