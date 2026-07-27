import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "定期調査 Output",
  description: "柑橘の定期調査データを分析・比較・予測するためのOutputシステム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
