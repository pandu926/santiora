import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-6xl font-mono font-bold text-muted-foreground">404</p>
        <p className="text-sm text-muted-foreground">Page not found</p>
        <Link href="/markets" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Go to Markets
        </Link>
      </div>
    </div>
  );
}
