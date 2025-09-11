const { Pool } = require('pg');

// Neon PostgreSQL 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 데이터베이스 테이블 생성
const createTables = async () => {
  const client = await pool.connect();
  try {
    // 사용자 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        picture_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 업무(tasks) 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        assignee VARCHAR(100) NOT NULL,
        task_name VARCHAR(200) NOT NULL,
        is_urgent BOOLEAN DEFAULT FALSE,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_completed BOOLEAN DEFAULT FALSE,
        submission_target VARCHAR(100),
        notes TEXT,
        deadline DATE,
        user_id VARCHAR(100) NOT NULL,
        deadline TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables created successfully');
    return { success: true };
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Netlify Function handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Success' })
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      // 데이터베이스 연결 테스트
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Database connection successful',
          timestamp: new Date().toISOString(),
          server_time: result.rows[0].current_time
        })
      };
    }
    
    if (event.httpMethod === 'POST') {
      // 테이블 생성/초기화
      await createTables();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Database tables created successfully',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Database operation failed',
        details: error.message
      })
    };
  }
};

module.exports = { pool, createTables };