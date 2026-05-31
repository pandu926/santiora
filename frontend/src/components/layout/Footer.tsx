import Link from "next/link";
import { Activity, Github, FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t mt-16 py-8 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-3.5 h-3.5" />
          <span>Santiora — AI-Operated Prediction Market on Somnia</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/docs" className="hover:text-foreground transition-colors flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Docs
          </Link>
          <Link href="/status" className="hover:text-foreground transition-colors">
            Status
          </Link>
          <Link href="/transparency" className="hover:text-foreground transition-colors">
            Transparency
          </Link>
          <a href="https://github.com" target="_blank" rel="noopener" className="hover:text-foreground transition-colors">
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
