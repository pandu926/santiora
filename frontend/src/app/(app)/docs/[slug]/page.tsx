import { getDocContent } from "@/lib/docs";
import { DOCS_NAV } from "@/lib/docs-nav";
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DocSlugPage({ params }: Props) {
  const { slug } = await params;
  const valid = DOCS_NAV.some((item) => item.slug === slug);
  if (!valid) notFound();

  const content = getDocContent(slug);
  return (
    <>
      <MarkdownRenderer content={content} />
      <DocsPagination />
    </>
  );
}
