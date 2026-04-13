'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatVndDigitGroups, sanitizeVndDigitString } from '@/lib/money';
import { cn } from '@/lib/utils';

export type VndAmountInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  /** Chỉ chữ số, không dấu chấm (chuẩn để parse gửi API). */
  valueDigits: string;
  onDigitsChange: (digits: string) => void;
  /** Chuỗi chữ số cho placeholder (sẽ hiển thị có dấu chấm khi không focus). */
  placeholderDigits?: string;
};

/**
 * Ô nhập số tiền VND: khi không focus hiển thị nhóm nghìn bằng dấu "." (kiểu Việt Nam).
 */
export function VndAmountInput({
  valueDigits,
  onDigitsChange,
  placeholderDigits,
  className,
  onFocus,
  onBlur,
  placeholder,
  ...rest
}: VndAmountInputProps) {
  const [focused, setFocused] = React.useState(false);
  const display = focused ? valueDigits : valueDigits ? formatVndDigitGroups(valueDigits) : '';
  const dottedPlaceholder =
    placeholderDigits && !placeholder ? formatVndDigitGroups(placeholderDigits) : placeholder;

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      className={cn('tabular-nums', className)}
      placeholder={dottedPlaceholder}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      onChange={(e) => onDigitsChange(sanitizeVndDigitString(e.target.value))}
    />
  );
}
