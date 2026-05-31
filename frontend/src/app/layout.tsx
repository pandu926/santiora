import "./globals.css";
import type { Metadata } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Santiora — AI-Operated Prediction Market",
  description: "The first fully autonomous prediction market. AI creates, resolves, and manages markets on Somnia. Zero human operation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(firaSans.variable, firaCode.variable)}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
