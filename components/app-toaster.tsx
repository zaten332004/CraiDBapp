'use client';

import { CheckCircle2, CircleX } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Một host toast duy nhất: thẻ popover, icon trái; success/error chỉ khác màu chữ & icon.
 */
export function AppToaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-center"
      closeButton={false}
      duration={4000}
      visibleToasts={4}
      expand={false}
      offset={20}
      gap={10}
      richColors
      className="app-toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      icons={{
        success: <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />,
        error: <CircleX className="size-4 shrink-0" strokeWidth={2} aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast: 'gap-3 !items-center !py-3.5 !px-4 rounded-[10px] shadow-lg',
          title: 'text-[15px] font-medium leading-snug',
          description: 'text-sm leading-relaxed',
          icon: '!size-5 [&_svg]:size-4',
        },
      }}
      {...props}
    />
  );
}
