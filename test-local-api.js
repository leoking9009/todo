#!/usr/bin/env node

/**
 * 로컬 Netlify Functions API 테스트 스크립트
 * npm run dev가 실행 중일 때 사용하세요.
 */

const API_BASE_URL = 'http://localhost:3000/api';

// 색상 출력 함수들
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.cyan}🚀 ${msg}${colors.reset}`)
};

// HTTP 요청 함수
async function makeRequest(method, endpoint, data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url);
    const responseData = await response.json();
    return { success: response.ok, data: responseData, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 테스트 함수들
async function testGetTasks() {
  log.info('GET /api/tasks 테스트...');
  const result = await makeRequest('GET', '/tasks');
  
  if (result.success) {
    log.success(`작업 목록 조회 성공! (${result.data.length}개 작업)`);
    if (result.data.length > 0) {
      console.log('   첫 번째 작업:', result.data[0].task_name);
    }
  } else {
    log.error(`작업 목록 조회 실패: ${result.error || result.data?.error}`);
  }
  
  return result.success;
}

async function testGetStats() {
  log.info('GET /api/stats 테스트...');
  const result = await makeRequest('GET', '/stats');
  
  if (result.success) {
    log.success(`통계 조회 성공!`);
    console.log(`   총 작업: ${result.data.total}개, 완료: ${result.data.completed}개, 긴급: ${result.data.urgent}개`);
  } else {
    log.error(`통계 조회 실패: ${result.error || result.data?.error}`);
  }
  
  return result.success;
}

async function testCreateTask() {
  log.info('POST /api/tasks 테스트...');
  
  const newTask = {
    assignee: '로컬테스트',
    task_name: `API 테스트 작업 ${new Date().toLocaleTimeString()}`,
    is_urgent: Math.random() > 0.5,
    submission_target: '개발팀',
    notes: '자동 테스트로 생성된 작업입니다.',
    user_id: 'local-test-user'
  };

  const result = await makeRequest('POST', '/tasks', newTask);
  
  if (result.success) {
    log.success(`작업 생성 성공! ID: ${result.data.id}`);
    return result.data.id;
  } else {
    log.error(`작업 생성 실패: ${result.error || result.data?.error}`);
    return null;
  }
}

async function testUpdateTask(taskId) {
  if (!taskId) return false;
  
  log.info(`PUT /api/tasks/${taskId} 테스트...`);
  
  const updateData = {
    is_completed: true,
    notes: '테스트 완료로 업데이트됨'
  };

  const result = await makeRequest('PUT', `/tasks/${taskId}`, updateData);
  
  if (result.success) {
    log.success(`작업 수정 성공! ID: ${taskId}`);
  } else {
    log.error(`작업 수정 실패: ${result.error || result.data?.error}`);
  }
  
  return result.success;
}

async function testDeleteTask(taskId) {
  if (!taskId) return false;
  
  log.info(`DELETE /api/tasks/${taskId} 테스트...`);
  
  const result = await makeRequest('DELETE', `/tasks/${taskId}`);
  
  if (result.success) {
    log.success(`작업 삭제 성공! ID: ${taskId}`);
  } else {
    log.error(`작업 삭제 실패: ${result.error || result.data?.error}`);
  }
  
  return result.success;
}

// 서버 연결 확인
async function checkServerStatus() {
  try {
    const response = await fetch(API_BASE_URL + '/tasks');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 메인 테스트 실행
async function runTests() {
  log.header('로컬 Netlify Functions API 테스트 시작');
  
  // 서버 상태 확인
  log.info('서버 연결 확인...');
  const serverReady = await checkServerStatus();
  
  if (!serverReady) {
    log.error('서버에 연결할 수 없습니다!');
    log.info('다음 명령어로 서버를 시작하세요: npm run dev');
    process.exit(1);
  }
  
  log.success('서버 연결 확인됨!');
  console.log('');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 테스트 실행
  const tests = [
    { name: 'GET Tasks', fn: testGetTasks },
    { name: 'GET Stats', fn: testGetStats },
  ];
  
  for (const test of tests) {
    totalTests++;
    if (await test.fn()) {
      passedTests++;
    }
    console.log('');
  }
  
  // CRUD 테스트 (생성, 수정, 삭제)
  log.header('CRUD 테스트 시작');
  const taskId = await testCreateTask();
  
  if (taskId) {
    console.log('');
    totalTests++;
    passedTests++;
    
    // 수정 테스트
    totalTests++;
    if (await testUpdateTask(taskId)) {
      passedTests++;
    }
    console.log('');
    
    // 삭제 테스트
    totalTests++;
    if (await testDeleteTask(taskId)) {
      passedTests++;
    }
  }
  
  // 결과 출력
  console.log('\n' + '='.repeat(50));
  log.header(`테스트 결과: ${passedTests}/${totalTests} 통과`);
  
  if (passedTests === totalTests) {
    log.success('모든 테스트가 성공했습니다! 🎉');
  } else {
    log.warn(`${totalTests - passedTests}개의 테스트가 실패했습니다.`);
  }
  
  console.log('='.repeat(50));
}

// Node.js 환경에서만 실행
if (typeof window === 'undefined') {
  runTests().catch(error => {
    log.error(`테스트 중 오류 발생: ${error.message}`);
    process.exit(1);
  });
}