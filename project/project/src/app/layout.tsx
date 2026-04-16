import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Storyboard Generator",
  description: "Generate a storyboard from synopsis with AI"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
