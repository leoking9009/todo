const { Pool } = require('pg');

// 환경변수에서 DATABASE_URL 읽기
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || "postgres://neon:npg@localhost:5432/<database_name>";

console.log('🔍 데이터베이스 연결 테스트 시작...');
console.log('📡 연결 URL:', DATABASE_URL.replace(/:[^:@]*@/, ':****@')); // 비밀번호 숨김

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('🚀 데이터베이스 연결 시도 중...');
    
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공!');
    
    // 기본 정보 확인
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('📊 데이터베이스 정보:');
    console.log('  - Version:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
    console.log('  - Database:', result.rows[0].current_database);
    console.log('  - User:', result.rows[0].current_user);
    
    // 테이블 생성 테스트
    console.log('\n🛠️  테이블 생성 중...');
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
        user_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ tasks 테이블 생성 성공!');
    
    // 테이블 확인
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 생성된 테이블 구조:');
    tableCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // 테스트 데이터 삽입
    console.log('\n📝 테스트 데이터 삽입 중...');
    const insertResult = await client.query(`
      INSERT INTO tasks (assignee, task_name, is_urgent, submission_target, notes, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, ['테스트담당자', '데이터베이스 연결 테스트', true, 'IT팀', '자동 생성된 테스트 데이터', 'test-user']);
    
    console.log('✅ 테스트 데이터 삽입 성공!');
    console.log('📄 삽입된 데이터:', {
      id: insertResult.rows[0].id,
      assignee: insertResult.rows[0].assignee,
      task_name: insertResult.rows[0].task_name,
      is_urgent: insertResult.rows[0].is_urgent,
      created_date: insertResult.rows[0].created_date
    });
    
    // 데이터 조회 테스트
    const selectResult = await client.query('SELECT COUNT(*) as count FROM tasks');
    console.log(`📊 현재 총 과제 수: ${selectResult.rows[0].count}개`);
    
    client.release();
    console.log('\n🎉 모든 데이터베이스 테스트 성공!');
    
  } catch (error) {
    console.error('\n❌ 데이터베이스 연결 실패:');
    console.error('🔍 에러 내용:', error.message);
    
    if (error.code) {
      console.error('📋 에러 코드:', error.code);
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 해결 방법:');
      console.error('1. 네트워크 연결 확인');
      console.error('2. DATABASE_URL이 올바른지 확인');
      console.error('3. Neon 데이터베이스가 활성 상태인지 확인');
    }
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 해결 방법:');
      console.error('1. 사용자명과 비밀번호 확인');
      console.error('2. Neon 콘솔에서 새 연결 문자열 생성');
    }
    
    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('\n💡 해결 방법:');
      console.error('1. 데이터베이스 이름 확인');
      console.error('2. Neon 콘솔에서 올바른 데이터베이스명 확인');
    }
    
  } finally {
    await pool.end();
    console.log('\n🔌 연결 종료');
  }
}

// 스크립트 실행
testConnection();