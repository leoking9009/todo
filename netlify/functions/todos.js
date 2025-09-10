const { pool } = require('./db');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const client = await pool.connect();
    
    try {
      // TODO 테이블 생성 (처음 실행 시)
      await client.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
          is_completed BOOLEAN DEFAULT FALSE,
          user_id VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const method = event.httpMethod;
      const pathSegments = event.path.split('/');
      const body = event.body ? JSON.parse(event.body) : null;
      const queryParams = event.queryStringParameters || {};

      // GET 요청 - TODO 목록 조회
      if (method === 'GET') {
        const { user_id } = queryParams;
        
        if (!user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '사용자 ID가 필요합니다.'
            }),
          };
        }

        const result = await client.query(`
          SELECT * FROM todos 
          WHERE user_id = $1 
          ORDER BY 
            is_completed ASC,
            CASE priority 
              WHEN 'high' THEN 1 
              WHEN 'medium' THEN 2 
              WHEN 'low' THEN 3 
            END,
            created_at DESC
        `, [user_id]);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: result.rows
          }),
        };
      }

      // POST 요청 - 새 TODO 생성
      if (method === 'POST') {
        const { text, priority = 'medium', user_id } = body;
        
        if (!text || !user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '할 일 내용과 사용자 ID가 필요합니다.'
            }),
          };
        }

        if (!['low', 'medium', 'high'].includes(priority)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '우선순위는 low, medium, high 중 하나여야 합니다.'
            }),
          };
        }

        const result = await client.query(`
          INSERT INTO todos (text, priority, user_id)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [text, priority, user_id]);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'TODO가 성공적으로 생성되었습니다.',
            data: result.rows[0]
          }),
        };
      }

      // PUT 요청 - TODO 업데이트
      if (method === 'PUT') {
        const todoId = pathSegments[pathSegments.length - 1];
        const { text, priority, is_completed, user_id } = body;

        if (!user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '사용자 ID가 필요합니다.'
            }),
          };
        }

        // 해당 TODO가 사용자의 것인지 확인
        const checkResult = await client.query(`
          SELECT * FROM todos WHERE id = $1 AND user_id = $2
        `, [todoId, user_id]);

        if (checkResult.rows.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'TODO를 찾을 수 없거나 권한이 없습니다.'
            }),
          };
        }

        let updateQuery = 'UPDATE todos SET updated_at = CURRENT_TIMESTAMP';
        let updateValues = [todoId, user_id];
        let valueIndex = 3;

        if (text !== undefined) {
          updateQuery += `, text = $${valueIndex++}`;
          updateValues.push(text);
        }

        if (priority !== undefined) {
          if (!['low', 'medium', 'high'].includes(priority)) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                message: '우선순위는 low, medium, high 중 하나여야 합니다.'
              }),
            };
          }
          updateQuery += `, priority = $${valueIndex++}`;
          updateValues.push(priority);
        }

        if (is_completed !== undefined) {
          updateQuery += `, is_completed = $${valueIndex++}`;
          updateValues.push(is_completed);
        }

        updateQuery += ' WHERE id = $1 AND user_id = $2 RETURNING *';

        const result = await client.query(updateQuery, updateValues);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'TODO가 성공적으로 업데이트되었습니다.',
            data: result.rows[0]
          }),
        };
      }

      // DELETE 요청 - TODO 삭제
      if (method === 'DELETE') {
        const todoId = pathSegments[pathSegments.length - 1];
        const { user_id } = queryParams;

        if (!user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '사용자 ID가 필요합니다.'
            }),
          };
        }

        const result = await client.query(`
          DELETE FROM todos 
          WHERE id = $1 AND user_id = $2 
          RETURNING *
        `, [todoId, user_id]);

        if (result.rows.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'TODO를 찾을 수 없거나 권한이 없습니다.'
            }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'TODO가 성공적으로 삭제되었습니다.',
            data: result.rows[0]
          }),
        };
      }

      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          message: '지원하지 않는 HTTP 메서드입니다.'
        }),
      };

    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('TODO API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message
      }),
    };
  }
};