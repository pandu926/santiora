import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer";
import { DocsPagination } from "@/components/docs/DocsPagination";

export const dynamic = "force-dynamic";

export default function DocsPage() {
  const content = getDocContent("");
  return (
    <>
      <MarkdownRenderer content={content} />
      <DocsPagination />
    </>
  );
}
