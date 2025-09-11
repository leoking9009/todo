# 업무 관리 시스템

구글 로그인과 Neon PostgreSQL을 사용한 업무 공유 및 관리 웹 애플리케이션입니다.

## 주요 기능

### 🔐 사용자 인증
- 구글 OAuth를 통한 간편 로그인
- 자동 로그인 상태 유지

### 📋 업무 관리
- **과제 등록**: 담당자, 과제명, 긴급여부, 제출처, 비고 입력
- **완료 관리**: 체크박스를 통한 완료 상태 관리
- **생성일시**: 자동 기록되는 과제 생성 시간

### 📊 대시보드 (전광판)
- **전체 과제 수**: 등록된 모든 과제 수
- **완료 과제 수**: 완료된 과제 수
- **진행 중 과제**: 아직 완료되지 않은 과제 수
- **긴급 과제 수**: 긴급으로 표시된 미완료 과제 수

### 👥 담당자별 관리
- 담당자별 과제 통계 보기
- 개별 담당자의 상세 과제 목록
- 담당자별 완료율 확인

### 🔍 필터링 기능
- **전체 과제**: 모든 과제 목록
- **완료 과제**: 완료된 과제만 보기  
- **긴급 과제**: 긴급으로 표시된 미완료 과제만 보기

## 기술 스택

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Netlify Functions (Node.js)
- **Database**: Neon PostgreSQL
- **Authentication**: Google OAuth
- **Deployment**: Netlify

## 설치 및 실행

### 1. 저장소 클론
\`\`\`bash
git clone <repository-url>
cd business-task-manager
\`\`\`

### 2. 의존성 설치
\`\`\`bash
npm install
\`\`\`

### 3. 환경변수 설정
\`\`\`bash
cp .env.example .env
\`\`\`

\`.env\` 파일을 열고 다음 정보를 입력하세요:
- \`DATABASE_URL\`: Neon PostgreSQL 연결 문자열

### 4. 로컬 개발 서버 실행
\`\`\`bash
npm run dev
\`\`\`

서버가 시작되면 http://localhost:3000 에서 애플리케이션에 접속할 수 있습니다.

### 5. 데이터베이스 연결 테스트
\`\`\`bash
# 데이터베이스 연결 및 테이블 생성 테스트
node test-db-connection.js

# API 엔드포인트 테스트 (서버가 실행 중일 때)
node test-local-api.js
\`\`\`

### 6. API 엔드포인트 테스트 (curl 명령어)
\`\`\`bash
# 모든 작업 조회
curl http://localhost:3000/api/tasks

# 통계 조회
curl http://localhost:3000/api/stats

# 새 작업 생성
curl -X POST http://localhost:3000/api/tasks \\
  -H "Content-Type: application/json" \\
  -d '{"assignee":"테스트","task_name":"테스트 작업","user_id":"test-user"}'
\`\`\`

## Netlify 배포 가이드

### 1. Neon PostgreSQL 설정
1. [Neon 콘솔](https://console.neon.tech)에서 새 프로젝트 생성
2. 데이터베이스 연결 문자열 복사
3. Netlify 환경변수에 \`DATABASE_URL\` 설정

### 2. 구글 OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성
3. 승인된 JavaScript 원본에 배포 도메인 추가
4. \`index.html\`의 \`data-client_id\` 값 업데이트

### 3. Netlify 배포
1. Netlify에 GitHub 저장소 연결
2. 빌드 설정 확인 (\`netlify.toml\` 자동 감지)
3. 환경변수 \`DATABASE_URL\` 설정
4. 배포 시작

## 데이터베이스 스키마

### tasks 테이블
\`\`\`sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  assignee VARCHAR(100) NOT NULL,        -- 담당자
  task_name VARCHAR(200) NOT NULL,       -- 과제명
  is_urgent BOOLEAN DEFAULT FALSE,       -- 긴급여부
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 생성일시
  is_completed BOOLEAN DEFAULT FALSE,    -- 완료여부
  submission_target VARCHAR(100),        -- 제출처
  notes TEXT,                           -- 비고
  user_id VARCHAR(100) NOT NULL,        -- 생성자 ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### users 테이블 (선택사항)
\`\`\`sql
CREATE TABLE users (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## API 엔드포인트

### GET /.netlify/functions/tasks
모든 과제 목록 조회

### POST /.netlify/functions/tasks
새 과제 등록
\`\`\`json
{
  "assignee": "담당자명",
  "task_name": "과제명",
  "is_urgent": false,
  "submission_target": "제출처",
  "notes": "비고",
  "user_id": "사용자ID"
}
\`\`\`

### PUT /.netlify/functions/tasks/:id
과제 정보 업데이트

### DELETE /.netlify/functions/tasks/:id
과제 삭제

### GET /.netlify/functions/stats
과제 통계 정보 조회

## 주요 특징

- **실시간 업데이트**: 30초마다 자동 새로고침
- **반응형 디자인**: 모바일/태블릿/데스크톱 지원
- **직관적 UI**: 이모지와 색상을 활용한 시각적 구분
- **안전한 인증**: 구글 OAuth를 통한 보안 로그인
- **확장 가능**: 추가 기능 구현이 용이한 구조

## 라이선스

MIT License