// 개발용 스크립트 (로컬 테스트용)
// 글로벌 변수
let currentUser = null;
let allTasks = [];
let currentTab = 'add';

// 개발 모드 표시
console.log('🚧 개발 모드: 로컬 목업 데이터를 사용합니다');

// 목업 데이터
let mockTasks = [
  {
    id: 1,
    assignee: '김철수',
    task_name: '웹사이트 리디자인 프로젝트',
    is_urgent: true,
    created_date: new Date().toISOString(),
    is_completed: false,
    submission_target: '마케팅팀',
    notes: '메인 페이지와 제품 소개 페이지 우선 작업',
    user_id: 'test-user-1'
  },
  {
    id: 2,
    assignee: '박영희',
    task_name: '월간 보고서 작성',
    is_urgent: false,
    created_date: new Date(Date.now() - 24*60*60*1000).toISOString(),
    is_completed: true,
    submission_target: '임원진',
    notes: '실적 분석 및 개선안 포함',
    user_id: 'test-user-1'
  },
  {
    id: 3,
    assignee: '이민수',
    task_name: '데이터베이스 백업 설정',
    is_urgent: true,
    created_date: new Date(Date.now() - 2*60*60*1000).toISOString(),
    is_completed: false,
    submission_target: 'IT팀',
    notes: '자동 백업 스케줄 구성 필요',
    user_id: 'test-user-1'
  },
  {
    id: 4,
    assignee: '김철수',
    task_name: '고객 피드백 분석',
    is_urgent: false,
    created_date: new Date(Date.now() - 3*60*60*1000).toISOString(),
    is_completed: true,
    submission_target: '제품팀',
    notes: '최근 3개월 데이터 기준',
    user_id: 'test-user-1'
  }
];

// 구글 로그인 처리 (목업)
async function handleCredentialResponse(response) {
  console.log('🔐 목업 로그인 처리');
  
  currentUser = {
    id: 'test-user-1',
    name: '테스트 사용자',
    email: 'test@example.com',
    picture: 'https://via.placeholder.com/100x100.png?text=User'
  };

  showApp();
  await loadDashboard();
}

// 앱 화면 표시
function showApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  
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
}

// 대시보드 로드 (목업)
async function loadDashboard() {
  console.log('📊 목업 대시보드 로드');
  
  // 통계 계산
  const total = mockTasks.length;
  const completed = mockTasks.filter(task => task.is_completed).length;
  const urgent = mockTasks.filter(task => task.is_urgent && !task.is_completed).length;
  const pending = total - completed;
  
  document.getElementById('totalTasks').textContent = total;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
  document.getElementById('urgentTasks').textContent = urgent;
  
  allTasks = [...mockTasks];
  refreshCurrentTab();
}

// 모든 과제 데이터 로드 (목업)
async function loadTasks() {
  allTasks = [...mockTasks];
  refreshCurrentTab();
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

// 새 과제 등록 (목업)
async function submitTask(event) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(event.target);
  const taskData = {
    id: Date.now(), // 임시 ID
    assignee: formData.get('assignee').trim(),
    task_name: formData.get('taskName').trim(),
    is_urgent: formData.get('isUrgent') === 'on',
    created_date: new Date().toISOString(),
    is_completed: false,
    submission_target: formData.get('submissionTarget').trim() || null,
    notes: formData.get('notes').trim() || null,
    user_id: currentUser.id
  };
  
  if (!taskData.assignee || !taskData.task_name) {
    alert('담당자와 과제명은 필수 입력 항목입니다.');
    return;
  }
  
  console.log('📝 새 과제 등록 (목업):', taskData);
  
  // 목업 데이터에 추가
  mockTasks.push(taskData);
  
  // 폼 초기화
  event.target.reset();
  
  // 대시보드 새로고침
  await loadDashboard();
  
  alert('과제가 성공적으로 등록되었습니다!');
}

// 과제 완료 상태 토글 (목업)
async function toggleTaskComplete(taskId) {
  console.log('✅ 과제 상태 토글 (목업):', taskId);
  
  const taskIndex = mockTasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    mockTasks[taskIndex].is_completed = !mockTasks[taskIndex].is_completed;
    await loadDashboard();
  }
}

// 과제 삭제 (목업)
async function deleteTask(taskId) {
  if (!confirm('정말로 이 과제를 삭제하시겠습니까?')) {
    return;
  }
  
  console.log('🗑️ 과제 삭제 (목업):', taskId);
  
  const taskIndex = mockTasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    mockTasks.splice(taskIndex, 1);
    await loadDashboard();
  }
}

// 탭 전환
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  currentTab = tabName;
  refreshCurrentTab();
}

// 유틸리티 함수들
function escapeHtml(text) {
  if (!text) return '';
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
  console.log('🚀 개발 모드 초기화 완료');
  
  // 자동 로그인 (개발 모드)
  setTimeout(() => {
    handleCredentialResponse({ credential: 'mock-token' });
  }, 500);
  
  // 로그아웃 버튼
  document.getElementById('logoutButton').addEventListener('click', logout);
  
  // 과제 등록 폼
  document.getElementById('taskForm').addEventListener('submit', submitTask);
  
  // 탭 버튼들
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

// 전역 함수로 노출 (HTML에서 사용)
window.handleCredentialResponse = handleCredentialResponse;
window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.showAssigneeDetails = showAssigneeDetails;