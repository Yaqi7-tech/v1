// API配置 - 自动检测环境
const API_CONFIG = {
    visitor: {
        url: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : '/api',
        key: 'app-ntJ0qX9eMENmHw8MVLaEue0L'
    },
    supervisor: {
        url: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : '/api',
        key: 'app-ql5TGDmm625kINtn9Y8JefJE'
    }
};

// 应用状态
let appState = {
    conversationStarted: false,
    conversationHistory: [],
    currentEvaluation: null,
    evaluationHistory: [],
    isProcessing: false,
    visitorConversationId: null,  // 来访者会话ID
    supervisorConversationId: null, // 督导会话ID
    usingSimulation: false // 是否在使用模拟数据
};

// DOM元素
const elements = {
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    startBtn: document.getElementById('startBtn'),
    sendBtn: document.getElementById('sendBtn'),
    status: document.getElementById('status'),
    evaluationContainer: document.getElementById('evaluationContainer'),
    historyList: document.getElementById('historyList')
};

// 调用Dify API
async function callDifyAPI(config, message, conversationId = null) {
    try {
        console.log('正在调用API:', config.url);
        console.log('发送消息:', message);
        console.log('使用会话ID:', conversationId);

        const requestBody = {
            inputs: {},
            query: message,
            response_mode: 'blocking',
            conversation_id: conversationId || '',
            user: 'counselor_user'
        };

        console.log('请求体:', requestBody);
        console.log('完整的请求URL:', config.url + '/chat-messages');
        console.log('使用的API密钥:', config.key.substring(0, 10) + '...');

        const response = await fetch(config.url + '/chat-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', response.status, errorText);
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('API响应成功:', data);

        return {
            answer: data.answer,
            conversation_id: data.conversation_id
        };

    } catch (error) {
        console.error('API调用错误:', error);
        throw error;
    }
}

// 来访者Agent调用
async function callVisitorAgent(message) {
    const response = await callDifyAPI(API_CONFIG.visitor, message, appState.visitorConversationId);

    // 保存会话ID以保持连续性
    if (response.conversation_id) {
        appState.visitorConversationId = response.conversation_id;
        console.log('保存来访者会话ID:', response.conversation_id);
    }

    return response.answer;
}

// 督导Agent调用
async function callSupervisorAgent(message) {
    const response = await callDifyAPI(API_CONFIG.supervisor, message, appState.supervisorConversationId);

    // 保存会话ID以保持连续性
    if (response.conversation_id) {
        appState.supervisorConversationId = response.conversation_id;
        console.log('保存督导会话ID:', response.conversation_id);
    }

    // 尝试解析JSON格式的评价
    try {
        const evaluationData = JSON.parse(response.answer);
        return evaluationData;
    } catch (error) {
        // 如果解析失败，返回默认格式的评价
        return {
            综合得分: 3,
            总体评价: response.answer,
            建议: "请继续关注来访者的需求和感受。"
        };
    }
}

// 更新状态显示
function updateStatus(message, type = 'normal') {
    elements.status.textContent = message;
    elements.status.style.backgroundColor = type === 'error' ? '#e74c3c' :
                                            type === 'processing' ? '#f39c12' : '#27ae60';
}

// 显示消息
function displayMessage(sender, content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <div class="sender">${sender}</div>
        <div class="content">${content}</div>
    `;

    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

    // 添加到历史记录
    appState.conversationHistory.push({
        sender,
        content,
        type,
        timestamp: new Date()
    });
}

// 显示评价
function displayEvaluation(evaluation) {
    appState.currentEvaluation = evaluation;
    appState.evaluationHistory.unshift({
        ...evaluation,
        timestamp: new Date()
    });

    // 更新当前评价显示
    elements.evaluationContainer.innerHTML = `
        <div class="evaluation">
            <div class="evaluation-header">
                <div class="score">${evaluation.综合得分 || 3}</div>
                <div class="evaluation-title">督导评价</div>
            </div>
            <div class="evaluation-content">
                <strong>总体评价：</strong>${evaluation.总体评价 || '暂无评价'}
            </div>
            <div class="evaluation-suggestions">
                <strong>建议：</strong>${evaluation.建议 || '暂无建议'}
            </div>
        </div>
    `;

    // 更新历史评价
    updateEvaluationHistory();
}

// 更新历史评价显示
function updateEvaluationHistory() {
    if (appState.evaluationHistory.length === 0) {
        elements.historyList.innerHTML = '<div class="no-evaluation">暂无历史评价</div>';
        return;
    }

    elements.historyList.innerHTML = appState.evaluationHistory.slice(1).map((eval, index) => `
        <div class="history-item">
            <div class="evaluation-header">
                <div class="score">${eval.综合得分 || 3}</div>
                <div class="evaluation-title">评价 #${appState.evaluationHistory.length - index - 1}</div>
            </div>
            <div class="evaluation-content">
                ${eval.总体评价 || '暂无评价'}
            </div>
        </div>
    `).join('');
}

// 开始新的对话
async function startNewConversation() {
    if (appState.isProcessing) return;

    try {
        appState.isProcessing = true;
        updateStatus('正在建立新的对话...', 'processing');

        // 重置会话状态
        appState.visitorConversationId = null;  // 重置来访者会话ID
        appState.supervisorConversationId = null; // 重置督导会话ID
        appState.conversationStarted = false;
        appState.currentEvaluation = null;

        // 清空对话区域和评价历史
        elements.chatContainer.innerHTML = '';
        elements.evaluationContainer.innerHTML = '<div class="no-evaluation">暂无评价信息。开始对话后，督导会对你的回复进行评价。</div>';
        elements.historyList.innerHTML = '';

        appState.conversationHistory = [];
        appState.evaluationHistory = [];

        // 显示系统消息
        displayMessage('系统', '新的对话已开始，来访者正在进入...', 'system');

        // 调用来访者Agent获取初始消息（不使用会话ID，创建新会话）
        const initialMessage = await callVisitorAgent("你好，我是一名心理咨询师，很高兴认识你。请告诉我你今天想聊些什么？");

        // 显示来访者的第一条消息
        displayMessage('来访者', initialMessage, 'visitor');

        // 启用输入
        elements.userInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.startBtn.disabled = true;
        appState.conversationStarted = true;

        updateStatus('对话进行中 - 请回复来访者');

    } catch (error) {
        console.error('开始对话失败:', error);
        updateStatus('连接失败，请重试', 'error');
        displayMessage('系统', '连接来访者失败，请检查网络连接后重试。', 'system');
    } finally {
        appState.isProcessing = false;
    }
}

// 发送消息
async function sendMessage() {
    const message = elements.userInput.value.trim();
    if (!message || appState.isProcessing) return;

    try {
        appState.isProcessing = true;
        elements.sendBtn.disabled = true;
        elements.userInput.disabled = true;

        // 显示咨询师消息
        displayMessage('我', message, 'counselor');

        // 清空输入框
        elements.userInput.value = '';

        updateStatus('督导正在评价...', 'processing');

        // 调用督导Agent评价咨询师的回复
        const evaluation = await callSupervisorAgent(message);
        displayEvaluation(evaluation);

        updateStatus('来访者正在回复...', 'processing');

        // 调用来访者Agent获取回复
        const visitorResponse = await callVisitorAgent(message);
        displayMessage('来访者', visitorResponse, 'visitor');

        updateStatus('对话进行中 - 请回复来访者');

    } catch (error) {
        console.error('发送消息失败:', error);
        updateStatus('发送失败，请重试', 'error');
        displayMessage('系统', '消息发送失败，请重试。', 'system');
    } finally {
        appState.isProcessing = false;
        elements.sendBtn.disabled = false;
        elements.userInput.disabled = false;
        elements.userInput.focus();
    }
}


// 初始化函数
function initializeApp() {
    console.log('开始初始化应用...');

    // 检查DOM元素是否存在
    if (!elements.chatContainer) {
        console.error('chatContainer 元素未找到');
        return;
    }
    if (!elements.userInput) {
        console.error('userInput 元素未找到');
        return;
    }
    if (!elements.startBtn) {
        console.error('startBtn 元素未找到');
        return;
    }

    console.log('所有DOM元素已找到');

    // 初始化界面
    updateStatus('准备就绪');

    // 绑定事件监听器
    if (elements.userInput) {
        elements.userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!elements.sendBtn.disabled) {
                    sendMessage();
                }
            }
        });

        // 监听输入框变化
        elements.userInput.addEventListener('input', function() {
            console.log('输入框内容变化:', this.value);
        });

        elements.userInput.addEventListener('focus', function() {
            console.log('输入框获得焦点');
        });
    }

    console.log('心理咨询模拟系统初始化完成');
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 确保在页面完全加载后也执行初始化
window.addEventListener('load', function() {
    console.log('页面完全加载');
    // 如果DOM加载时初始化失败，再次尝试
    if (!elements.userInput || !elements.chatContainer) {
        console.log('重新初始化...');
        setTimeout(initializeApp, 100);
    }
});