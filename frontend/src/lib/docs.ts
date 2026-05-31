import fs from "fs";
import path from "path";
import { DOCS_NAV } from "./docs-nav";

export type { DocNavItem } from "./docs-nav";
export { DOCS_NAV } from "./docs-nav";

const DOCS_DIR = "/root/somnia/docs";

export function getDocContent(slug: string): string {
  const filename = slug ? `${slug}.md` : "README.md";
  const filePath = path.join(DOCS_DIR, filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return `# Not Found\n\nDocument "${slug}" not found.`;
  }
}

export function getDocTitle(slug: string): string {
  const item = DOCS_NAV.find((n) => n.slug === slug);
  return item?.title ?? "Documentation";
}
