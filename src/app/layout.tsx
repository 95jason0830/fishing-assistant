import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "釣魚智慧助手",
  description: "AI 驅動的釣魚分析與紀錄平台",
  manifest: "/manifest.json",
  themeColor: "#0a1628",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "釣魚助手" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "#0a1628" }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}} />
      </body>
    </html>
  );
}
