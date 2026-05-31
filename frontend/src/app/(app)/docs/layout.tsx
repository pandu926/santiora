import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      <aside className="hidden md:block w-56 shrink-0 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto py-2">
        <DocsSidebar />
      </aside>
      <article className="min-w-0 flex-1 max-w-3xl pb-16">
        {children}
      </article>
    </div>
  );
}
