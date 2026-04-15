import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,transform] duration-300 overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border border-primary/45 bg-primary/[0.06] text-primary [a&]:hover:bg-primary/[0.11] dark:bg-primary/[0.1] dark:[a&]:hover:bg-primary/[0.16]',
        secondary:
          'border border-border bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        destructive:
          'border border-destructive/40 bg-destructive/[0.06] text-destructive [a&]:hover:bg-destructive/[0.11] focus-visible:ring-destructive/20 dark:bg-destructive/[0.1] dark:[a&]:hover:bg-destructive/[0.15]',
        outline:
          'text-foreground border-border [a&]:hover:bg-muted/70',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
