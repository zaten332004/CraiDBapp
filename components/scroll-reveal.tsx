'use client';

import * as React from 'react';

export function ScrollReveal({
  children,
  className,
  delayMs = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  once?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
          return;
        }
        if (!once) setVisible(false);
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${visible ? 'is-visible' : ''} ${className ?? ''}`.trim()}
      style={{ ['--sr-delay' as any]: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

