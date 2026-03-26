import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  List<VaniCall> _calls = [];
  VaniAgent? _agent;
  PhoneNumber? _phone;
  bool _loading = true;
  Timer? _poll;

  // Live call
  bool _liveActive = false;
  String _livePhone = '';
  int _liveSec = 0;
  Timer? _liveTick;
  List<String> _liveLines = [];

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 10), (_) => _load());
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  }

  @override
  void dispose() { _poll?.cancel(); _liveTick?.cancel(); super.dispose(); }

  Future<void> _load() async {
    try {
      final calls = await VaniApi.instance.listCalls();
      final agents = await VaniApi.instance.listAgents();
      final nums = await VaniApi.instance.listNumbers();
      if (!mounted) return;
      setState(() {
        _calls = calls; _loading = false;
        _agent = agents.isNotEmpty ? agents.first : null;
        _phone = nums.isNotEmpty ? nums.first : null;
      });
      final active = calls.where((c) => c.status == 'active').toList();
      if (active.isNotEmpty && !_liveActive) _goLive(active.first);
      else if (active.isEmpty && _liveActive) _endLive();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
      if (_liveActive) _endLive();
    }
  }

  void _goLive(VaniCall c) {
    setState(() { _liveActive = true; _livePhone = c.phone ?? 'Unknown'; _liveSec = 0; _liveLines = []; });
    _liveTick = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _liveSec++); });
  }
  void _endLive() { _liveTick?.cancel(); setState(() { _liveActive = false; _liveSec = 0; _liveLines = []; }); }

  int get _today => _calls.where((c) => c.startedAt != null && DateTime.now().difference(c.startedAt!).inHours < 24).length;
  int get _missed => _calls.where((c) => c.status == 'failed' || c.status == 'missed').length;
  String get _avg {
    final done = _calls.where((c) => c.durationSec != null && c.durationSec! > 0).toList();
    if (done.isEmpty) return '0s';
    final a = done.fold<int>(0, (s, c) => s + c.durationSec!) ~/ done.length;
    return a < 60 ? '${a}s' : '${a ~/ 60}m ${a % 60}s';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      backgroundColor: V.bg,
      drawer: _drawer(user),
      body: SafeArea(
        child: Column(
          children: [
            _topBar(user).animate().fadeIn(duration: 400.ms),
            const SizedBox(height: 16),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load, color: V.primary,
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    if (_liveActive) _liveBanner().animate().fadeIn().slideY(begin: -0.05),
                    // Agent + number card
                    _agentCard().animate().fadeIn(delay: 50.ms),
                    const SizedBox(height: 16),
                    _stats().animate().fadeIn(delay: 100.ms),
                    const SizedBox(height: 24),
                    // Quick actions
                    _quickActions().animate().fadeIn(delay: 150.ms),
                    const SizedBox(height: 24),
                    Row(children: [
                      const Text('Recent Calls', style: TextStyle(color: V.text, fontSize: 17, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      GestureDetector(onTap: () => Navigator.pushNamed(context, '/calls'),
                        child: const Text('See all', style: TextStyle(color: V.primary, fontSize: 13, fontWeight: FontWeight.w500))),
                    ]),
                    const SizedBox(height: 12),
                    if (_loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator(color: V.primary)))
                    else if (_calls.isEmpty) _empty()
                    else ..._calls.take(5).toList().asMap().entries.map((e) => _callRow(e.value).animate().fadeIn(delay: (200 + e.key * 40).ms)),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _topBar(VaniUser? user) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
    child: Row(children: [
      Builder(builder: (ctx) => _iconBtn(Icons.menu_rounded, () => Scaffold.of(ctx).openDrawer())),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(user?.businessName ?? user?.name ?? 'Dashboard', style: const TextStyle(color: V.text, fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Row(children: [
          Container(width: 6, height: 6, decoration: const BoxDecoration(shape: BoxShape.circle, color: V.green)),
          const SizedBox(width: 6),
          const Text('Agent online', style: TextStyle(color: V.textMuted, fontSize: 12)),
        ]),
      ])),
      _iconBtn(Icons.notifications_outlined, () {}),
    ]),
  );

  Widget _agentCard() => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF6D28D9)]),
      borderRadius: BorderRadius.circular(18),
      boxShadow: [BoxShadow(color: V.primary.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 6))],
    ),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_agent?.name ?? 'No agent', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(_phone?.number ?? 'No number assigned', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
          child: Text(_agent?.voice ?? 'nova', style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12, fontWeight: FontWeight.w500)),
        ),
      ])),
      Container(
        width: 52, height: 52,
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.mic_rounded, color: Colors.white, size: 24),
      ),
    ]),
  );

  Widget _stats() => Row(children: [
    _stat('Today', '$_today', Icons.call_received_rounded, V.primary),
    const SizedBox(width: 10),
    _stat('Total', '${_calls.length}', Icons.call_rounded, V.blue),
    const SizedBox(width: 10),
    _stat('Avg', _avg, Icons.timer_outlined, V.amber),
    const SizedBox(width: 10),
    _stat('Missed', '$_missed', Icons.call_missed_rounded, V.red),
  ]);

  Widget _stat(String label, String val, IconData icon, Color c) => Expanded(child: Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: V.border),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))]),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 28, height: 28, decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(7)),
        child: Icon(icon, color: c, size: 14)),
      const SizedBox(height: 8),
      Text(val, style: const TextStyle(color: V.text, fontSize: 18, fontWeight: FontWeight.w700)),
      Text(label, style: const TextStyle(color: V.textMuted, fontSize: 11)),
    ]),
  ));

  Widget _quickActions() => Row(children: [
    _action('Playground', Icons.play_circle_outline_rounded, V.primary, () => Navigator.pushNamed(context, '/playground')),
    const SizedBox(width: 10),
    _action('Dialer', Icons.dialpad_rounded, V.green, () => Navigator.pushNamed(context, '/dialer')),
    const SizedBox(width: 10),
    _action('KB', Icons.auto_stories_rounded, V.blue, () => Navigator.pushNamed(context, '/kb')),
    const SizedBox(width: 10),
    _action('Settings', Icons.tune_rounded, V.amber, () => Navigator.pushNamed(context, '/settings')),
  ]);

  Widget _action(String label, IconData icon, Color c, VoidCallback onTap) => Expanded(child: GestureDetector(
    onTap: () { HapticFeedback.lightImpact(); onTap(); },
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: V.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))]),
      child: Column(children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: c, size: 18)),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: V.textSub, fontSize: 12, fontWeight: FontWeight.w500)),
      ]),
    ),
  ));

  Widget _liveBanner() {
    final t = '${(_liveSec ~/ 60).toString().padLeft(2, '0')}:${(_liveSec % 60).toString().padLeft(2, '0')}';
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(gradient: const LinearGradient(colors: [V.green, Color(0xFF16A34A)]),
        borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: V.green.withOpacity(0.25), blurRadius: 20, offset: const Offset(0, 6))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, boxShadow: [BoxShadow(color: Colors.white.withOpacity(0.5), blurRadius: 8)])),
          const SizedBox(width: 10),
          const Text('Live Call', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
          const Spacer(),
          Text(t, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14, fontFamily: 'monospace')),
        ]),
        const SizedBox(height: 10),
        Text(_livePhone, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 16, fontWeight: FontWeight.w500)),
        if (_liveLines.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity, padding: const EdgeInsets.all(12),
            constraints: const BoxConstraints(maxHeight: 100),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
            child: SingleChildScrollView(reverse: true, child: Column(crossAxisAlignment: CrossAxisAlignment.start,
              children: _liveLines.map((l) => Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(l, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 13)))).toList())),
          ),
        ] else Padding(padding: const EdgeInsets.only(top: 6),
          child: Text('Waiting for transcript...', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13, fontStyle: FontStyle.italic))),
      ]),
    );
  }

  Widget _callRow(VaniCall c) {
    final isIn = c.direction == 'inbound';
    return Container(
      margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(13), border: Border.all(color: V.border)),
      child: Row(children: [
        Container(width: 38, height: 38, decoration: BoxDecoration(color: isIn ? const Color(0xFFDCFCE7) : const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(10)),
          child: Icon(isIn ? Icons.call_received : Icons.call_made, color: isIn ? V.green : V.blue, size: 17)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(c.phone ?? 'Unknown', style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 14)),
          const SizedBox(height: 2),
          Text(_ago(c.startedAt), style: const TextStyle(color: V.textMuted, fontSize: 12)),
        ])),
        Text(c.formattedDuration, style: const TextStyle(color: V.textSub, fontSize: 13)),
      ]),
    );
  }

  Widget _empty() => const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Column(children: [
    Icon(Icons.call_outlined, color: V.textFaint, size: 36),
    SizedBox(height: 10),
    Text('No calls yet', style: TextStyle(color: V.textMuted, fontSize: 14)),
  ]));

  Widget _iconBtn(IconData icon, VoidCallback onTap) => GestureDetector(
    onTap: () { HapticFeedback.lightImpact(); onTap(); },
    child: Container(width: 44, height: 44,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(13), border: Border.all(color: V.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8)]),
      child: Icon(icon, color: V.textSub, size: 20)),
  );

  String _ago(DateTime? dt) {
    if (dt == null) return '—';
    final d = DateTime.now().difference(dt);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inHours < 1) return '${d.inMinutes}m ago';
    if (d.inDays < 1) return '${d.inHours}h ago';
    return '${dt.day}/${dt.month}';
  }

  Widget _drawer(VaniUser? user) => Drawer(
    backgroundColor: Colors.transparent, width: MediaQuery.of(context).size.width * 0.78,
    child: ClipRRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
      child: Container(
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.92), border: Border(right: BorderSide(color: V.border))),
        child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6C3AE0)]), borderRadius: BorderRadius.circular(11)),
                child: const Icon(Icons.mic, color: Colors.white, size: 19)),
              const SizedBox(width: 12),
              const Text('Vani', style: TextStyle(color: V.text, fontSize: 22, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 32),
            _nav(Icons.dashboard_rounded, 'Dashboard', true, () => Navigator.pop(context)),
            _nav(Icons.play_circle_outline_rounded, 'Playground', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/playground'); }),
            _nav(Icons.dialpad_rounded, 'Dialer', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/dialer'); }),
            _nav(Icons.call_rounded, 'Call History', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/calls'); }),
            _nav(Icons.auto_stories_rounded, 'Knowledge Base', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/kb'); }),
            _nav(Icons.tune_rounded, 'Agent Settings', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/settings'); }),
            _nav(Icons.school_rounded, 'Setup Wizard', false, () { Navigator.pop(context); Navigator.pushNamed(context, '/onboarding'); }),
            const Spacer(),
            Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(14), border: Border.all(color: V.border)),
              child: Row(children: [
                Container(width: 36, height: 36, decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(10)),
                  child: Center(child: Text((user?.name ?? 'V')[0].toUpperCase(), style: const TextStyle(color: V.primary, fontWeight: FontWeight.w700, fontSize: 15)))),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user?.name ?? 'User', style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 14)),
                  Text(user?.email ?? '', style: const TextStyle(color: V.textMuted, fontSize: 12)),
                ])),
                GestureDetector(onTap: () { ref.read(authProvider.notifier).logout(); Navigator.of(context).popUntil((r) => r.isFirst); },
                  child: const Icon(Icons.logout_rounded, color: V.textMuted, size: 18)),
              ])),
          ]),
        )),
      ),
    )),
  );

  Widget _nav(IconData icon, String label, bool active, VoidCallback onTap) => GestureDetector(
    onTap: onTap, behavior: HitTestBehavior.opaque,
    child: Container(margin: const EdgeInsets.only(bottom: 2), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(color: active ? V.primaryBg : Colors.transparent, borderRadius: BorderRadius.circular(11)),
      child: Row(children: [
        Icon(icon, color: active ? V.primary : V.textMuted, size: 20), const SizedBox(width: 14),
        Text(label, style: TextStyle(color: active ? V.primary : V.textSub, fontSize: 15, fontWeight: active ? FontWeight.w600 : FontWeight.w400)),
      ])),
  );
}
