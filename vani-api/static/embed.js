(function() {
  'use strict';

  var SCRIPT = document.currentScript;
  var KEY = SCRIPT && SCRIPT.getAttribute('data-widget-key');
  if (!KEY) return console.warn('[Vani] Missing data-widget-key');

  var API = SCRIPT.getAttribute('data-api') || 'https://api.vani.live';
  var SESSION_KEY = 'vani_chat_' + KEY.slice(0, 12);
  var sessionId = localStorage.getItem(SESSION_KEY) || null;
  var visitorId = localStorage.getItem('vani_visitor') || ('v_' + Math.random().toString(36).slice(2, 10));
  localStorage.setItem('vani_visitor', visitorId);

  var config = null;
  var messages = [];
  var isOpen = false;
  var isLoading = false;

  // ── Styles ──────────────────────────────────────────────────────────────

  var style = document.createElement('style');
  style.textContent = [
    '#vani-widget-root *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '#vani-widget-btn{position:fixed;z-index:99999;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,0,0,0.3);transition:transform .2s,box-shadow .2s}',
    '#vani-widget-btn:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(0,0,0,0.4)}',
    '#vani-widget-btn svg{width:26px;height:26px;fill:#fff}',
    '#vani-widget-panel{position:fixed;z-index:99999;width:380px;height:560px;max-height:80vh;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,0.4);opacity:0;transform:translateY(16px) scale(0.95);transition:opacity .25s,transform .25s;pointer-events:none}',
    '#vani-widget-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
    '.vani-header{padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.08)}',
    '.vani-header-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:700;flex-shrink:0}',
    '.vani-header-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}',
    '.vani-header-info h3{font-size:14px;font-weight:600;color:#fff}',
    '.vani-header-info p{font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px}',
    '.vani-header-close{margin-left:auto;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.4);font-size:18px;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s}',
    '.vani-header-close:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}',
    '.vani-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px;background:#0a0c14}',
    '.vani-msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;word-wrap:break-word;animation:vani-fade .2s ease}',
    '.vani-msg.bot{align-self:flex-start;background:#1a1d2e;color:#e2e8f0;border-bottom-left-radius:4px}',
    '.vani-msg.user{align-self:flex-end;color:#fff;border-bottom-right-radius:4px}',
    '.vani-typing{align-self:flex-start;padding:10px 18px;background:#1a1d2e;border-radius:14px;border-bottom-left-radius:4px;display:flex;gap:4px}',
    '.vani-typing span{width:6px;height:6px;border-radius:50%;background:#4a5568;animation:vani-bounce .6s infinite alternate}',
    '.vani-typing span:nth-child(2){animation-delay:.2s}',
    '.vani-typing span:nth-child(3){animation-delay:.4s}',
    '.vani-input-area{padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);background:#0d0f18;display:flex;gap:8px;align-items:center}',
    '.vani-input-area input{flex:1;background:#12141f;border:1px solid #2a2d3a;border-radius:10px;padding:10px 14px;font-size:13px;color:#fff;outline:none;transition:border-color .15s}',
    '.vani-input-area input:focus{border-color:#6366f1}',
    '.vani-input-area input::placeholder{color:#4a5568}',
    '.vani-send-btn{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;flex-shrink:0}',
    '.vani-send-btn:disabled{opacity:0.4;cursor:not-allowed}',
    '.vani-send-btn svg{width:16px;height:16px;fill:#fff}',
    '.vani-powered{text-align:center;padding:6px;font-size:10px;color:#4a5568;background:#0d0f18}',
    '.vani-powered a{color:#6366f1;text-decoration:none}',
    '@keyframes vani-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes vani-bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}}',
    '@media(max-width:480px){#vani-widget-panel{width:100%;height:100%;max-height:100vh;border-radius:0;top:0!important;left:0!important;right:0!important;bottom:0!important}}',
  ].join('\n');
  document.head.appendChild(style);

  // ── Root ────────────────────────────────────────────────────────────────

  var root = document.createElement('div');
  root.id = 'vani-widget-root';
  document.body.appendChild(root);

  // ── Fetch config ────────────────────────────────────────────────────────

  fetch(API + '/widget/config?widget_key=' + encodeURIComponent(KEY))
    .then(function(r) { return r.json() })
    .then(function(c) {
      config = c;
      render();
    })
    .catch(function(e) { console.warn('[Vani] Config fetch failed:', e) });

  // ── Render ──────────────────────────────────────────────────────────────

  function render() {
    if (!config) return;
    var color = config.theme_color || '#6366f1';
    var pos = config.position || 'bottom-right';
    var isRight = pos === 'bottom-right';

    root.innerHTML = '';

    // ── Floating button ──
    var btn = document.createElement('button');
    btn.id = 'vani-widget-btn';
    btn.style.cssText = 'background:' + color + ';bottom:20px;' + (isRight ? 'right:20px' : 'left:20px');
    btn.innerHTML = isOpen
      ? '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';
    btn.onclick = function() { isOpen = !isOpen; render() };
    root.appendChild(btn);

    // ── Chat panel ──
    var panel = document.createElement('div');
    panel.id = 'vani-widget-panel';
    panel.style.cssText = 'background:#0d0f18;bottom:88px;' + (isRight ? 'right:20px' : 'left:20px');
    if (isOpen) setTimeout(function() { panel.classList.add('open') }, 10);

    // Header
    var header = document.createElement('div');
    header.className = 'vani-header';
    header.style.background = color;

    var avatarEl = document.createElement('div');
    avatarEl.className = 'vani-header-avatar';
    if (config.avatar_url) {
      avatarEl.innerHTML = '<img src="' + config.avatar_url + '" alt="">';
    } else {
      avatarEl.textContent = (config.agent_name || 'A')[0].toUpperCase();
    }

    var infoEl = document.createElement('div');
    infoEl.className = 'vani-header-info';
    infoEl.innerHTML = '<h3>' + esc(config.agent_name || 'Assistant') + '</h3><p>Online</p>';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'vani-header-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() { isOpen = false; render() };

    header.appendChild(avatarEl);
    header.appendChild(infoEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Messages
    var msgsEl = document.createElement('div');
    msgsEl.className = 'vani-messages';

    // Show greeting if no messages yet
    var displayMsgs = messages.length > 0 ? messages : [{ role: 'assistant', content: config.greeting || 'Hi! How can I help?' }];
    displayMsgs.forEach(function(m) {
      if (m.role === 'system') return;
      var bubble = document.createElement('div');
      bubble.className = 'vani-msg ' + (m.role === 'user' ? 'user' : 'bot');
      if (m.role === 'user') bubble.style.background = color;
      bubble.textContent = m.content;
      msgsEl.appendChild(bubble);
    });

    if (isLoading) {
      var typing = document.createElement('div');
      typing.className = 'vani-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      msgsEl.appendChild(typing);
    }

    panel.appendChild(msgsEl);

    // Input
    var inputArea = document.createElement('div');
    inputArea.className = 'vani-input-area';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.placeholder || 'Type a message...';
    input.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input.value) } };

    var sendBtn = document.createElement('button');
    sendBtn.className = 'vani-send-btn';
    sendBtn.style.background = color;
    sendBtn.disabled = isLoading;
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill="none"/></svg>';
    sendBtn.onclick = function() { sendMsg(input.value) };

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    panel.appendChild(inputArea);

    // Powered by
    if (config.powered_by !== false) {
      var powered = document.createElement('div');
      powered.className = 'vani-powered';
      powered.innerHTML = 'Powered by <a href="https://vani.live" target="_blank" rel="noopener">Vani</a>';
      panel.appendChild(powered);
    }

    root.appendChild(panel);

    // Scroll to bottom + focus
    if (isOpen) {
      setTimeout(function() {
        msgsEl.scrollTop = msgsEl.scrollHeight;
        input.focus();
      }, 50);
    }
  }

  // ── Send message ──────────────────────────────────────────────────────

  function sendMsg(text) {
    text = (text || '').trim();
    if (!text || isLoading) return;

    messages.push({ role: 'user', content: text });
    isLoading = true;
    render();

    fetch(API + '/widget/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widget_key: KEY,
        message: text,
        session_id: sessionId,
        visitor_id: visitorId,
      }),
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      sessionId = data.session_id;
      localStorage.setItem(SESSION_KEY, sessionId);
      messages = data.messages || messages;
      isLoading = false;
      render();
    })
    .catch(function(err) {
      console.error('[Vani] Chat error:', err);
      messages.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' });
      isLoading = false;
      render();
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
})();
