import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./workflow.css";
import "./theme.css";
import {ThemeProvider} from './components/theme';

// Apply the saved preference before the first paint, including on shared pages.
const themeBoot=`(()=>{let t='system';try{const s=localStorage.getItem('lensy.theme');if(s==='light'||s==='dark')t=s}catch{}const r=document.documentElement;r.dataset.themePreference=t;r.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t})();`;

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
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:themeBoot}}/><link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body className="antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
