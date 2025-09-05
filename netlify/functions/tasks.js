const { pool } = require('./db');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Success' })
    };
  }

  const client = await pool.connect();

  try {
    switch (event.httpMethod) {
      case 'GET':
        const { rows } = await client.query(`
          SELECT * FROM tasks 
          ORDER BY 
            is_urgent DESC,
            created_date DESC
        `);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(rows)
        };

      case 'POST':
        const { assignee, task_name, is_urgent, submission_target, notes, user_id } = JSON.parse(event.body);
        const insertResult = await client.query(`
          INSERT INTO tasks (assignee, task_name, is_urgent, submission_target, notes, user_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [assignee, task_name, is_urgent || false, submission_target, notes, user_id]);
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(insertResult.rows[0])
        };

      case 'PUT':
        const taskId = event.path.split('/').pop();
        const updateData = JSON.parse(event.body);
        const updateResult = await client.query(`
          UPDATE tasks 
          SET assignee = COALESCE($1, assignee),
              task_name = COALESCE($2, task_name),
              is_urgent = COALESCE($3, is_urgent),
              is_completed = COALESCE($4, is_completed),
              submission_target = COALESCE($5, submission_target),
              notes = COALESCE($6, notes),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
          RETURNING *
        `, [
          updateData.assignee,
          updateData.task_name,
          updateData.is_urgent,
          updateData.is_completed,
          updateData.submission_target,
          updateData.notes,
          taskId
        ]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updateResult.rows[0])
        };

      case 'DELETE':
        const deleteId = event.path.split('/').pop();
        await client.query('DELETE FROM tasks WHERE id = $1', [deleteId]);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Task deleted successfully' })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  } finally {
    client.release();
  }
};