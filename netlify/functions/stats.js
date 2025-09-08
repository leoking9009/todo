const { pool, createTables } = require('./db');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Success' })
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client;
  try {
    // 데이터베이스 테이블 초기화
    await createTables();
    
    client = await pool.connect();

  try {
    // 전체 통계
    const totalTasks = await client.query('SELECT COUNT(*) as count FROM tasks');
    const completedTasks = await client.query('SELECT COUNT(*) as count FROM tasks WHERE is_completed = true');
    const urgentTasks = await client.query('SELECT COUNT(*) as count FROM tasks WHERE is_urgent = true AND is_completed = false');
    
    // 담당자별 통계
    const assigneeStats = await client.query(`
      SELECT 
        assignee,
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN is_urgent = true AND is_completed = false THEN 1 END) as urgent_tasks
      FROM tasks 
      GROUP BY assignee
      ORDER BY total_tasks DESC
    `);

    const stats = {
      total: parseInt(totalTasks.rows[0].count),
      completed: parseInt(completedTasks.rows[0].count),
      urgent: parseInt(urgentTasks.rows[0].count),
      pending: parseInt(totalTasks.rows[0].count) - parseInt(completedTasks.rows[0].count),
      assignees: assigneeStats.rows
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats)
    };
  } catch (error) {
    console.error('Stats error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  } finally {
    if (client) {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Database connection failed',
        details: error.message
      })
    };
  }
};