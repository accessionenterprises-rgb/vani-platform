import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';

class PlaygroundScreen extends StatefulWidget {
  const PlaygroundScreen({super.key});
  @override
  State<PlaygroundScreen> createState() => _PlaygroundState();
}

class _PlaygroundState extends State<PlaygroundScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  VaniAgent? _agent;

  // Chat
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final List<_ChatMsg> _messages = [];
  bool _sending = false;
  late String _sessionId;

  // Voice
  bool _voiceActive = false;
  int _voiceSec = 0;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _sessionId = _generateSessionId();
    _loadAgent();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  String _generateSessionId() {
    final r = Random();
    return 'pg_${DateTime.now().millisecondsSinceEpoch}_${r.nextInt(9999).toString().padLeft(4, '0')}';
  }

  Future<void> _loadAgent() async {
    try {
      final agents = await VaniApi.instance.listAgents();
      if (agents.isNotEmpty && mounted) {
        setState(() {
          _agent = agents.first;
          // Show greeting as first message
          if (_agent!.greeting != null && _agent!.greeting!.isNotEmpty) {
            _messages.add(_ChatMsg(_agent!.greeting!, false));
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _sendMsg() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _agent == null) return;
    _msgCtrl.clear();
    setState(() {
      _messages.add(_ChatMsg(text, true));
      _sending = true;
    });
    _scrollDown();

    try {
      final res = await VaniApi.instance.playgroundChat(_agent!.id, text, sessionId: _sessionId);
      final reply = res['reply'] ?? res['message'] ?? 'No response';
      setState(() => _messages.add(_ChatMsg(reply.toString(), false)));
    } catch (e) {
      setState(() => _messages.add(_ChatMsg('Error: $e', false)));
    } finally {
      setState(() => _sending = false);
      _scrollDown();
    }
  }

  void _clearChat() {
    setState(() {
      _messages.clear();
      _sessionId = _generateSessionId();
      // Re-add greeting
      if (_agent?.greeting != null && _agent!.greeting!.isNotEmpty) {
        _messages.add(_ChatMsg(_agent!.greeting!, false));
      }
    });
    // Best-effort server-side clear
    VaniApi.instance.clearPlaygroundChat(_sessionId).catchError((_) {});
  }

  void _scrollDown() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _toggleVoice() async {
    HapticFeedback.mediumImpact();
    if (_voiceActive) {
      setState(() => _voiceActive = false);
    } else {
      if (_agent == null) return;
      setState(() {
        _voiceActive = true;
        _voiceSec = 0;
      });
      try {
        await VaniApi.instance.startVoiceSession(agentId: _agent!.id);
        _countUp();
      } catch (e) {
        setState(() => _voiceActive = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
        }
      }
    }
  }

  void _countUp() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!_voiceActive || !mounted) return false;
      setState(() => _voiceSec++);
      return true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Playground', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: V.text),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (_tabCtrl.index == 0)
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: V.textMuted, size: 22),
              tooltip: 'Clear chat',
              onPressed: _clearChat,
            ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: V.primary,
          unselectedLabelColor: V.textMuted,
          indicatorColor: V.primary,
          indicatorSize: TabBarIndicatorSize.label,
          onTap: (_) => setState(() {}), // refresh actions
          tabs: const [
            Tab(text: 'Chat'),
            Tab(text: 'Voice'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _chatTab(),
          _voiceTab(),
        ],
      ),
    );
  }

  // ─── Chat Tab ────────────────────────────────────────────────

  Widget _chatTab() {
    return Column(
      children: [
        // Agent info bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          color: V.surfaceMuted,
          child: Row(children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.smart_toy_outlined, color: V.primary, size: 16),
            ),
            const SizedBox(width: 10),
            Text(_agent?.name ?? 'Loading...', style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 14)),
            const Spacer(),
            Text(_agent?.llmProvider ?? '', style: const TextStyle(color: V.textMuted, fontSize: 12)),
          ]),
        ),

        // Messages
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.chat_bubble_outline, color: V.textFaint, size: 40),
                    const SizedBox(height: 12),
                    const Text('Test your agent', style: TextStyle(color: V.textMuted, fontSize: 15)),
                    const SizedBox(height: 4),
                    const Text('Send a message to see how it responds', style: TextStyle(color: V.textFaint, fontSize: 13)),
                  ]),
                )
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length + (_sending ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == _messages.length) return _typingIndicator();
                    return _bubble(_messages[i]);
                  },
                ),
        ),

        // Input bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 16),
          decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: V.border))),
          child: SafeArea(
            top: false,
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  style: const TextStyle(color: V.text, fontSize: 15),
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    hintStyle: const TextStyle(color: V.textFaint),
                    fillColor: V.surfaceMuted,
                    filled: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: V.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: const BorderSide(color: V.primary)),
                  ),
                  onSubmitted: (_) => _sendMsg(),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _sending ? null : _sendMsg,
                child: Container(
                  width: 44, height: 44,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: V.primary),
                  child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                ),
              ),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _bubble(_ChatMsg msg) {
    final isUser = msg.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isUser ? V.primary : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isUser ? 18 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 18),
          ),
          border: isUser ? null : Border.all(color: V.border),
        ),
        child: Text(msg.text, style: TextStyle(color: isUser ? Colors.white : V.text, fontSize: 15, height: 1.4)),
      ),
    );
  }

  Widget _typingIndicator() => Align(
    alignment: Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: V.border)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (int i = 0; i < 3; i++) ...[
          Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: V.textFaint)),
          if (i < 2) const SizedBox(width: 4),
        ],
      ]),
    ),
  );

  // ─── Voice Tab ────────────────────────────────────────────────

  Widget _voiceTab() {
    final t = '${(_voiceSec ~/ 60).toString().padLeft(2, '0')}:${(_voiceSec % 60).toString().padLeft(2, '0')}';
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_agent?.name ?? 'Agent', style: const TextStyle(color: V.text, fontSize: 20, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            _voiceActive ? 'Connected  $t' : 'Test your agent via voice',
            style: TextStyle(color: _voiceActive ? V.green : V.textMuted, fontSize: 14),
          ),
          const SizedBox(height: 48),
          GestureDetector(
            onTap: _toggleVoice,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 120, height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _voiceActive ? V.red.withOpacity(0.1) : V.primaryBg,
                border: Border.all(color: _voiceActive ? V.red.withOpacity(0.3) : V.primary.withOpacity(0.2), width: 2),
              ),
              child: Icon(
                _voiceActive ? Icons.call_end_rounded : Icons.mic_rounded,
                color: _voiceActive ? V.red : V.primary,
                size: 44,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(_voiceActive ? 'Tap to end' : 'Tap to start', style: const TextStyle(color: V.textMuted, fontSize: 14)),
          const SizedBox(height: 32),
          if (!_voiceActive)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 40),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(14)),
              child: const Text(
                'Voice playground requires Flutter upgrade for LiveKit. Chat playground is fully functional.',
                style: TextStyle(color: V.textMuted, fontSize: 13, height: 1.4),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }
}

class _ChatMsg {
  final String text;
  final bool isUser;
  _ChatMsg(this.text, this.isUser);
}
