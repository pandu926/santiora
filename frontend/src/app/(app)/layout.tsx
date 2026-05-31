import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { LiveFeed } from "@/components/shared/LiveFeed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6">
        {children}
      </main>
      <Footer />
      <MobileNav />
      <LiveFeed />
    </>
  );
}
