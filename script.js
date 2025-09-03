const SUPABASE_URL = 'https://selrqyfkhqyyzoaqwdmd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbHJxeWZraHF5eXpvYXF3ZG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDYxNTMsImV4cCI6MjA3MjQ4MjE1M30.0HrBJFfsIDhfeEIDDwtbaq_s0qkAZXp0LVurGjwAqQ4';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function handleCredentialResponse(response) {
  const id_token = response.credential;
  const { data, error } = await _supabase.auth.signInWithIdToken({
    provider: 'google',
    token: id_token,
  });

  if (error) {
    console.error('Error signing in with Google:', error);
    return;
  }

  const user = data.user;
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';

  const userProfile = document.getElementById('user-profile');
  userProfile.innerHTML = `
    <img src="${user.user_metadata.picture}" alt="User profile picture">
    <p>Welcome, ${user.user_metadata.name}!</p>
  `;

  fetchTodos();
}

async function fetchTodos() {
  const { data: todos, error } = await _supabase.from('todos').select('*').order('id');

  if (error) {
    console.error('Error fetching todos:', error);
    return;
  }

  const taskList = document.getElementById('taskList');
  taskList.innerHTML = ''; // Clear existing list
  todos.forEach(todo => {
    const li = document.createElement('li');
    li.textContent = todo.task;
    li.dataset.id = todo.id;
    if (todo.is_completed) {
      li.classList.add('completed');
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button');

    li.appendChild(deleteButton);
    taskList.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logoutButton');
  logoutButton.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    google.accounts.id.disableAutoSelect();
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('app-container').style.display = 'none';
  });

  const addButton = document.getElementById('addButton');
  addButton.addEventListener('click', async () => {
    const taskInput = document.getElementById('taskInput');
    const taskText = taskInput.value.trim();
    if (taskText === '') return;

    const { data: { user } } = await _supabase.auth.getUser();

    const { error } = await _supabase.from('todos').insert({ task: taskText, user_id: user.id });

    if (error) {
      console.error('Error adding task:', error);
    } else {
      taskInput.value = '';
      fetchTodos();
    }
  });

  const taskList = document.getElementById('taskList');
  taskList.addEventListener('click', async (event) => {
    const li = event.target.closest('li');
    if (!li) return;

    const id = li.dataset.id;

    if (event.target.classList.contains('delete-button')) {
      const { error } = await _supabase.from('todos').delete().match({ id });
      if (error) {
        console.error('Error deleting task:', error);
      } else {
        fetchTodos();
      }
    } else {
      const is_completed = !li.classList.contains('completed');
      const { error } = await _supabase.from('todos').update({ is_completed }).match({ id });
      if (error) {
        console.error('Error updating task:', error);
      } else {
        fetchTodos();
      }
    }
  });

  // Check if user is already logged in
  _supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        const user = session.user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';

        const userProfile = document.getElementById('user-profile');
        userProfile.innerHTML = `
            <img src="${user.user_metadata.picture}" alt="User profile picture">
            <p>Welcome, ${user.user_metadata.name}!</p>
        `;

        fetchTodos();
    }
  });
});
