import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrostEarth",
  description: "Sell your notes, eBooks and PDFs — India-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
