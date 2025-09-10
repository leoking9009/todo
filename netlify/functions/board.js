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
      // 게시판 테이블 생성 (처음 실행 시)
      await client.query(`
        CREATE TABLE IF NOT EXISTS board_posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          category VARCHAR(50) NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          author_id VARCHAR(100) NOT NULL,
          is_urgent BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          likes_count INTEGER DEFAULT 0,
          views_count INTEGER DEFAULT 0
        )
      `);

      // 댓글 테이블 생성
      await client.query(`
        CREATE TABLE IF NOT EXISTS board_comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES board_posts(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          author_id VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 좋아요 테이블 생성
      await client.query(`
        CREATE TABLE IF NOT EXISTS board_likes (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES board_posts(id) ON DELETE CASCADE,
          user_id VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(post_id, user_id)
        )
      `);

      const method = event.httpMethod;
      const path = event.path;
      const body = event.body ? JSON.parse(event.body) : null;
      const queryParams = event.queryStringParameters || {};

      // GET 요청 - 게시글 목록 조회
      if (method === 'GET') {
        const { category = 'all', search = '', page = 1, limit = 10 } = queryParams;
        
        let query = `
          SELECT 
            p.*,
            (SELECT COUNT(*) FROM board_comments WHERE post_id = p.id) as comments_count,
            COALESCE(p.likes_count, 0) as likes_count
          FROM board_posts p
        `;
        
        let whereConditions = [];
        let queryValues = [];
        let valueIndex = 1;

        if (category !== 'all') {
          whereConditions.push(`category = $${valueIndex++}`);
          queryValues.push(category);
        }

        if (search) {
          whereConditions.push(`(title ILIKE $${valueIndex++} OR content ILIKE $${valueIndex++})`);
          queryValues.push(`%${search}%`, `%${search}%`);
        }

        if (whereConditions.length > 0) {
          query += ' WHERE ' + whereConditions.join(' AND ');
        }

        query += ` ORDER BY created_at DESC LIMIT $${valueIndex++} OFFSET $${valueIndex++}`;
        queryValues.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const result = await client.query(query, queryValues);
        
        // 전체 게시글 수 조회
        let countQuery = 'SELECT COUNT(*) FROM board_posts';
        if (whereConditions.length > 0) {
          countQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        const countResult = await client.query(countQuery, queryValues.slice(0, -2));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: result.rows,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: parseInt(countResult.rows[0].count),
              totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
            }
          }),
        };
      }

      // POST 요청 - 새 게시글 작성
      if (method === 'POST') {
        const { title, content, category, author_name, author_id, is_urgent = false } = body;
        
        if (!title || !content || !category || !author_name || !author_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '필수 필드가 누락되었습니다.'
            }),
          };
        }

        const result = await client.query(`
          INSERT INTO board_posts (title, content, category, author_name, author_id, is_urgent)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [title, content, category, author_name, author_id, is_urgent]);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: '게시글이 성공적으로 작성되었습니다.',
            data: result.rows[0]
          }),
        };
      }

      // PUT 요청 - 게시글 수정
      if (method === 'PUT' && !path.includes('/view/')) {
        const { id, title, content, category, is_urgent, author_id } = body;
        
        if (!id || !title || !content || !category || !author_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '필수 필드가 누락되었습니다.'
            }),
          };
        }

        // 작성자 확인
        const authorCheck = await client.query(`
          SELECT author_id FROM board_posts WHERE id = $1
        `, [id]);

        if (authorCheck.rows.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              message: '게시글을 찾을 수 없습니다.'
            }),
          };
        }

        if (authorCheck.rows[0].author_id !== author_id) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              message: '게시글 수정 권한이 없습니다.'
            }),
          };
        }

        const result = await client.query(`
          UPDATE board_posts 
          SET title = $1, content = $2, category = $3, is_urgent = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND author_id = $6
          RETURNING *
        `, [title, content, category, is_urgent || false, id, author_id]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: '게시글이 성공적으로 수정되었습니다.',
            data: result.rows[0]
          }),
        };
      }

      // PUT 요청 - 조회수 증가
      if (method === 'PUT' && path.includes('/view/')) {
        const postId = path.split('/view/')[1];
        
        await client.query(`
          UPDATE board_posts 
          SET views_count = views_count + 1 
          WHERE id = $1
        `, [postId]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: '조회수가 업데이트되었습니다.'
          }),
        };
      }

      // DELETE 요청 - 게시글 삭제
      if (method === 'DELETE') {
        const { id, author_id } = body;
        
        if (!id || !author_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: '게시글 ID와 작성자 ID가 필요합니다.'
            }),
          };
        }

        // 작성자 확인
        const authorCheck = await client.query(`
          SELECT author_id FROM board_posts WHERE id = $1
        `, [id]);

        if (authorCheck.rows.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              message: '게시글을 찾을 수 없습니다.'
            }),
          };
        }

        if (authorCheck.rows[0].author_id !== author_id) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              message: '게시글 삭제 권한이 없습니다.'
            }),
          };
        }

        await client.query(`
          DELETE FROM board_posts WHERE id = $1 AND author_id = $2
        `, [id, author_id]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: '게시글이 성공적으로 삭제되었습니다.'
          }),
        };
      }

      // POST 요청 - 좋아요 토글
      if (method === 'POST' && path.includes('/like/')) {
        const postId = path.split('/like/')[1];
        const { user_id } = body;

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

        // 이미 좋아요를 눌렀는지 확인
        const existingLike = await client.query(`
          SELECT * FROM board_likes WHERE post_id = $1 AND user_id = $2
        `, [postId, user_id]);

        if (existingLike.rows.length > 0) {
          // 좋아요 취소
          await client.query(`
            DELETE FROM board_likes WHERE post_id = $1 AND user_id = $2
          `, [postId, user_id]);
          
          await client.query(`
            UPDATE board_posts SET likes_count = likes_count - 1 WHERE id = $1
          `, [postId]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: '좋아요가 취소되었습니다.',
              liked: false
            }),
          };
        } else {
          // 좋아요 추가
          await client.query(`
            INSERT INTO board_likes (post_id, user_id) VALUES ($1, $2)
          `, [postId, user_id]);
          
          await client.query(`
            UPDATE board_posts SET likes_count = likes_count + 1 WHERE id = $1
          `, [postId]);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: '좋아요가 추가되었습니다.',
              liked: true
            }),
          };
        }
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
    console.error('Board API error:', error);
    
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