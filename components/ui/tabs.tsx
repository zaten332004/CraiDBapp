'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

type IndicatorState = {
  left: number
  top: number
  width: number
  height: number
  opacity: number
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, children, ...props }, forwardedRef) {
  const localRef = React.useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = React.useState<IndicatorState>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [forwardedRef],
  )

  React.useLayoutEffect(() => {
    const root = localRef.current
    if (!root) return

    const updateIndicator = () => {
      const active = root.querySelector(
        '[data-slot="tabs-trigger"][data-state="active"]',
      ) as HTMLElement | null
      if (!active) {
        setIndicator((s) => ({ ...s, opacity: 0 }))
        return
      }
      const rootRect = root.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      setIndicator({
        left: activeRect.left - rootRect.left + root.scrollLeft,
        top: activeRect.top - rootRect.top + root.scrollTop,
        width: activeRect.width,
        height: activeRect.height,
        opacity: 1,
      })
    }

    updateIndicator()
    requestAnimationFrame(updateIndicator)

    const ro = new ResizeObserver(() => updateIndicator())
    ro.observe(root)
    for (const el of root.querySelectorAll('[data-slot="tabs-trigger"]')) {
      ro.observe(el)
    }

    const mo = new MutationObserver(updateIndicator)
    mo.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'data-disabled'],
    })

    window.addEventListener('resize', updateIndicator)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [children])

  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-slot="tabs-list"
      className={cn(
        'relative isolate inline-flex h-9 w-fit items-center justify-center overflow-hidden rounded-lg bg-muted p-[3px] text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute z-0 rounded-md bg-background shadow-sm ring-1 ring-black/[0.04] will-change-[left,top,width,height,opacity,transform] transition-[left,top,width,height,opacity,transform] duration-380 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:will-change-auto motion-reduce:transition-none dark:ring-white/10',
        )}
        style={{
          left: indicator.left,
          top: indicator.top,
          width: indicator.width,
          height: indicator.height,
          opacity: indicator.opacity,
          transform: indicator.opacity ? 'translateY(0)' : 'translateY(-2px)',
        }}
      />
      {children}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = 'TabsList'

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative z-[1] inline-flex h-[calc(100%-1px)] flex-1 origin-center items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,transform,opacity] duration-220 ease-out hover:text-foreground/90 data-[state=active]:text-foreground data-[state=active]:motion-safe:animate-in data-[state=active]:motion-safe:fade-in-0 data-[state=active]:motion-safe:zoom-in-95 data-[state=active]:motion-safe:duration-200 data-[state=inactive]:motion-safe:hover:scale-[1.03] data-[state=inactive]:motion-safe:active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:data-[state=active]:animate-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex-1 outline-none data-[state=active]:motion-safe:animate-in data-[state=active]:motion-safe:fade-in-0 data-[state=active]:motion-safe:slide-in-from-bottom-1 data-[state=active]:motion-safe:duration-300 data-[state=active]:motion-safe:ease-out motion-reduce:data-[state=active]:animate-none',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
