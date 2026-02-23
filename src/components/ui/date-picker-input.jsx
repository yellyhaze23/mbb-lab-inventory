import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function DatePickerInput({
  id,
  value = '',
  onChange,
  placeholder = 'Select date',
  className,
  disabled = false,
}) {
  const selectedDate = value ? parseISO(value) : undefined;
  const safeDate = selectedDate && isValid(selectedDate) ? selectedDate : undefined;

  const handleSelect = (date) => {
    if (!date) {
      onChange?.('');
      return;
    }
    onChange?.(format(date, 'yyyy-MM-dd'));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !safeDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
          {safeDate ? format(safeDate, 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <Calendar mode="single" selected={safeDate} onSelect={handleSelect} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
