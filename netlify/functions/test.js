const { Pool } = require('pg');

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

  try {
    const dbUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    
    if (!dbUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'No database URL found',
          availableEnvVars: Object.keys(process.env).filter(key => key.includes('DATABASE')).join(', ')
        })
      };
    }

    // Try to connect to database
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'Database connection successful',
          currentTime: result.rows[0].current_time,
          hasDbUrl: true,
          dbUrlPrefix: dbUrl.substring(0, 30) + '...'
        })
      };
    } finally {
      client.release();
      await pool.end();
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        availableEnvVars: Object.keys(process.env).filter(key => key.includes('DATABASE')).join(', ')
      })
    };
  }
};