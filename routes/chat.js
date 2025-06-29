
const express = require('express');
const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new conversation
router.post('/conversations', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title = 'New Conversation' } = req.body;

  try {
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: req.user.id,
        title
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message and get AI response
router.post('/conversations/:conversationId/messages', authenticateToken, [
  body('content').trim().isLength({ min: 1, max: 2000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { conversationId } = req.params;
  const { content } = req.body;

  try {
    // Get user profile for study language
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('study_language, difficulty_level')
      .eq('id', req.user.id)
      .single();

    // Save user message
    const { data: userMessage, error: userMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: req.user.id,
        role: 'user',
        content
      })
      .select()
      .single();

    if (userMessageError) {
      return res.status(400).json({ error: userMessageError.message });
    }

    // Get conversation history for context
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Prepare AI prompt
    const studyLanguage = profile?.study_language || 'Spanish';
    const difficultyLevel = profile?.difficulty_level || 'beginner';
    
    const systemPrompt = `You are a language learning AI tutor. The user is studying ${studyLanguage} at a ${difficultyLevel} level.

Instructions:
1. Always respond primarily in ${studyLanguage} unless the user asks for help in English
2. Gently correct any grammar mistakes in the user's messages
3. Provide helpful explanations when needed
4. Keep responses appropriate for ${difficultyLevel} level learners
5. Be encouraging and supportive
6. If the user makes mistakes, offer gentle corrections and explanations
7. Include cultural context when relevant

Current conversation context: The user just sent: "${content}"

Respond as a helpful language tutor would, in ${studyLanguage}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.reverse().map(msg => ({ role: msg.role, content: msg.content }))
    ];

    // Call OpenRouter API
    const openRouterResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages,
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL,
        'X-Title': 'Languella'
      }
    });

    const aiResponse = openRouterResponse.data.choices[0].message.content;

    // Save AI response
    const { data: aiMessage, error: aiMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: req.user.id,
        role: 'assistant',
        content: aiResponse
      })
      .select()
      .single();

    if (aiMessageError) {
      return res.status(400).json({ error: aiMessageError.message });
    }

    // Update conversation timestamp
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    res.json({ 
      userMessage, 
      aiMessage,
      translation: null, // Will be implemented in frontend
      grammarBreakdown: null // Will be implemented in frontend
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get translation for text
router.post('/translate', authenticateToken, [
  body('text').trim().isLength({ min: 1, max: 1000 }),
  body('targetLanguage').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { text, targetLanguage = 'English' } = req.body;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: `Translate this text to ${targetLanguage}: "${text}". Only provide the translation, no explanations.`
      }],
      max_tokens: 200,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL,
        'X-Title': 'Languella'
      }
    });

    const translation = response.data.choices[0].message.content.trim();
    res.json({ translation });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Explain grammar/text
router.post('/explain', authenticateToken, [
  body('text').trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { text } = req.body;

  try {
    // Get user's study language
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('study_language')
      .eq('id', req.user.id)
      .single();

    const studyLanguage = profile?.study_language || 'Spanish';

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: `Explain the grammar and meaning of this ${studyLanguage} text: "${text}". Provide:
1. Literal translation
2. Grammar breakdown (identify parts of speech, tenses, etc.)
3. Cultural context if relevant
4. Alternative ways to say the same thing

Keep explanation clear and helpful for a language learner.`
      }],
      max_tokens: 400,
      temperature: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL,
        'X-Title': 'Languella'
      }
    });

    const explanation = response.data.choices[0].message.content;
    res.json({ explanation });

  } catch (error) {
    console.error('Explanation error:', error);
    res.status(500).json({ error: 'Explanation failed' });
  }
});

module.exports = router;
