let currentUser = null;
let currentConversation = null;
let vocabulary = [];
let conversations = [];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    showScreen('loading');

    // Check authentication
    const token = localStorage.getItem('auth_token');
    if (token) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                showScreen('main');
                await loadUserData();
            } else {
                localStorage.removeItem('auth_token');
                showScreen('auth');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            localStorage.removeItem('auth_token');
            showScreen('auth');
        }
    } else {
        showScreen('auth');
    }

    setupEventListeners();
}

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });

    // Show target screen
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
    }

    // Show specific auth screens
    if (screenName === 'auth') {
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('signup-screen')?.classList.add('hidden');
        document.getElementById('language-selection-screen')?.classList.add('hidden');
    }

    if (screenName === 'main') {
        document.getElementById('main-app')?.classList.remove('hidden');
        document.getElementById('auth-container')?.classList.add('hidden');
    }
}

async function loadUserData() {
    try {
        await Promise.all([
            loadConversations(),
            loadVocabulary(),
            loadUserProfile()
        ]);
        updateUI();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Authentication functions
async function login(email, password) {
    try {
        const response = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        localStorage.setItem('auth_token', data.session.access_token);
        currentUser = data.user;
        showScreen('main');
        await loadUserData();
        showToast('Welcome back!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function signup(email, password, displayName) {
    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        showToast('Please check your email to confirm your account!', 'info');
        showScreen('auth');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    currentUser = null;
    currentConversation = null;
    vocabulary = [];
    conversations = [];
    showScreen('auth');
    showToast('Logged out successfully', 'info');
}

// Load functions
async function loadConversations() {
    try {
        const response = await fetch('/api/chat/conversations', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        conversations = data.conversations || [];
    } catch (error) {
        console.error('Load conversations error:', error);
    }
}

async function loadVocabulary() {
    try {
        const response = await fetch('/api/vocabulary', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        vocabulary = data.vocabulary || [];
    } catch (error) {
        console.error('Load vocabulary error:', error);
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.profile) {
            currentUser = { ...currentUser, ...data.profile };
        }
    } catch (error) {
        console.error('Load profile error:', error);
    }
}

// Chat functions
async function sendMessage(content) {
    if (!currentConversation) {
        await createNewConversation();
    }

    const messagesContainer = document.getElementById('chat-messages');

    // Add user message
    addMessageToUI('user', content);

    // Add typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const response = await fetch(`/api/chat/conversations/${currentConversation.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) throw new Error('Failed to send message');

        const data = await response.json();
        typingDiv.remove();
        addMessageToUI('assistant', data.aiMessage.content);
    } catch (error) {
        typingDiv.remove();
        showToast('Failed to send message', 'error');
    }
}

async function createNewConversation() {
    try {
        const response = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ title: 'New Conversation' })
        });

        if (!response.ok) throw new Error('Failed to create conversation');

        const data = await response.json();
        currentConversation = data.conversation;
        conversations.unshift(data.conversation);
    } catch (error) {
        console.error('Create conversation error:', error);
    }
}

function addMessageToUI(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');

    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Navigation
function switchPage(pageName) {
    document.querySelectorAll('.nav-link, .nav-item').forEach(link => {
        link.classList.remove('active');
    });

    document.querySelectorAll(`[data-page="${pageName}"]`).forEach(link => {
        link.classList.add('active');
    });

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

function updateUI() {
    // Update any UI elements that depend on user data
    if (currentUser) {
        const profileName = document.getElementById('profile-name');
        if (profileName) {
            profileName.textContent = currentUser.display_name || currentUser.email || 'User';
        }
    }
}

// Event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            login(email, password);
        });
    }

    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const displayName = document.getElementById('signup-name').value;
            signup(email, password, displayName);
        });
    }

    // Auth navigation
    const showSignup = document.getElementById('show-signup');
    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('signup-screen').classList.remove('hidden');
        });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        });
    }

    // Chat form
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (content) {
                sendMessage(content);
                input.value = '';
            }
        });
    }

    // Navigation
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            switchPage(page);
        });
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}