const { pool, createTables } = require('./db');

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // 데이터베이스 연결 테스트
    const client = await pool.connect();
    
    try {
      // 테이블 생성
      await createTables();
      
      // 간단한 쿼리 실행
      const result = await client.query('SELECT NOW() as current_time');
      const currentTime = result.rows[0].current_time;

      // 테이블 존재 확인
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tasks', 'users')
        ORDER BY table_name
      `);
      
      const tables = tableCheck.rows.map(row => row.table_name);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Neon DB 연결이 성공적으로 완료되었습니다!',
          data: {
            currentTime,
            tablesCreated: tables,
            connectionStatus: 'Connected'
          }
        }, null, 2),
      };
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Neon DB 연결에 실패했습니다.',
        error: error.message,
        details: {
          code: error.code,
          severity: error.severity,
          routine: error.routine
        }
      }, null, 2),
    };
  }
};