'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type ChatMarkdownProps = {
  text: string;
  className?: string;
};

export function ChatMarkdown({ text, className }: ChatMarkdownProps) {
  return (
    <div className={cn('chat-markdown text-sm text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold tracking-tight mt-4 mb-2 first:mt-0 border-b border-border/60 pb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1.5 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-outside list-disc space-y-1.5 pl-5 marker:text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-outside list-decimal space-y-1.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-primary/50 bg-muted/40 pl-3 py-1.5 my-3 rounded-r-md text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary font-medium underline underline-offset-2 hover:opacity-90 break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 w-full max-w-full overflow-x-auto rounded-md border border-border bg-background/50 shadow-sm">
              <table className="w-full min-w-[min(100%,640px)] border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left font-semibold align-bottom whitespace-normal break-words">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/80 px-3 py-2 align-top whitespace-normal break-words">{children}</td>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/80 p-3 text-xs font-mono leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes('language-'));
            if (!isBlock) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] border border-border/60" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={cn('font-mono text-xs', className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
