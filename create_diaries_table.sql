-- 일지 테이블 생성
CREATE TABLE IF NOT EXISTS diaries (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    diary_date DATE NOT NULL,
    exercise_completed BOOLEAN DEFAULT FALSE,
    emotion_diary TEXT,
    growth_diary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, diary_date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_diaries_user_date ON diaries(user_id, diary_date);
CREATE INDEX IF NOT EXISTS idx_diaries_user_created ON diaries(user_id, created_at DESC);

-- 테이블 설명 코멘트
COMMENT ON TABLE diaries IS '사용자 일지 데이터를 저장하는 테이블';
COMMENT ON COLUMN diaries.user_id IS '구글 OAuth 사용자 ID';
COMMENT ON COLUMN diaries.user_email IS '사용자 이메일 주소';
COMMENT ON COLUMN diaries.diary_date IS '일지 작성 날짜';
COMMENT ON COLUMN diaries.exercise_completed IS '실내자전거 달성 여부';
COMMENT ON COLUMN diaries.emotion_diary IS '감정 일지 내용';
COMMENT ON COLUMN diaries.growth_diary IS '성장 일지 내용';