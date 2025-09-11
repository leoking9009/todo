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
    case 'today':
      renderTaskList(getTodayTasks(), 'todayTaskList');
      break;
    case 'past':
      renderTaskList(getPastTasks(), 'pastTaskList');
      break;
    case 'upcoming':
      renderTaskList(getUpcomingTasks(), 'upcomingTaskList');
      break;
    case 'completed':
      renderTaskList(allTasks.filter(task => task.is_completed), 'completedTaskList');
      break;
    case 'urgent':
      renderTaskList(allTasks.filter(task => task.is_urgent), 'urgentTaskList');
      break;
    case 'assignee':
      renderAssigneeView();
      break;
    case 'calendar':
      renderCalendar();
      break;
    case 'board':
      loadBoardPosts(currentBoardCategory, '', currentBoardPage);
      setupBoardEventListeners(); // 게시판 탭이 활성화될 때마다 이벤트 리스너 설정
      break;
    case 'todo':
      loadTodos();
      setupTodoEventListeners(); // TODO 탭이 활성화될 때마다 이벤트 리스너 설정
      break;
  }
}

// 과제 목록 렌더링 (카드형 또는 테이블형)
function renderTaskList(tasks, containerId, viewType = 'grid') {
  const container = document.getElementById(containerId);
  
  if (tasks.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">표시할 과제가 없습니다.</p>';
    return;
  }
  
  // 보기 형태에 따라 다른 렌더링
  if (viewType === 'table') {
    renderTaskTable(tasks, containerId);
  } else {
    renderTaskGrid(tasks, containerId);
  }
}

// 카드형 보기 렌더링
function renderTaskGrid(tasks, containerId) {
  const container = document.getElementById(containerId);
  container.className = 'task-grid';
  
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
        ${task.deadline ? `<p><strong>마감기한:</strong> ${formatDate(task.deadline)} ${getDeadlineStatus(task.deadline)}</p>` : ''}
        ${task.submission_target ? `<p><strong>제출처:</strong> ${escapeHtml(task.submission_target)}</p>` : ''}
        ${task.notes ? `<p><strong>비고:</strong> ${escapeHtml(task.notes)}</p>` : ''}
      </div>
      
      <div class="task-actions">
        ${!task.is_completed ? 
          `<button class="btn-action btn-complete" onclick="toggleTaskComplete(${task.id})">완료</button>` :
          `<button class="btn-action btn-undo" onclick="toggleTaskComplete(${task.id})">완료취소</button>`
        }
        <button class="btn-action btn-edit" onclick="openEditModal(${task.id})">수정</button>
        <button class="btn-action btn-delete" onclick="deleteTask(${task.id})">삭제</button>
      </div>
    </div>
  `).join('');
}

// 테이블형 보기 렌더링
function renderTaskTable(tasks, containerId) {
  const container = document.getElementById(containerId);
  container.className = 'task-table-container';
  
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="task-table">
        <thead>
          <tr>
            <th>상태</th>
            <th>과제명</th>
            <th>담당자</th>
            <th>마감기한</th>
            <th>제출처</th>
            <th>생성일</th>
            <th>비고</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(task => `
            <tr class="task-row ${task.is_urgent ? 'urgent' : ''} ${task.is_completed ? 'completed' : ''}" data-id="${task.id}">
              <td class="status-cell">
                <div class="status-badges">
                  ${task.is_completed ? '<span class="badge completed">✓ 완료</span>' : ''}
                  ${task.is_urgent && !task.is_completed ? '<span class="badge urgent">긴급</span>' : ''}
                  ${task.deadline ? getDeadlineStatus(task.deadline) : ''}
                </div>
              </td>
              <td class="task-name-cell">
                <strong>${escapeHtml(task.task_name)}</strong>
              </td>
              <td>${escapeHtml(task.assignee)}</td>
              <td class="deadline-cell">
                ${task.deadline ? formatDate(task.deadline) : '-'}
              </td>
              <td>${task.submission_target ? escapeHtml(task.submission_target) : '-'}</td>
              <td class="created-cell">${formatDate(task.created_date)}</td>
              <td class="notes-cell" title="${task.notes ? escapeHtml(task.notes) : ''}">
                ${task.notes ? (task.notes.length > 30 ? escapeHtml(task.notes).substring(0, 30) + '...' : escapeHtml(task.notes)) : '-'}
              </td>
              <td class="actions-cell">
                <div class="table-actions">
                  ${!task.is_completed ? 
                    `<button class="btn-action btn-complete btn-sm" onclick="toggleTaskComplete(${task.id})" title="완료">✓</button>` :
                    `<button class="btn-action btn-undo btn-sm" onclick="toggleTaskComplete(${task.id})" title="완료취소">↺</button>`
                  }
                  <button class="btn-action btn-edit btn-sm" onclick="openEditModal(${task.id})" title="수정">✎</button>
                  <button class="btn-action btn-delete btn-sm" onclick="deleteTask(${task.id})" title="삭제">✖</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
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
    <div class="assignee-details-header">
      <h3>${escapeHtml(assigneeName)}의 과제 목록</h3>
      <div class="view-toggle">
        <button class="view-btn active" onclick="toggleAssigneeView('card', this)" data-view="card">카드 보기</button>
        <button class="view-btn" onclick="toggleAssigneeView('table', this)" data-view="table">행형 보기</button>
      </div>
    </div>
    
    <div id="assigneeTasksCard" class="task-grid">
      ${assigneeTasks.map(task => `
        <div class="task-card ${task.is_urgent ? 'urgent' : ''} ${task.is_completed ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-header">
            <h4 class="task-title">${escapeHtml(task.task_name)}</h4>
            <div class="task-badges">
              ${task.is_urgent ? '<span class="badge urgent">긴급</span>' : ''}
              ${task.is_completed ? '<span class="badge completed">완료</span>' : ''}
              ${getDateBadge(task.deadline)}
            </div>
          </div>
          
          <div class="task-info">
            <p><strong>생성일:</strong> ${formatDate(task.created_date)}</p>
            <p><strong>마감기한:</strong> ${formatDate(task.deadline)}</p>
            ${task.submission_target ? `<p><strong>제출처:</strong> ${escapeHtml(task.submission_target)}</p>` : ''}
            ${task.notes ? `<p><strong>비고:</strong> ${escapeHtml(task.notes)}</p>` : ''}
          </div>
          
          <div class="task-actions">
            ${!task.is_completed ? 
              `<button class="btn-action btn-complete" onclick="toggleTaskComplete(${task.id})">완료</button>` :
              `<button class="btn-action btn-undo" onclick="toggleTaskComplete(${task.id})">완료취소</button>`
            }
            <button class="btn-action btn-edit" onclick="openEditModal(${task.id})">수정</button>
            <button class="btn-action btn-delete" onclick="deleteTask(${task.id})">삭제</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div id="assigneeTasksTable" class="table-container" style="display: none;">
      <table class="task-table">
        <thead>
          <tr>
            <th>과제명</th>
            <th>마감기한</th>
            <th>상태</th>
            <th>긴급</th>
            <th>제출처</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          ${assigneeTasks.map(task => `
            <tr class="${task.is_completed ? 'completed' : ''}" data-id="${task.id}">
              <td class="task-name-cell">
                ${escapeHtml(task.task_name)}
                ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
              </td>
              <td class="deadline-cell">
                ${formatDate(task.deadline)}
                ${getDateBadge(task.deadline)}
              </td>
              <td class="status-cell">
                <span class="status-badge ${task.is_completed ? 'completed' : 'pending'}">
                  ${task.is_completed ? '완료' : '진행중'}
                </span>
              </td>
              <td class="urgent-cell">
                ${task.is_urgent ? '<span class="urgent-badge">긴급</span>' : ''}
              </td>
              <td class="target-cell">
                ${escapeHtml(task.submission_target || '')}
              </td>
              <td class="actions-cell">
                <div class="action-buttons">
                  ${!task.is_completed ? 
                    `<button class="btn-action btn-complete btn-sm" onclick="toggleTaskComplete(${task.id})" title="완료">✓</button>` :
                    `<button class="btn-action btn-undo btn-sm" onclick="toggleTaskComplete(${task.id})" title="완료취소">↶</button>`
                  }
                  <button class="btn-action btn-edit btn-sm" onclick="openEditModal(${task.id})" title="수정">✎</button>
                  <button class="btn-action btn-delete btn-sm" onclick="deleteTask(${task.id})" title="삭제">✕</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
    deadline: formData.get('deadline'),
    user_id: currentUser.id
  };
  
  // 유효성 검사
  if (!taskData.assignee || !taskData.task_name || !taskData.deadline) {
    alert('담당자, 과제명, 마감기한은 필수 입력 항목입니다.');
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

// 대시보드 통계 카드에서 탭으로 이동
function navigateToTab(tabName) {
  // 대시보드의 카드 클릭 효과 추가
  const clickedCard = document.querySelector(`[data-tab="${tabName}"]`);
  if (clickedCard) {
    clickedCard.style.transform = 'scale(0.95)';
    setTimeout(() => {
      clickedCard.style.transform = 'scale(1)';
    }, 150);
  }
  
  // 탭 전환
  switchTab(tabName);
  
  // 탭이 전환되었음을 사용자에게 알려주는 시각적 피드백
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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

// 보기 전환 기능
function switchView(viewType, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // 현재 탭에 맞는 데이터 가져오기
  let tasks = [];
  switch(currentTab) {
    case 'all':
      tasks = allTasks;
      break;
    case 'today':
      tasks = getTodayTasks();
      break;
    case 'past':
      tasks = getPastTasks();
      break;
    case 'upcoming':
      tasks = getUpcomingTasks();
      break;
    case 'completed':
      tasks = allTasks.filter(task => task.is_completed);
      break;
    case 'urgent':
      tasks = allTasks.filter(task => task.is_urgent);
      break;
  }
  
  // 보기 타입에 따라 렌더링
  renderTaskList(tasks, containerId, viewType);
  
  // 버튼 상태 업데이트
  const viewControls = container.closest('.task-list-container').querySelector('.view-controls');
  if (viewControls) {
    viewControls.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === viewType) {
        btn.classList.add('active');
      }
    });
  }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
  // 로그아웃 버튼
  document.getElementById('logoutButton').addEventListener('click', logout);
  
  // 과제 등록 폼
  document.getElementById('taskForm').addEventListener('submit', submitTask);
  
  // 과제 수정 폼
  document.getElementById('editTaskForm').addEventListener('submit', submitEditTask);
  
  // 모달 배경 클릭시 닫기
  document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeEditModal();
    }
  });
  
  // 탭 버튼들
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // 보기 전환 버튼들
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('view-btn')) {
      const viewType = e.target.dataset.view;
      const targetId = e.target.dataset.target;
      switchView(viewType, targetId);
    }
  });
  
  // 자동 새로고침 (30초마다)
  setInterval(async () => {
    if (currentUser) {
      await loadDashboard();
    }
  }, 30000);
});

// 마감기한 기반 날짜별 필터링 함수들
function getTodayTasks() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  return allTasks.filter(task => {
    if (!task.deadline) return false;
    const deadlineStr = new Date(task.deadline).toISOString().split('T')[0];
    return deadlineStr === todayStr;
  });
}

function getPastTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return allTasks.filter(task => {
    if (!task.deadline) return false;
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today && !task.is_completed;
  });
}

function getUpcomingTasks() {
  const today = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(today.getDate() + 7);
  today.setHours(0, 0, 0, 0);
  sevenDaysLater.setHours(23, 59, 59, 999);
  
  return allTasks.filter(task => {
    if (!task.deadline || task.is_completed) return false;
    const deadlineDate = new Date(task.deadline);
    return deadlineDate >= today && deadlineDate <= sevenDaysLater;
  });
}

// 과제 수정 관련 함수들
function openEditModal(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  
  // 모달에 현재 값들 설정
  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editAssignee').value = task.assignee;
  document.getElementById('editTaskName').value = task.task_name;
  document.getElementById('editSubmissionTarget').value = task.submission_target || '';
  document.getElementById('editDeadline').value = task.deadline || '';
  document.getElementById('editIsUrgent').checked = task.is_urgent;
  document.getElementById('editNotes').value = task.notes || '';
  
  // 모달 표시
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editTaskForm').reset();
}

async function submitEditTask(event) {
  event.preventDefault();
  
  const taskId = document.getElementById('editTaskId').value;
  const formData = new FormData(event.target);
  
  const taskData = {
    assignee: formData.get('assignee').trim(),
    task_name: formData.get('taskName').trim(),
    is_urgent: formData.get('isUrgent') === 'on',
    submission_target: formData.get('submissionTarget').trim() || null,
    notes: formData.get('notes').trim() || null,
    deadline: formData.get('deadline')
  };
  
  // 유효성 검사
  if (!taskData.assignee || !taskData.task_name || !taskData.deadline) {
    alert('담당자, 과제명, 마감기한은 필수 입력 항목입니다.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData)
    });
    
    if (response.ok) {
      closeEditModal();
      await loadDashboard();
      alert('과제가 성공적으로 수정되었습니다!');
    } else {
      throw new Error('과제 수정에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('과제 수정 오류:', error);
    alert('과제 수정 중 오류가 발생했습니다.');
  }
}

// 날짜 뱃지 생성 함수
function getDateBadge(taskDate) {
  const today = new Date();
  const task = new Date(taskDate);
  const diffTime = task - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '<span class="date-badge today">오늘</span>';
  } else if (diffDays < 0) {
    return '<span class="date-badge past">지난</span>';
  } else if (diffDays <= 7) {
    return '<span class="date-badge upcoming">곧</span>';
  }
  return '';
}

// 마감기한 상태 표시 함수
function getDeadlineStatus(deadline) {
  if (!deadline) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return '<span class="deadline-status overdue">⚠️ 지연</span>';
  } else if (diffDays === 0) {
    return '<span class="deadline-status today">🔥 오늘</span>';
  } else if (diffDays === 1) {
    return '<span class="deadline-status tomorrow">⏰ 내일</span>';
  } else if (diffDays <= 3) {
    return '<span class="deadline-status soon">📅 곧</span>';
  }
  return '';
}


// 달력 관련 변수
let currentCalendarDate = new Date();

// 달력 렌더링 함수
function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  // 달력 제목 업데이트
  document.getElementById('calendarTitle').textContent = `${year}년 ${month + 1}월`;
  
  // 달력 날짜 생성
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const calendarDates = document.getElementById('calendarDates');
  calendarDates.innerHTML = '';
  
  // 6주 * 7일 = 42일 생성
  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dateElement = createCalendarDate(currentDate, month);
    calendarDates.appendChild(dateElement);
  }
}

// 달력 날짜 셀 생성
function createCalendarDate(date, currentMonth) {
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-date';
  
  const isCurrentMonth = date.getMonth() === currentMonth;
  const isToday = isDateToday(date);
  
  if (!isCurrentMonth) {
    dateDiv.classList.add('other-month');
  }
  if (isToday) {
    dateDiv.classList.add('today');
  }
  
  // 날짜 숫자
  const dateNumber = document.createElement('div');
  dateNumber.className = 'date-number';
  dateNumber.textContent = date.getDate();
  dateDiv.appendChild(dateNumber);
  
  // 해당 날짜의 과제들 찾기
  const tasksForDate = getTasksForDate(date);
  
  if (tasksForDate.length > 0) {
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'calendar-tasks';
    
    tasksForDate.forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'calendar-task';
      
      // 과제 상태에 따른 클래스 추가 (우선순위: 완료 > 긴급 > 마감상태)
      if (task.is_completed) {
        taskElement.classList.add('completed');
      } else if (task.is_urgent) {
        taskElement.classList.add('urgent');
      } else {
        // 마감기한 상태별 색상 분류
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const currentDateCheck = new Date(date);
        currentDateCheck.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
          taskElement.classList.add('overdue'); // 지연된 과제
        } else if (deadlineDate.getTime() === today.getTime()) {
          taskElement.classList.add('today'); // 오늘 마감
        } else {
          taskElement.classList.add('upcoming'); // 예정된 과제
        }
      }
      
      taskElement.textContent = task.task_name;
      taskElement.title = `담당자: ${task.assignee}\n과제: ${task.task_name}`;
      
      // 클릭 시 과제 상세 정보 표시
      taskElement.addEventListener('click', () => showTaskDetail(task));
      
      tasksContainer.appendChild(taskElement);
    });
    
    dateDiv.appendChild(tasksContainer);
  }
  
  return dateDiv;
}

// 특정 날짜의 과제들 반환
function getTasksForDate(date) {
  const dateStr = date.toISOString().split('T')[0];
  
  return allTasks.filter(task => {
    if (!task.deadline) return false;
    const taskDeadline = new Date(task.deadline).toISOString().split('T')[0];
    return taskDeadline === dateStr;
  });
}

// 날짜가 오늘인지 확인
function isDateToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// 달력용 마감기한 상태 반환 (개선된 색상 분류)
function getCalendarDeadlineStatus(deadline, currentDate) {
  if (!deadline) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(currentDate);
  checkDate.setHours(0, 0, 0, 0);
  
  if (deadlineDate < today) {
    return 'overdue';
  } else if (deadlineDate.getTime() === today.getTime()) {
    return 'today';
  } else {
    return 'upcoming';
  }
}

// 과제 상세 정보 표시 (간단한 알림)
function showTaskDetail(task) {
  const status = task.is_completed ? '완료' : '진행 중';
  const urgent = task.is_urgent ? ' (긴급)' : '';
  const deadline = task.deadline ? `\n마감: ${formatDate(task.deadline)}` : '';
  const notes = task.notes ? `\n비고: ${task.notes}` : '';
  
  alert(`[${status}${urgent}] ${task.task_name}\n담당자: ${task.assignee}${deadline}${notes}`);
}

// 달력 네비게이션 함수들
function goToPreviousMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar();
}

function goToNextMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar();
}

// 달력 네비게이션 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
  // 기존 이벤트 리스너들...
  
  // 달력 네비게이션
  document.getElementById('prevMonth')?.addEventListener('click', goToPreviousMonth);
  document.getElementById('nextMonth')?.addEventListener('click', goToNextMonth);
});

// 담당자별 뷰 토글 함수
function toggleAssigneeView(viewType, buttonElement) {
  const cardView = document.getElementById('assigneeTasksCard');
  const tableView = document.getElementById('assigneeTasksTable');
  const buttons = document.querySelectorAll('.view-btn');
  
  // 모든 버튼 비활성화
  buttons.forEach(btn => btn.classList.remove('active'));
  
  // 클릭된 버튼 활성화
  buttonElement.classList.add('active');
  
  if (viewType === 'card') {
    cardView.style.display = 'grid';
    tableView.style.display = 'none';
  } else {
    cardView.style.display = 'none';
    tableView.style.display = 'block';
  }
}

// 게시판 관련 변수
let boardPosts = [];
let currentBoardCategory = 'all';
let currentBoardPage = 1;

// TODO 관련 변수
let todos = [];
let currentTodoFilter = 'all';

// 게시판 로드 함수
async function loadBoardPosts(category = 'all', search = '', page = 1) {
  try {
    const queryParams = new URLSearchParams({
      category,
      search,
      page: page.toString(),
      limit: '10'
    });

    const response = await fetch(`${API_BASE}/board?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      boardPosts = result.data;
      renderBoardPosts();
    } else {
      console.error('게시글 로드 실패:', result.message);
    }
  } catch (error) {
    console.error('게시글 로드 중 오류:', error);
  }
}

// 게시판 게시글 렌더링
function renderBoardPosts() {
  const postsContainer = document.getElementById('board-posts');
  
  if (boardPosts.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comments"></i>
        <h3>게시글이 없습니다</h3>
        <p>첫 번째 게시글을 작성해보세요!</p>
      </div>
    `;
    return;
  }

  postsContainer.innerHTML = boardPosts.map(post => {
    const createdAt = new Date(post.created_at);
    const timeAgo = getTimeAgo(createdAt);
    
    // 카테고리별 태그 스타일
    const categoryClass = {
      'announcement': 'announcement',
      'question': 'question',
      'free': 'free',
      'suggestion': 'suggestion'
    }[post.category] || '';

    const urgentTag = post.is_urgent ? '<span class="tag urgent">긴급</span>' : '';
    const authorInitial = post.author_name ? post.author_name.charAt(0) : '?';

    return `
      <div class="post-card">
        <div class="post-header">
          <div>
            <h3 class="post-title">${escapeHtml(post.title)}</h3>
            <div class="post-meta">
              <div class="post-author">
                <div class="avatar">${authorInitial}</div>
                ${escapeHtml(post.author_name)}
              </div>
              <span><i class="fas fa-clock"></i> ${timeAgo}</span>
              <span><i class="fas fa-eye"></i> ${post.views_count || 0}</span>
            </div>
          </div>
        </div>
        
        <div class="post-tags">
          <span class="tag ${categoryClass}">${getCategoryName(post.category)}</span>
          ${urgentTag}
        </div>
        
        <div class="post-content">${escapeHtml(post.content.substring(0, 200))}${post.content.length > 200 ? '...' : ''}</div>
        
        <div class="post-actions">
          <div class="action-buttons">
            <button class="action-btn" onclick="togglePostLike(${post.id})">
              <i class="fas fa-heart"></i>
              좋아요 ${post.likes_count || 0}
            </button>
            <button class="action-btn">
              <i class="fas fa-comment"></i>
              댓글 ${post.comments_count || 0}
            </button>
            <button class="action-btn">
              <i class="fas fa-share"></i>
              공유
            </button>
            ${currentUser && currentUser.id === post.author_id ? `
              <button class="action-btn edit-btn" onclick="openEditPostModal(${post.id})">
                <i class="fas fa-edit"></i>
                수정
              </button>
              <button class="action-btn delete-btn" onclick="deletePost(${post.id})">
                <i class="fas fa-trash"></i>
                삭제
              </button>
            ` : ''}
          </div>
          <div class="post-stats">
            댓글 ${post.comments_count || 0}개 • 좋아요 ${post.likes_count || 0}개
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 게시글 좋아요 토글
async function togglePostLike(postId) {
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/board/like/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 게시글 목록 다시 로드
      await loadBoardPosts(currentBoardCategory, '', currentBoardPage);
    } else {
      alert('좋아요 처리 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('좋아요 처리 중 오류:', error);
    alert('좋아요 처리 중 오류가 발생했습니다.');
  }
}

// 새 게시글 작성
async function createBoardPost(postData) {
  try {
    const response = await fetch(`${API_BASE}/board`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...postData,
        author_name: currentUser.name,
        author_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 모달 닫기
      document.getElementById('post-modal').style.display = 'none';
      
      // 폼 리셋
      document.getElementById('post-form').reset();
      
      // 게시글 목록 다시 로드
      await loadBoardPosts(currentBoardCategory, '', currentBoardPage);
      
      alert('게시글이 성공적으로 작성되었습니다!');
    } else {
      alert('게시글 작성 중 오류가 발생했습니다: ' + result.message);
    }
  } catch (error) {
    console.error('게시글 작성 중 오류:', error);
    alert('게시글 작성 중 오류가 발생했습니다.');
  }
}

// 게시글 수정 모달 열기
function openEditPostModal(postId) {
  const post = boardPosts.find(p => p.id === postId);
  if (!post) {
    alert('게시글을 찾을 수 없습니다.');
    return;
  }

  // 작성자 확인
  if (currentUser.id !== post.author_id) {
    alert('게시글 수정 권한이 없습니다.');
    return;
  }

  // 폼에 기존 데이터 채우기
  document.getElementById('edit-post-id').value = post.id;
  document.getElementById('edit-post-title').value = post.title;
  document.getElementById('edit-post-category').value = post.category;
  document.getElementById('edit-post-content').value = post.content;
  document.getElementById('edit-post-urgent').checked = post.is_urgent;

  // 모달 표시
  document.getElementById('edit-post-modal').style.display = 'block';
}

// 게시글 수정
async function updateBoardPost(postData) {
  try {
    const response = await fetch(`${API_BASE}/board`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...postData,
        author_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 모달 닫기
      document.getElementById('edit-post-modal').style.display = 'none';
      
      // 폼 리셋
      document.getElementById('edit-post-form').reset();
      
      // 게시글 목록 다시 로드
      await loadBoardPosts(currentBoardCategory, '', currentBoardPage);
      
      alert('게시글이 성공적으로 수정되었습니다!');
    } else {
      alert('게시글 수정 중 오류가 발생했습니다: ' + result.message);
    }
  } catch (error) {
    console.error('게시글 수정 중 오류:', error);
    alert('게시글 수정 중 오류가 발생했습니다.');
  }
}

// 게시글 삭제
async function deletePost(postId) {
  if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
    return;
  }

  const post = boardPosts.find(p => p.id === postId);
  if (!post) {
    alert('게시글을 찾을 수 없습니다.');
    return;
  }

  // 작성자 확인
  if (currentUser.id !== post.author_id) {
    alert('게시글 삭제 권한이 없습니다.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/board`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: postId,
        author_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 게시글 목록 다시 로드
      await loadBoardPosts(currentBoardCategory, '', currentBoardPage);
      
      alert('게시글이 성공적으로 삭제되었습니다!');
    } else {
      alert('게시글 삭제 중 오류가 발생했습니다: ' + result.message);
    }
  } catch (error) {
    console.error('게시글 삭제 중 오류:', error);
    alert('게시글 삭제 중 오류가 발생했습니다.');
  }
}

// 유틸리티 함수들
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`;
  } else if (diffInHours < 24) {
    return `${diffInHours}시간 전`;
  } else {
    return `${diffInDays}일 전`;
  }
}

function getCategoryName(category) {
  const categoryNames = {
    'announcement': '공지',
    'question': '질문',
    'free': '자유',
    'suggestion': '제안'
  };
  return categoryNames[category] || category;
}

// 게시판 이벤트 리스너 설정
function setupBoardEventListeners() {
  // 잠시 기다린 후 DOM 요소들이 렌더링되면 이벤트 리스너 설정
  setTimeout(() => {
    // 카테고리 필터 버튼들
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
      // 기존 이벤트 리스너 제거 후 추가 (중복 방지)
      btn.removeEventListener('click', handleCategoryClick);
      btn.addEventListener('click', handleCategoryClick);
    });

    // 검색 기능
    const searchInput = document.getElementById('board-search');
    if (searchInput) {
      searchInput.removeEventListener('input', handleBoardSearch);
      searchInput.addEventListener('input', handleBoardSearch);
    }

    // 새 글 작성 버튼
    const newPostBtn = document.getElementById('new-post-btn');
    if (newPostBtn) {
      newPostBtn.removeEventListener('click', handleNewPostClick);
      newPostBtn.addEventListener('click', handleNewPostClick);
    }

    // 모달 닫기 버튼들
    const closeModalBtn = document.getElementById('close-modal');
    const cancelPostBtn = document.getElementById('cancel-post');
    
    if (closeModalBtn) {
      closeModalBtn.removeEventListener('click', handleModalClose);
      closeModalBtn.addEventListener('click', handleModalClose);
    }
    
    if (cancelPostBtn) {
      cancelPostBtn.removeEventListener('click', handleModalClose);
      cancelPostBtn.addEventListener('click', handleModalClose);
    }

    // 모달 배경 클릭 시 닫기
    const modal = document.getElementById('post-modal');
    if (modal) {
      modal.removeEventListener('click', handleModalBackgroundClick);
      modal.addEventListener('click', handleModalBackgroundClick);
    }

    // 게시글 작성 폼 제출
    const postForm = document.getElementById('post-form');
    if (postForm) {
      postForm.removeEventListener('submit', handlePostFormSubmit);
      postForm.addEventListener('submit', handlePostFormSubmit);
    }

    // 수정 모달 이벤트 리스너들
    const editModal = document.getElementById('edit-post-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal');
    const cancelEditPostBtn = document.getElementById('cancel-edit-post');
    const editPostForm = document.getElementById('edit-post-form');

    if (closeEditModalBtn) {
      closeEditModalBtn.removeEventListener('click', handleEditModalClose);
      closeEditModalBtn.addEventListener('click', handleEditModalClose);
    }
    
    if (cancelEditPostBtn) {
      cancelEditPostBtn.removeEventListener('click', handleEditModalClose);
      cancelEditPostBtn.addEventListener('click', handleEditModalClose);
    }

    if (editModal) {
      editModal.removeEventListener('click', handleEditModalBackgroundClick);
      editModal.addEventListener('click', handleEditModalBackgroundClick);
    }

    if (editPostForm) {
      editPostForm.removeEventListener('submit', handleEditPostFormSubmit);
      editPostForm.addEventListener('submit', handleEditPostFormSubmit);
    }
  }, 100);
}

// 이벤트 핸들러 함수들
async function handleCategoryClick(event) {
  const categoryBtns = document.querySelectorAll('.category-btn');
  // 모든 버튼 비활성화
  categoryBtns.forEach(b => b.classList.remove('active'));
  
  // 클릭된 버튼 활성화
  event.target.classList.add('active');
  
  // 카테고리 변경
  currentBoardCategory = event.target.dataset.category;
  currentBoardPage = 1;
  
  // 게시글 로드
  await loadBoardPosts(currentBoardCategory, '', currentBoardPage);
}

let searchTimeout;
function handleBoardSearch(event) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    currentBoardPage = 1;
    await loadBoardPosts(currentBoardCategory, event.target.value, currentBoardPage);
  }, 500);
}

function handleNewPostClick() {
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  const modal = document.getElementById('post-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function handleModalClose() {
  const modal = document.getElementById('post-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function handleModalBackgroundClick(event) {
  const modal = document.getElementById('post-modal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
}

async function handlePostFormSubmit(event) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(event.target);
  const postData = {
    title: formData.get('title'),
    content: formData.get('content'),
    category: formData.get('category'),
    is_urgent: formData.get('urgent') === 'on'
  };

  await createBoardPost(postData);
}

// 수정 모달 핸들러들
function handleEditModalClose() {
  document.getElementById('edit-post-modal').style.display = 'none';
}

function handleEditModalBackgroundClick(event) {
  if (event.target === event.currentTarget) {
    handleEditModalClose();
  }
}

async function handleEditPostFormSubmit(event) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(event.target);
  const postData = {
    id: parseInt(formData.get('id') || document.getElementById('edit-post-id').value),
    title: formData.get('title'),
    content: formData.get('content'),
    category: formData.get('category'),
    is_urgent: document.getElementById('edit-post-urgent').checked
  };

  await updateBoardPost(postData);
}

// TODO 관련 함수들
async function loadTodos() {
  if (!currentUser) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/todos?user_id=${currentUser.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      todos = result.data;
      renderTodos();
      updateTodoStats();
    } else {
      console.error('TODO 로드 실패:', result.message);
    }
  } catch (error) {
    console.error('TODO 로드 중 오류:', error);
  }
}

async function addTodo(text, priority = 'medium') {
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }

  if (!text.trim()) {
    alert('할 일을 입력해주세요.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.trim(),
        priority,
        user_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      await loadTodos(); // TODO 목록 다시 로드
      
      // 입력 필드 초기화
      const todoInput = document.getElementById('todo-input');
      const todoPriority = document.getElementById('todo-priority');
      if (todoInput) todoInput.value = '';
      if (todoPriority) todoPriority.value = 'medium';
    } else {
      alert('TODO 추가 중 오류가 발생했습니다: ' + result.message);
    }
  } catch (error) {
    console.error('TODO 추가 중 오류:', error);
    alert('TODO 추가 중 오류가 발생했습니다.');
  }
}

async function toggleTodoComplete(todoId, isCompleted) {
  try {
    const response = await fetch(`${API_BASE}/todos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        is_completed: isCompleted,
        user_id: currentUser.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      await loadTodos(); // TODO 목록 다시 로드
    } else {
      alert('TODO 상태 변경 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('TODO 상태 변경 중 오류:', error);
    alert('TODO 상태 변경 중 오류가 발생했습니다.');
  }
}

async function deleteTodo(todoId) {
  if (!confirm('정말로 이 TODO를 삭제하시겠습니까?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/todos/${todoId}?user_id=${currentUser.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      await loadTodos(); // TODO 목록 다시 로드
    } else {
      alert('TODO 삭제 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('TODO 삭제 중 오류:', error);
    alert('TODO 삭제 중 오류가 발생했습니다.');
  }
}

function renderTodos() {
  const todoList = document.getElementById('todo-list');
  if (!todoList) return;

  // 필터링
  let filteredTodos = todos.filter(todo => {
    switch (currentTodoFilter) {
      case 'completed':
        return todo.is_completed;
      case 'pending':
        return !todo.is_completed;
      case 'high':
        return todo.priority === 'high';
      default:
        return true;
    }
  });

  if (filteredTodos.length === 0) {
    todoList.innerHTML = `
      <div class="todo-empty">
        <i class="fas fa-tasks"></i>
        <h3>할 일이 없습니다</h3>
        <p>새로운 할 일을 추가해보세요!</p>
      </div>
    `;
    return;
  }

  todoList.innerHTML = filteredTodos.map(todo => {
    const createdAt = new Date(todo.created_at);
    const timeAgo = getTimeAgo(createdAt);
    
    const priorityText = {
      'high': '높음',
      'medium': '보통',
      'low': '낮음'
    }[todo.priority] || todo.priority;

    return `
      <div class="todo-item">
        <div class="todo-checkbox ${todo.is_completed ? 'completed' : ''}" 
             onclick="toggleTodoComplete(${todo.id}, ${!todo.is_completed})">
          ${todo.is_completed ? '<i class="fas fa-check"></i>' : ''}
        </div>
        
        <div class="todo-content">
          <div class="todo-text ${todo.is_completed ? 'completed' : ''}">${escapeHtml(todo.text)}</div>
          <div class="todo-meta">
            <span class="todo-priority ${todo.priority}">${priorityText}</span>
            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
          </div>
        </div>
        
        <div class="todo-actions">
          <button class="todo-action-btn delete" onclick="deleteTodo(${todo.id})" title="삭제">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateTodoStats() {
  const totalTodos = todos.length;
  const completedTodos = todos.filter(todo => todo.is_completed).length;
  const pendingTodos = totalTodos - completedTodos;

  const totalElement = document.getElementById('total-todos');
  const completedElement = document.getElementById('completed-todos');
  const pendingElement = document.getElementById('pending-todos');

  if (totalElement) totalElement.textContent = totalTodos;
  if (completedElement) completedElement.textContent = completedTodos;
  if (pendingElement) pendingElement.textContent = pendingTodos;
}

function setupTodoEventListeners() {
  setTimeout(() => {
    // TODO 추가 버튼
    const addTodoBtn = document.getElementById('add-todo-btn');
    if (addTodoBtn) {
      addTodoBtn.removeEventListener('click', handleAddTodo);
      addTodoBtn.addEventListener('click', handleAddTodo);
    }

    // TODO 입력 필드 엔터키
    const todoInput = document.getElementById('todo-input');
    if (todoInput) {
      todoInput.removeEventListener('keypress', handleTodoInputKeypress);
      todoInput.addEventListener('keypress', handleTodoInputKeypress);
    }

    // TODO 필터 버튼들
    const filterBtns = document.querySelectorAll('.todo-filter-btn');
    filterBtns.forEach(btn => {
      btn.removeEventListener('click', handleTodoFilterClick);
      btn.addEventListener('click', handleTodoFilterClick);
    });
  }, 100);
}

// TODO 이벤트 핸들러들
function handleAddTodo() {
  const todoInput = document.getElementById('todo-input');
  const todoPriority = document.getElementById('todo-priority');
  
  if (todoInput && todoPriority) {
    addTodo(todoInput.value, todoPriority.value);
  }
}

function handleTodoInputKeypress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleAddTodo();
  }
}

function handleTodoFilterClick(event) {
  const filterBtns = document.querySelectorAll('.todo-filter-btn');
  
  // 모든 버튼 비활성화
  filterBtns.forEach(btn => btn.classList.remove('active'));
  
  // 클릭된 버튼 활성화
  event.target.classList.add('active');
  
  // 필터 변경
  currentTodoFilter = event.target.dataset.filter;
  
  // TODO 목록 다시 렌더링
  renderTodos();
}

// 전역 함수로 노출 (HTML에서 사용)
window.handleCredentialResponse = handleCredentialResponse;
window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.showAssigneeDetails = showAssigneeDetails;
window.togglePostLike = togglePostLike;
window.openEditPostModal = openEditPostModal;
window.deletePost = deletePost;
window.toggleTodoComplete = toggleTodoComplete;
window.deleteTodo = deleteTodo;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.toggleAssigneeView = toggleAssigneeView;
window.goToPreviousMonth = goToPreviousMonth;
window.goToNextMonth = goToNextMonth;
window.navigateToTab = navigateToTab;

// PWA 관련 변수
let deferredPrompt;
let isStandalone = false;
let pwaInstallCheckAttempts = 0;
let maxInstallCheckAttempts = 10;

// PWA 관련 함수들
function checkPWAStatus() {
  // 이미 설치된 앱인지 확인
  isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                 window.navigator.standalone === true;
  
  console.log('🔍 PWA 상태 체크:', {
    isStandalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches,
    standalone: window.navigator.standalone,
    userAgent: navigator.userAgent,
    referrer: document.referrer
  });
  
  if (isStandalone) {
    console.log('✅ PWA로 실행 중');
    // PWA 설치 버튼 숨기기
    const installPrompt = document.getElementById('pwa-install-prompt');
    const headerInstallBtn = document.getElementById('pwa-install-header-btn');
    
    if (installPrompt) installPrompt.style.display = 'none';
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    
    // 설치됨 상태 표시
    showPWAInstalledStatus();
  } else {
    console.log('🌐 브라우저에서 실행 중 - PWA 설치 가능');
  }
}

function showPWAInstalledStatus() {
  const userMenu = document.querySelector('.user-menu');
  if (userMenu && !document.querySelector('.pwa-installed')) {
    const installedStatus = document.createElement('div');
    installedStatus.className = 'pwa-installed';
    installedStatus.innerHTML = '<i class="fas fa-mobile-alt"></i> 앱 모드';
    userMenu.insertBefore(installedStatus, userMenu.firstChild);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(registration) {
          console.log('Service Worker 등록 성공:', registration.scope);
          
          // 서비스 워커 업데이트 확인
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateAvailable();
              }
            });
          });
        })
        .catch(function(error) {
          console.log('Service Worker 등록 실패:', error);
        });
    });
  }
}

function showUpdateAvailable() {
  console.log('🔄 새로운 버전 감지됨');
  
  // 더 친화적인 업데이트 알림 생성
  const updateBanner = document.createElement('div');
  updateBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 12px 20px;
    text-align: center;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;
  
  updateBanner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
      <span>🚀 새로운 버전이 있습니다! (게시판 수정/삭제 기능 추가)</span>
      <button onclick="updateApp()" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: 500;">
        지금 업데이트
      </button>
      <button onclick="dismissUpdate()" style="background: transparent; color: white; border: none; cursor: pointer; opacity: 0.8;">
        ✕
      </button>
    </div>
  `;
  
  updateBanner.id = 'update-banner';
  document.body.prepend(updateBanner);
  
  // 전역 함수로 등록
  window.updateApp = () => {
    console.log('🔄 앱 업데이트 중...');
    window.location.reload(true);
  };
  
  window.dismissUpdate = () => {
    updateBanner.remove();
  };
  
  // 10초 후 자동으로 업데이트 권장
  setTimeout(() => {
    if (document.getElementById('update-banner')) {
      if (confirm('새로운 기능을 사용하려면 업데이트가 필요합니다. 지금 업데이트하시겠습니까?')) {
        window.location.reload(true);
      }
    }
  }, 10000);
}

function setupPWAInstallPrompt() {
  console.log('🚀 PWA 설치 프롬프트 설정 시작');
  
  // beforeinstallprompt 이벤트 처리
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('✅ beforeinstallprompt 이벤트 수신됨!');
    e.preventDefault();
    deferredPrompt = e;
    
    console.log('📱 PWA 설치 프롬프트 준비됨, 3초 후 표시 예정');
    
    // PWA 설치 프롬프트 표시 (3초 후)
    setTimeout(() => {
      if (!isStandalone && shouldShowPWAPrompt()) {
        console.log('🎯 PWA 설치 프롬프트 표시 중...');
        showPWAInstallPrompt();
      } else {
        console.log('❌ PWA 프롬프트 표시 조건 미충족:', { isStandalone, shouldShow: shouldShowPWAPrompt() });
      }
    }, 3000);
  });
  
  // 주기적으로 PWA 설치 가능 여부 확인 (beforeinstallprompt 이벤트가 안 올 경우 대비)
  const checkPWAInstallability = () => {
    pwaInstallCheckAttempts++;
    console.log(`🔄 PWA 설치 가능 여부 확인 (시도 ${pwaInstallCheckAttempts}/${maxInstallCheckAttempts})`);
    
    if (!deferredPrompt && !isStandalone && pwaInstallCheckAttempts < maxInstallCheckAttempts) {
      console.log('⏳ beforeinstallprompt 이벤트 대기 중...');
      setTimeout(checkPWAInstallability, 1000);
    } else if (!deferredPrompt && !isStandalone && pwaInstallCheckAttempts >= maxInstallCheckAttempts) {
      console.log('⚠️ beforeinstallprompt 미지원 - 수동 설치 안내 표시');
      showManualInstallGuide();
    }
  };
  
  // 5초 후부터 PWA 설치 가능 여부 확인 시작
  setTimeout(() => {
    if (!deferredPrompt && !isStandalone) {
      checkPWAInstallability();
    }
  }, 5000);
  
  // PWA 설치 완료 이벤트
  window.addEventListener('appinstalled', (e) => {
    console.log('🎉 PWA 설치 완료!');
    hidePWAInstallPrompt();
    showPWAInstalledStatus();
    
    // 감사 메시지 표시
    setTimeout(() => {
      alert('앱이 성공적으로 설치되었습니다! 홈 화면에서 바로 접근할 수 있습니다.');
    }, 1000);
  });
  
  console.log('✅ PWA 설치 프롬프트 설정 완료');
}

function showPWAInstallPrompt() {
  const installPrompt = document.getElementById('pwa-install-prompt');
  const headerInstallBtn = document.getElementById('pwa-install-header-btn');
  
  if (installPrompt) installPrompt.style.display = 'block';
  if (headerInstallBtn) headerInstallBtn.style.display = 'flex';
}

function hidePWAInstallPrompt() {
  const installPrompt = document.getElementById('pwa-install-prompt');
  const headerInstallBtn = document.getElementById('pwa-install-header-btn');
  
  if (installPrompt) installPrompt.style.display = 'none';
  if (headerInstallBtn) headerInstallBtn.style.display = 'none';
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('사용자가 PWA 설치를 승인했습니다');
        hidePWAInstallPrompt();
      } else {
        console.log('사용자가 PWA 설치를 거부했습니다');
      }
      deferredPrompt = null;
    });
  } else {
    // iOS Safari용 안내
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      alert('Safari에서 공유 버튼을 눌러 "홈 화면에 추가"를 선택해주세요.');
    } else {
      alert('브라우저 설정에서 "홈 화면에 추가" 또는 "앱 설치"를 선택해주세요.');
    }
  }
}

function setupNetworkStatusIndicator() {
  // 오프라인/온라인 상태 표시
  let offlineIndicator = document.createElement('div');
  offlineIndicator.className = 'offline-indicator';
  offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> 오프라인 상태입니다';
  document.body.appendChild(offlineIndicator);
  
  let onlineIndicator = document.createElement('div');
  onlineIndicator.className = 'online-indicator';
  onlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> 온라인 상태로 복구되었습니다';
  document.body.appendChild(onlineIndicator);
  
  window.addEventListener('offline', () => {
    console.log('오프라인 상태');
    offlineIndicator.classList.add('show');
  });
  
  window.addEventListener('online', () => {
    console.log('온라인 상태');
    offlineIndicator.classList.remove('show');
    onlineIndicator.classList.add('show');
    
    // 3초 후 온라인 표시 숨기기
    setTimeout(() => {
      onlineIndicator.classList.remove('show');
    }, 3000);
    
    // 데이터 동기화 (향후 구현)
    syncOfflineData();
  });
}

function syncOfflineData() {
  // 오프라인에서 변경된 데이터 동기화
  console.log('오프라인 데이터 동기화 시작');
  // TODO: IndexedDB에서 미동기화 데이터 가져와서 서버에 전송
}

function setupPWAEventListeners() {
  // PWA 설치 버튼들 이벤트 리스너
  const installBtn = document.getElementById('pwa-install-btn');
  const headerInstallBtn = document.getElementById('pwa-install-header-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  
  if (installBtn) {
    installBtn.addEventListener('click', installPWA);
  }
  
  if (headerInstallBtn) {
    headerInstallBtn.addEventListener('click', installPWA);
  }
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hidePWAInstallPrompt();
      // 24시간 동안 프롬프트 숨기기
      localStorage.setItem('pwa-prompt-dismissed', Date.now() + 24 * 60 * 60 * 1000);
    });
  }
}

function shouldShowPWAPrompt() {
  const dismissedUntil = localStorage.getItem('pwa-prompt-dismissed');
  if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
    return false;
  }
  return !isStandalone;
}

function showManualInstallGuide() {
  console.log('📖 수동 설치 안내 표시 중');
  const userAgent = navigator.userAgent.toLowerCase();
  console.log('🔍 사용자 디바이스:', { userAgent });
  
  let instructions = '';
  let deviceType = '';
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    deviceType = 'iOS';
    instructions = `
      <div class="manual-install-guide">
        <div class="install-step">
          <div class="step-icon">🍎</div>
          <div class="step-content">
            <h4>iPhone/iPad 설치 방법</h4>
            <ol>
              <li>Safari 하단의 <strong>공유 버튼 (📤)</strong> 클릭</li>
              <li>목록에서 <strong>"홈 화면에 추가"</strong> 선택</li>
              <li>앱 이름을 확인하고 <strong>"추가"</strong> 버튼 클릭</li>
              <li>홈 화면에서 앱 아이콘을 확인하세요!</li>
            </ol>
            <p class="install-note">💡 Safari 브라우저에서만 설치 가능합니다.</p>
          </div>
        </div>
      </div>
    `;
  } else if (/android/.test(userAgent)) {
    deviceType = 'Android';
    instructions = `
      <div class="manual-install-guide">
        <div class="install-step">
          <div class="step-icon">🤖</div>
          <div class="step-content">
            <h4>Android 설치 방법</h4>
            <ol>
              <li>Chrome 브라우저 <strong>메뉴 (⋮)</strong> 클릭</li>
              <li><strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong> 선택</li>
              <li>설치 확인 대화상자에서 <strong>"설치"</strong> 클릭</li>
              <li>홈 화면 또는 앱 서랍에서 앱을 확인하세요!</li>
            </ol>
            <p class="install-note">💡 Chrome 브라우저에서 최적화되어 있습니다.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    deviceType = 'Desktop';
    instructions = `
      <div class="manual-install-guide">
        <div class="install-step">
          <div class="step-icon">💻</div>
          <div class="step-content">
            <h4>데스크톱 설치 방법</h4>
            <ol>
              <li>주소창 오른쪽의 <strong>설치 아이콘 (⬇️)</strong> 클릭</li>
              <li>또는 브라우저 메뉴에서 <strong>"앱 설치"</strong> 선택</li>
              <li>설치 확인 대화상자에서 <strong>"설치"</strong> 클릭</li>
              <li>데스크톱에 바로가기가 생성됩니다!</li>
            </ol>
            <p class="install-note">💡 Chrome, Edge, Firefox 등에서 지원됩니다.</p>
          </div>
        </div>
      </div>
    `;
  }
  
  console.log(`📱 ${deviceType} 설치 안내 준비 완료`);
  
  const installPrompt = document.getElementById('pwa-install-prompt');
  if (installPrompt) {
    console.log('🎨 설치 프롬프트 UI 업데이트 중');
    installPrompt.innerHTML = `
      <div class="pwa-prompt-content">
        <div class="pwa-prompt-icon">📱</div>
        <div class="pwa-prompt-text">
          <h3>앱으로 설치하기</h3>
          <p>홈 화면에 추가하여 더 빠르게 접근하세요!</p>
          ${instructions}
        </div>
        <div class="pwa-prompt-actions">
          <button id="manual-install-btn" class="pwa-install-btn">자세한 설치 방법</button>
          <button id="manual-dismiss-btn" class="pwa-dismiss-btn">나중에</button>
        </div>
      </div>
    `;
    
    installPrompt.style.display = 'block';
    console.log('✅ 설치 프롬프트 표시됨');
    
    // 새로운 이벤트 리스너 추가
    document.getElementById('manual-install-btn')?.addEventListener('click', () => {
      console.log('ℹ️ 자세한 설치 방법 요청됨');
      alert(getDetailedInstallInstructions());
    });
    
    document.getElementById('manual-dismiss-btn')?.addEventListener('click', () => {
      console.log('❌ 사용자가 설치 프롬프트 닫음');
      hidePWAInstallPrompt();
      localStorage.setItem('pwa-prompt-dismissed', Date.now() + 24 * 60 * 60 * 1000);
    });
  }
  
  // 헤더 설치 버튼도 표시하여 사용자가 언제든 접근 가능하도록
  const headerBtn = document.getElementById('pwa-install-header-btn');
  if (headerBtn && !isStandalone) {
    console.log('🔗 헤더 설치 버튼 활성화');
    headerBtn.style.display = 'inline-flex';
    headerBtn.innerHTML = '<i class="fas fa-download"></i> 앱 설치';
    headerBtn.onclick = () => {
      console.log('🔄 헤더 버튼에서 설치 재시도');
      showManualInstallGuide();
    };
  }
}

function getDetailedInstallInstructions() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return `📱 iPhone/iPad 설치 방법:

1. Safari 브라우저에서 이 사이트를 엽니다
2. 화면 하단의 공유 버튼 (네모에 화살표) 을 누릅니다
3. 메뉴를 아래로 스크롤하여 "홈 화면에 추가"를 찾습니다
4. "홈 화면에 추가"를 누릅니다
5. 앱 이름을 확인하고 "추가" 버튼을 누릅니다
6. 홈 화면에서 "업무관리" 앱을 확인할 수 있습니다

⚠️ 주의: Chrome 앱이 아닌 Safari에서만 설치 가능합니다!`;
  } else if (/android/.test(userAgent)) {
    return `🤖 Android 설치 방법:

1. Chrome 브라우저에서 이 사이트를 엽니다
2. 오른쪽 상단의 메뉴 버튼 (점 3개) 을 누릅니다
3. "홈 화면에 추가" 또는 "앱 설치"를 선택합니다
4. "설치" 또는 "추가" 버튼을 누릅니다
5. 홈 화면에서 "업무관리" 앱을 확인할 수 있습니다

💡 팁: 주소창에 설치 아이콘이 나타날 수도 있습니다!`;
  } else {
    return `💻 데스크톱 설치 방법:

1. Chrome, Edge 브라우저에서 이 사이트를 엽니다
2. 주소창 오른쪽의 설치 아이콘을 클릭합니다
3. 또는 브라우저 메뉴에서 "앱 설치"를 선택합니다
4. "설치" 버튼을 클릭합니다
5. 바탕화면이나 시작 메뉴에서 앱을 실행할 수 있습니다`;
  }
}

// DOMContentLoaded 이벤트에 게시판 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
  // 기존 이벤트 리스너들...
  
  // 로그아웃 버튼
  document.getElementById('logoutButton')?.addEventListener('click', logout);
  
  // 과제 등록 폼
  document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
  
  // 탭 버튼들
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      showTab(tabName);
    });
  });
  
  // 뷰 전환 버튼들
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('view-btn')) {
      const viewType = e.target.getAttribute('data-view');
      const targetId = e.target.getAttribute('data-target');
      
      // 같은 그룹의 버튼들에서 active 제거
      const parentContainer = e.target.closest('.task-list-header') || e.target.closest('.assignee-container');
      if (parentContainer) {
        parentContainer.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
      }
      
      // 클릭된 버튼에 active 추가
      e.target.classList.add('active');
      
      // 뷰 업데이트
      updateView(targetId, viewType);
    }
  });
  
  // PWA 초기화
  checkPWAStatus();
  registerServiceWorker();
  setupPWAInstallPrompt();
  setupNetworkStatusIndicator();
  setupPWAEventListeners();
  
  // 게시판 이벤트 리스너는 게시판 탭이 활성화될 때 설정됨
});