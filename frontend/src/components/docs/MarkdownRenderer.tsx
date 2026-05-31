import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold tracking-tight mt-8 mb-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold tracking-tight mt-8 mb-3 pb-2 border-b">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-6 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium mt-4 mb-2">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-4 text-foreground/90">{children}</p>
          ),
          a: ({ href, children }) => {
            let resolvedHref = href || "";
            if (resolvedHref.startsWith("./") || resolvedHref.endsWith(".md")) {
              resolvedHref = resolvedHref.replace(/^\.\//, "").replace(/\.md$/, "");
              resolvedHref = resolvedHref === "README" ? "/docs" : `/docs/${resolvedHref}`;
            }
            const isExternal = resolvedHref.startsWith("http");
            return (
              <a
                href={resolvedHref}
                className="text-primary hover:underline font-medium"
                {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 mb-4 space-y-1 text-sm text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 text-sm text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4 rounded-md border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50 border-b">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-xs">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t text-xs">{children}</td>
          ),
          code: ({ className, children, node }) => {
            const isInline = !className && node?.position?.start.line === node?.position?.end.line;
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
              );
            }
            return (
              <code className={`${className || ""} text-xs font-mono block whitespace-pre`}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 mb-4 overflow-x-auto text-[11px] leading-relaxed font-mono">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-4 mb-4 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
