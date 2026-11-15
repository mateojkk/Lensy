import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lensy — See the whole picture",
  description: "A little clarity in a world of synthetic media. Check images and videos, see the evidence, and share the proof.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
