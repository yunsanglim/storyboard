# AI 스토리보드 자동 생성

시놉시스를 입력하면 Google Gemini AI가 7개 씬의 스토리보드(텍스트 + 이미지)를 자동으로 생성합니다.

## 기능

- 시놉시스 → 7개 씬 자동 분할 및 설명 생성
- 씬별 이미지 자동 생성 (Imagen 4 / 3)
- 이미지 스타일 선택: 픽사 애니메이션 / 실사 영화 / 수채화 일러스트 / 마블 코믹스 / 커스텀
- 커스텀 스타일: 직접 프롬프트 입력 + 참조 이미지 업로드
- 씬 텍스트 수정 / 이미지 개별 재생성
- 완성된 스토리보드 PDF 출력

## 시작하기

### 1. 의존성 설치

\`\`\`bash
npm install
\`\`\`

### 2. 환경 변수 설정

`.env.local` 파일에 API 키를 입력합니다.

\`\`\`
GEMINI_API_KEY=여기에_Gemini_API_키_입력
\`\`\`

Gemini API 키는 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료로 발급받을 수 있습니다.

### 3. 개발 서버 실행

\`\`\`bash
npm run dev
\`\`\`

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 프로덕션 빌드

\`\`\`bash
npm run build
npm start
\`\`\`

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS + Lucide Icons
- **AI**: Google Gemini 2.0 Flash (텍스트) + Imagen 4 (이미지)
- **Language**: TypeScript

## 파일 구조

\`\`\`
src/
└── app/
    ├── layout.tsx                        # 루트 레이아웃
    ├── page.tsx                          # 메인 UI
    ├── globals.css                       # 전역 스타일
    └── api/
        ├── generate-text/
        │   └── route.ts                  # 시놉시스 → 씬 텍스트 생성
        └── regenerate-image/
            └── route.ts                  # 씬 이미지 생성 / 재생성
\`\`\`
