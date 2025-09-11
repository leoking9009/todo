const { Pool } = require('pg');

// 데이터베이스 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  // CORS preflight 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      // 일지 저장
      const { user_id, user_email, diary_date, exercise_completed, emotion_diary, growth_diary } = JSON.parse(event.body);
      
      // 필수 필드 검증
      if (!user_id || !user_email || !diary_date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: '사용자 ID, 이메일, 날짜는 필수입니다.'
          })
        };
      }

      // 중복 날짜 확인 후 업데이트 또는 삽입
      const existingDiary = await pool.query(
        'SELECT id FROM diaries WHERE user_id = $1 AND diary_date = $2',
        [user_id, diary_date]
      );

      let result;
      if (existingDiary.rows.length > 0) {
        // 업데이트
        result = await pool.query(
          `UPDATE diaries 
           SET exercise_completed = $1, emotion_diary = $2, growth_diary = $3, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4 AND diary_date = $5
           RETURNING *`,
          [exercise_completed, emotion_diary, growth_diary, user_id, diary_date]
        );
      } else {
        // 삽입
        result = await pool.query(
          `INSERT INTO diaries (user_id, user_email, diary_date, exercise_completed, emotion_diary, growth_diary, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
           RETURNING *`,
          [user_id, user_email, diary_date, exercise_completed, emotion_diary, growth_diary]
        );
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: '일지가 성공적으로 저장되었습니다.',
          data: result.rows[0]
        })
      };

    } else if (event.httpMethod === 'GET') {
      // 일지 조회
      const { user_id, date, limit } = event.queryStringParameters || {};
      
      if (!user_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: '사용자 ID가 필요합니다.'
          })
        };
      }

      let query, params;
      
      if (date) {
        // 특정 날짜 일지 조회
        query = 'SELECT * FROM diaries WHERE user_id = $1 AND diary_date = $2';
        params = [user_id, date];
      } else {
        // 최근 일지 목록 조회
        const limitNum = limit ? parseInt(limit) : 7;
        query = `SELECT * FROM diaries WHERE user_id = $1 
                 ORDER BY diary_date DESC LIMIT $2`;
        params = [user_id, limitNum];
      }

      const result = await pool.query(query, params);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: date ? result.rows[0] : result.rows
        })
      };

    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          message: '허용되지 않는 HTTP 메소드입니다.'
        })
      };
    }

  } catch (error) {
    console.error('일지 API 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message
      })
    };
  }
};