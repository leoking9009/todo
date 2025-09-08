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
    const dbUrl = process.env.DATABASE_URL;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Test function working',
        hasDbUrl: !!dbUrl,
        dbUrlStart: dbUrl ? dbUrl.substring(0, 20) + '...' : 'undefined',
        env: Object.keys(process.env).slice(0, 10)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};