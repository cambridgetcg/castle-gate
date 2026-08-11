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
          <Link href="/" className="site-mark">
            <span className="castle-glyph" aria-hidden="true">
              🏰
            </span>
            <span className="site-name">the castle of understanding</span>
          </Link>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          built with joy, peace and safety · a Cambridge TCG gate
        </footer>
      </body>
    </html>
  );
}
