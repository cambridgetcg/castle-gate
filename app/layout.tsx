import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "the castle of understanding",
  description:
    "a knowledge garden made legible — words as bricks, rooms as walls, every claim with its source",
  alternates: {
    types: {
      "text/plain": "https://cambridgetcg.github.io/castle-gate/llms.txt",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-nav" aria-label="Castle navigation">
            <Link href="/" className="site-mark">
              <span className="castle-glyph" aria-hidden="true">
                🏰
              </span>
              <span className="site-name">the castle of understanding</span>
            </Link>
            <div className="site-links">
              <Link href="/love-and-understanding">love + understanding</Link>
              <Link href="/cases/ritonavir-polymorph">ritonavir case</Link>
              <Link href="/#words">words</Link>
              <Link href="/#rooms">rooms</Link>
            </div>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          built with joy, peace and safety · a Cambridge TCG gate
        </footer>
      </body>
    </html>
  );
}
