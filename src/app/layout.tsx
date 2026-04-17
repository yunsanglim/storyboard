import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 스토리보드 자동 생성",
  description: "시놉시스를 입력하면 AI가 7개 씬의 스토리보드를 자동으로 생성합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
