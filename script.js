// 글로벌 변수
let currentUser = null;
let allTasks = [];
let currentTab = 'add';

// API 베이스 URL (Netlify Functions)
const API_BASE = '/.netlify/functions';

// 구글 로그인 처리
async function handleCredentialResponse(response) {
  try {
    const idToken = response.credential;
    
    // JWT 토큰 디코딩 (간단한 파싱)
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    
    currentUser = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture
    };

    // 로그인 성공 처리
    showApp();
    await loadDashboard();
    
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    alert('로그인 중 문제가 발생했습니다.');
  }
}

// 앱 화면 표시
function showApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  
  // 사용자 프로필 업데이트
  const userProfile = document.getElementById('user-profile');
  userProfile.innerHTML = `
    <img src="${currentUser.picture}" alt="프로필 사진">
    <p>${currentUser.name}님 환영합니다!</p>
  `;
}

// 로그아웃 처리
function logout() {
  currentUser = null;
  allTasks = [];
  document.getElementById('login-container').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
  
  // 구글 로그인 상태 초기화
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
}

// 대시보드 로드
async function loadDashboard() {
  try {
    // 통계 데이터 가져오기
    const statsResponse = await fetch(`${API_BASE}/stats`);
    const stats = await statsResponse.json();
    
    // 통계 업데이트
    document.getElementById('totalTasks').textContent = stats.total;
    document.getElementById('completedTasks').textContent = stats.completed;
    document.getElementById('pendingTasks').textContent = stats.pending;
    document.getElementById('urgentTasks').textContent = stats.urgent;
    
    // 모든 과제 데이터 가져오기
    await loadTasks();
    
  } catch (error) {
    console.error('대시보드 로드 오류:', error);
  }
}

// 모든 과제 데이터 로드
async function loadTasks() {
  try {
    const response = await fetch(`${API_BASE}/tasks`);
    allTasks = await response.json();
    
    // 현재 활성 탭에 따라 데이터 표시
    refreshCurrentTab();
    
  } catch (error) {
    console.error('과제 로드 오류:', error);
  }
}

// 현재 탭 새로고침
function refreshCurrentTab() {
  switch (currentTab) {
    case 'all':
      renderTaskList(allTasks, 'taskList');
      break;
    case 'completed':
      renderTaskList(allTasks.filter(task => task.is_completed), 'completedTaskList');
      break;
    case 'urgent':
      renderTaskList(allTasks.filter(task => task.is_urgent && !task.is_completed), 'urgentTaskList');
      break;
    case 'assignee':
      renderAssigneeView();
      break;
  }
}

// 과제 목록 렌더링
function renderTaskList(tasks, containerId) {
  const container = document.getElementById(containerId);
  
  if (tasks.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">표시할 과제가 없습니다.</p>';
    return;
  }
  
  container.innerHTML = tasks.map(task => `
    <div class="task-card ${task.is_urgent ? 'urgent' : ''} ${task.is_completed ? 'completed' : ''}" data-id="${task.id}">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(task.task_name)}</h3>
        <div class="task-badges">
          ${task.is_urgent ? '<span class="badge urgent">긴급</span>' : ''}
          ${task.is_completed ? '<span class="badge completed">완료</span>' : ''}
        </div>
      </div>
      
      <div class="task-info">
        <p><strong>담당자:</strong> ${escapeHtml(task.assignee)}</p>
        <p><strong>생성일:</strong> ${formatDate(task.created_date)}</p>
        ${task.submission_target ? `<p><strong>제출처:</strong> ${escapeHtml(task.submission_target)}</p>` : ''}
        ${task.notes ? `<p><strong>비고:</strong> ${escapeHtml(task.notes)}</p>` : ''}
      </div>
      
      <div class="task-actions">
        ${!task.is_completed ? 
          '<button class="btn-action btn-complete" onclick="toggleTaskComplete(' + task.id + ')">완료</button>' :
          '<button class="btn-action btn-undo" onclick="toggleTaskComplete(' + task.id + ')">완료취소</button>'
        }
        <button class="btn-action btn-delete" onclick="deleteTask(${task.id})">삭제</button>
      </div>
    </div>
  `).join('');
}

// 담당자별 뷰 렌더링
function renderAssigneeView() {
  const statsContainer = document.getElementById('assigneeStats');
  
  // 담당자별 통계 계산
  const assigneeMap = new Map();
  
  allTasks.forEach(task => {
    if (!assigneeMap.has(task.assignee)) {
      assigneeMap.set(task.assignee, {
        name: task.assignee,
        total: 0,
        completed: 0,
        urgent: 0,
        tasks: []
      });
    }
    
    const assignee = assigneeMap.get(task.assignee);
    assignee.total++;
    if (task.is_completed) assignee.completed++;
    if (task.is_urgent && !task.is_completed) assignee.urgent++;
    assignee.tasks.push(task);
  });
  
  // 담당자 카드 렌더링
  statsContainer.innerHTML = Array.from(assigneeMap.values()).map(assignee => `
    <div class="assignee-card" onclick="showAssigneeDetails('${assignee.name}')">
      <div class="assignee-name">${escapeHtml(assignee.name)}</div>
      <div class="assignee-stat">
        <span class="label">전체 과제</span>
        <span class="value">${assignee.total}개</span>
      </div>
      <div class="assignee-stat">
        <span class="label">완료 과제</span>
        <span class="value">${assignee.completed}개</span>
      </div>
      <div class="assignee-stat">
        <span class="label">진행 중</span>
        <span class="value">${assignee.total - assignee.completed}개</span>
      </div>
      <div class="assignee-stat">
        <span class="label">긴급 과제</span>
        <span class="value">${assignee.urgent}개</span>
      </div>
    </div>
  `).join('');
  
  // 세부사항 컨테이너 초기화
  document.getElementById('assigneeDetails').innerHTML = '<p style="text-align: center; color: #666;">담당자를 선택하여 상세 정보를 확인하세요.</p>';
}

// 담당자 세부사항 표시
function showAssigneeDetails(assigneeName) {
  const assigneeTasks = allTasks.filter(task => task.assignee === assigneeName);
  const container = document.getElementById('assigneeDetails');
  
  container.innerHTML = `
    <h3>${escapeHtml(assigneeName)}의 과제 목록</h3>
    <div class="task-grid">
      ${assigneeTasks.map(task => `
        <div class="task-card ${task.is_urgent ? 'urgent' : ''} ${task.is_completed ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-header">
            <h4 class="task-title">${escapeHtml(task.task_name)}</h4>
            <div class="task-badges">
              ${task.is_urgent ? '<span class="badge urgent">긴급</span>' : ''}
              ${task.is_completed ? '<span class="badge completed">완료</span>' : ''}
            </div>
          </div>
          
          <div class="task-info">
            <p><strong>생성일:</strong> ${formatDate(task.created_date)}</p>
            ${task.submission_target ? `<p><strong>제출처:</strong> ${escapeHtml(task.submission_target)}</p>` : ''}
            ${task.notes ? `<p><strong>비고:</strong> ${escapeHtml(task.notes)}</p>` : ''}
          </div>
          
          <div class="task-actions">
            ${!task.is_completed ? 
              '<button class="btn-action btn-complete" onclick="toggleTaskComplete(' + task.id + ')">완료</button>' :
              '<button class="btn-action btn-undo" onclick="toggleTaskComplete(' + task.id + ')">완료취소</button>'
            }
            <button class="btn-action btn-delete" onclick="deleteTask(${task.id})">삭제</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 새 과제 등록
async function submitTask(event) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(event.target);
  const taskData = {
    assignee: formData.get('assignee').trim(),
    task_name: formData.get('taskName').trim(),
    is_urgent: formData.get('isUrgent') === 'on',
    submission_target: formData.get('submissionTarget').trim() || null,
    notes: formData.get('notes').trim() || null,
    user_id: currentUser.id
  };
  
  // 유효성 검사
  if (!taskData.assignee || !taskData.task_name) {
    alert('담당자와 과제명은 필수 입력 항목입니다.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData)
    });
    
    if (response.ok) {
      // 폼 초기화
      event.target.reset();
      
      // 데이터 새로고침
      await loadDashboard();
      
      alert('과제가 성공적으로 등록되었습니다!');
    } else {
      throw new Error('과제 등록에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('과제 등록 오류:', error);
    alert('과제 등록 중 오류가 발생했습니다.');
  }
}

// 과제 완료 상태 토글
async function toggleTaskComplete(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_completed: !task.is_completed
      })
    });
    
    if (response.ok) {
      await loadDashboard();
    } else {
      throw new Error('과제 상태 업데이트에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('과제 상태 업데이트 오류:', error);
    alert('과제 상태 업데이트 중 오류가 발생했습니다.');
  }
}

// 과제 삭제
async function deleteTask(taskId) {
  if (!confirm('정말로 이 과제를 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadDashboard();
    } else {
      throw new Error('과제 삭제에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('과제 삭제 오류:', error);
    alert('과제 삭제 중 오류가 발생했습니다.');
  }
}

// 탭 전환
function switchTab(tabName) {
  // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // 선택된 탭 활성화
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  currentTab = tabName;
  refreshCurrentTab();
}

// 유틸리티 함수들
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
  // 로그아웃 버튼
  document.getElementById('logoutButton').addEventListener('click', logout);
  
  // 과제 등록 폼
  document.getElementById('taskForm').addEventListener('submit', submitTask);
  
  // 탭 버튼들
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // 자동 새로고침 (30초마다)
  setInterval(async () => {
    if (currentUser) {
      await loadDashboard();
    }
  }, 30000);
});

// 전역 함수로 노출 (HTML에서 사용)
window.handleCredentialResponse = handleCredentialResponse;
window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.showAssigneeDetails = showAssigneeDetails;