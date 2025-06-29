The prompt involves updating an existing JavaScript file to address authentication flow issues, enhance sign-in and sign-up processes, integrate email confirmation, update the forgot password functionality, and handle main page loading. The provided changes will be applied meticulously to ensure a complete and functional code file.
```

```javascript
class LanguellaApp {
  constructor() {
    this.currentUser = null;
    this.currentConversation = null;
    this.currentPage = 'chat';
    this.vocabulary = [];
    this.conversations = [];
    this.init();
  }

  async init() {
    // Show loading screen
    this.showElement('loading-screen');

    // Check authentication
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await this.loadUserProfile();
        await this.loadConversations();
        await this.loadVocabulary();
        this.showMainApp();
      } catch (error) {
        console.error('Auth error:', error);
        this.showAuth();
      }
    } else {
      this.showAuth();
    }

    this.setupEventListeners();
    this.hideElement('loading-screen');
  }

  // Authentication Methods
  async showAuth() {
    this.hideElement('main-app');
    this.showElement('auth-container');
    this.showElement('login-screen');
  }

  async showMainApp() {
    this.hideElement('auth-container');
    this.showElement('main-app');
    this.updateUI();
  }

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem('auth_token', data.token);
      this.currentUser = data.user;

      await this.loadConversations();
      await this.loadVocabulary();
      this.showMainApp();
      this.showToast('Welcome back!', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async register(name, email, password) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem('auth_token', data.token);
      this.currentUser = data.user;

      this.showLanguageSelection();
      this.showToast('Account created successfully!', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  showLanguageSelection() {
    this.hideElement('login-screen');
    this.hideElement('signup-screen');
    this.showElement('language-selection-screen');
  }

  async setStudyLanguage(language) {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ study_language: language })
      });

      if (!response.ok) throw new Error('Failed to update language');

      await this.loadConversations();
      await this.loadVocabulary();
      this.showMainApp();
      this.showToast(`Study language set to ${language}!`, 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async loadUserProfile() {
    const response = await fetch('/api/user/profile', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    });

    if (!response.ok) throw new Error('Failed to load profile');

    const data = await response.json();
    this.currentUser = data.profile;
  }

  logout() {
    localStorage.removeItem('auth_token');
    this.currentUser = null;
    this.currentConversation = null;
    this.vocabulary = [];
    this.conversations = [];
    this.showAuth();
    this.showToast('Logged out successfully', 'info');
  }

  // Chat Methods
  async loadConversations() {
    try {
      const response = await fetch('/api/chat/conversations', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      this.conversations = data.conversations;

      if (this.conversations.length > 0 && !this.currentConversation) {
        this.currentConversation = this.conversations[0];
        await this.loadMessages();
      }
    } catch (error) {
      console.error('Load conversations error:', error);
    }
  }

  async createNewConversation() {
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
      this.currentConversation = data.conversation;
      this.conversations.unshift(data.conversation);

      this.clearChatMessages();
      this.showWelcomeMessage();
      this.showToast('New conversation started!', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async loadMessages() {
    if (!this.currentConversation) return;

    try {
      const response = await fetch(`/api/chat/conversations/${this.currentConversation.id}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      this.displayMessages(data.messages);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  }

  async sendMessage(content) {
    if (!this.currentConversation) {
      await this.createNewConversation();
    }

    const messagesContainer = document.getElementById('chat-messages');

    // Add user message immediately
    this.addMessageToUI('user', content);

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
      const response = await fetch(`/api/chat/conversations/${this.currentConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Remove typing indicator
      typingDiv.remove();

      // Add AI response
      this.addMessageToUI('assistant', data.aiMessage.content);

    } catch (error) {
      typingDiv.remove();
      this.showToast('Failed to send message', 'error');
    }
  }

  displayMessages(messages) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      this.showWelcomeMessage();
      return;
    }

    messages.forEach(message => {
      this.addMessageToUI(message.role, message.content);
    });
  }

  addMessageToUI(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');

    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${this.escapeHtml(content)}</p>
        ${role === 'assistant' ? `
          <div class="message-actions">
            <button class="action-btn" onclick="app.translateText('${this.escapeHtml(content)}')">
              <i class="fas fa-language"></i> Translate
            </button>
            <button class="action-btn" onclick="app.explainText('${this.escapeHtml(content)}')">
              <i class="fas fa-info-circle"></i> Explain
            </button>
          </div>
        ` : ''}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  showWelcomeMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    const language = this.currentUser?.study_language || 'Spanish';
    const welcomeMessages = {
      spanish: '¡Hola! I\'m your AI language tutor. Let\'s practice your Spanish together! 🌟',
      french: 'Bonjour! I\'m your AI language tutor. Let\'s practice your French together! 🌟',
      german: 'Hallo! I\'m your AI language tutor. Let\'s practice your German together! 🌟',
      italian: 'Ciao! I\'m your AI language tutor. Let\'s practice your Italian together! 🌟'
    };

    messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="message ai-message">
          <div class="message-content">
            <p>${welcomeMessages[language] || welcomeMessages.spanish}</p>
            <div class="message-actions">
              <button class="action-btn" onclick="app.translateText('${welcomeMessages[language]}')">
                <i class="fas fa-language"></i> Translate
              </button>
              <button class="action-btn" onclick="app.explainText('${welcomeMessages[language]}')">
                <i class="fas fa-info-circle"></i> Explain
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  clearChatMessages() {
    document.getElementById('chat-messages').innerHTML = '';
  }

  async translateText(text) {
    try {
      const response = await fetch('/api/chat/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      this.showToast(`Translation: ${data.translation}`, 'info');
    } catch (error) {
      this.showToast('Translation failed', 'error');
    }
  }

  async explainText(text) {
    try {
      const response = await fetch('/api/chat/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Explanation failed');

      const data = await response.json();
      this.showModal('Explanation', data.explanation);
    } catch (error) {
      this.showToast('Explanation failed', 'error');
    }
  }

  // Vocabulary Methods
  async loadVocabulary() {
    try {
      const response = await fetch('/api/vocabulary', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      if (!response.ok) throw new Error('Failed to load vocabulary');

      const data = await response.json();
      this.vocabulary = data.vocabulary;
      this.updateVocabularyUI();
    } catch (error) {
      console.error('Load vocabulary error:', error);
    }
  }

  async addVocabularyWord(wordData) {
    try {
      const response = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(wordData)
      });

      if (!response.ok) throw new Error('Failed to add word');

      const data = await response.json();
      this.vocabulary.unshift(data.vocabulary);
      this.updateVocabularyUI();
      this.showToast('Word added successfully!', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  updateVocabularyUI() {
    const vocabularyList = document.getElementById('vocabulary-list');
    if (!vocabularyList) return;

    if (this.vocabulary.length === 0) {
      vocabularyList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-book fa-3x"></i>
          <h3>No vocabulary words yet</h3>
          <p>Start adding words from your conversations or manually add them.</p>
        </div>
      `;
      return;
    }

    vocabularyList.innerHTML = this.vocabulary.map(word => `
      <div class="vocabulary-item">
        <div class="vocab-word">
          <strong>${this.escapeHtml(word.word)}</strong>
          <span class="vocab-translation">${this.escapeHtml(word.translation)}</span>
        </div>
        <div class="vocab-meta">
          <span class="strength-badge strength-${word.strength}">${word.strength}</span>
          ${word.tags ? `<div class="vocab-tags">${word.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Navigation
  switchPage(pageName) {
    // Update navigation
    document.querySelectorAll('.nav-link, .nav-item').forEach(link => {
      link.classList.remove('active');
    });

    document.querySelectorAll(`[data-page="${pageName}"]`).forEach(link => {
      link.classList.add('active');
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
      targetPage.classList.add('active');
      this.currentPage = pageName;
    }

    // Load page-specific data
    if (pageName === 'vocabulary') {
      this.updateVocabularyUI();
    } else if (pageName === 'profile') {
      this.updateProfileUI();
    }
  }

  updateProfileUI() {
    if (!this.currentUser) return;

    document.getElementById('profile-name').textContent = this.currentUser.display_name || 'User';
    document.getElementById('profile-email').textContent = this.currentUser.email || '';
    document.getElementById('streak-count').textContent = this.currentUser.current_streak || 0;
    document.getElementById('words-learned').textContent = this.vocabulary.length;

    // Update settings
    const studyLanguageSelect = document.getElementById('study-language');
    if (studyLanguageSelect) {
      studyLanguageSelect.value = this.currentUser.study_language || 'spanish';
    }

    const difficultySelect = document.getElementById('difficulty-level');
    if (difficultySelect) {
      difficultySelect.value = this.currentUser.difficulty_level || 'beginner';
    }
  }

  updateUI() {
    if (this.currentPage === 'chat') {
      this.showWelcomeMessage();
    }
    this.updateProfileUI();
  }

  // Event Listeners
  setupEventListeners() {
    // Auth forms
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      this.login(email, password);
    });

    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      this.register(name, email, password);
    });

    // Auth navigation
    document.getElementById('show-signup')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideElement('login-screen');
      this.showElement('signup-screen');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideElement('signup-screen');
      this.showElement('login-screen');
    });

    // Language selection
    document.querySelectorAll('.language-card').forEach(card => {
      card.addEventListener('click', () => {
        const language = card.dataset.language;
        this.setStudyLanguage(language);
      });
    });

    // Chat
    document.getElementById('chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const content = input.value.trim();
      if (content) {
        this.sendMessage(content);
        input.value = '';
        input.style.height = 'auto';
      }
    });

    // Auto-resize textarea
    document.getElementById('chat-input')?.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    });

    // New conversation
    document.getElementById('new-conversation-btn')?.addEventListener('click', () => {
      this.createNewConversation();
    });

    // Navigation
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.switchPage(page);
      });
    });

    // Add word modal
    document.getElementById('add-word-btn')?.addEventListener('click', () => {
      this.showElement('modal-overlay');
      this.showElement('add-word-modal');
    });

    document.getElementById('add-word-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const wordData = {
        word: formData.get('word'),
        translation: formData.get('translation'),
        context: formData.get('context'),
        tags: formData.get('tags'),
        notes: formData.get('notes')
      };
      this.addVocabularyWord(wordData);
      this.hideElement('modal-overlay');
      e.target.reset();
    });

    // Modal close
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideElement('modal-overlay');
      });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });

    // Settings form
    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            study_language: formData.get('study-language'),
            difficulty_level: formData.get('difficulty-level'),
            dark_mode: formData.get('dark-mode') === 'on',
            grammar_hints: formData.get('grammar-coloring') === 'on',
            auto_translate: formData.get('translation-overlay') === 'on'
          })
        });

        if (!response.ok) throw new Error('Failed to update settings');

        await this.loadUserProfile();
        this.showToast('Settings saved!', 'success');
      } catch (error) {
        this.showToast(error.message, 'error');
      }
    });
  }

  // Utility Methods
  showElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.remove('hidden');
  }

  hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }

  showModal(title, content) {
    // Create a simple modal for explanations
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <p style="white-space: pre-wrap;">${content}</p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    setupEventListeners();

    // Show loading initially
    showScreen('loading');

    // Check authentication state
    setTimeout(async () => {
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
                    loadUserProfile();
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
    }, 1000);
});

// Forgot password now handled by separate page
</replit_final_file>