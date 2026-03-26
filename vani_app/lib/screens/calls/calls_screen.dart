import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';

class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  List<VaniCall> _calls = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final calls = await VaniApi.instance.listCalls();
      if (mounted) setState(() { _calls = calls; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Call History', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded, color: V.textMuted), onPressed: () { setState(() => _loading = true); _load(); }),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: V.primary))
          : _calls.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: V.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: _calls.length,
                    itemBuilder: (_, i) => _card(_calls[i]).animate().fadeIn(delay: (i * 40).ms),
                  ),
                ),
    );
  }

  Widget _empty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(18)),
              child: const Icon(Icons.call_outlined, color: V.primary, size: 28),
            ),
            const SizedBox(height: 16),
            const Text('No calls yet', style: TextStyle(color: V.text, fontSize: 17, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            const Text('Calls will appear here', style: TextStyle(color: V.textMuted, fontSize: 14)),
          ],
        ),
      );

  Widget _card(VaniCall call) {
    final isInbound = call.direction == 'inbound';
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => _DetailScreen(call: call))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: V.border),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Row(
          children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: isInbound ? const Color(0xFFDCFCE7) : const Color(0xFFDBEAFE),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(isInbound ? Icons.call_received : Icons.call_made, color: isInbound ? V.green : V.blue, size: 19),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(call.phone ?? 'Unknown', style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 15)),
                  const SizedBox(height: 3),
                  Text(_ago(call.startedAt), style: const TextStyle(color: V.textMuted, fontSize: 12)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(call.formattedDuration, style: const TextStyle(color: V.textSub, fontSize: 13)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: call.status == 'completed' ? const Color(0xFFDCFCE7) : V.surfaceMuted,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(call.status, style: TextStyle(color: call.status == 'completed' ? V.green : V.textMuted, fontSize: 11, fontWeight: FontWeight.w500)),
                ),
              ],
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: V.textFaint, size: 18),
          ],
        ),
      ),
    );
  }

  String _ago(DateTime? dt) {
    if (dt == null) return '—';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

class _DetailScreen extends StatefulWidget {
  final VaniCall call;
  const _DetailScreen({required this.call});
  @override
  State<_DetailScreen> createState() => _DetailState();
}

class _DetailState extends State<_DetailScreen> {
  VaniCall? _full;

  @override
  void initState() {
    super.initState();
    VaniApi.instance.getCall(widget.call.id).then((c) { if (mounted) setState(() => _full = c); }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final c = _full ?? widget.call;
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(backgroundColor: V.bg, title: Text(c.phone ?? 'Call', style: const TextStyle(color: V.text)),
          leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _row('Duration', c.formattedDuration),
            _row('Direction', c.direction),
            _row('Status', c.status),
            if (c.sentiment != null) _row('Sentiment', c.sentiment!),
            if (c.summary != null) _section('Summary', c.summary!),
            if (c.transcript != null) _section('Transcript', c.transcript!),
          ],
        ),
      ),
    );
  }

  Widget _row(String l, String v) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(children: [
      SizedBox(width: 90, child: Text(l, style: const TextStyle(color: V.textMuted, fontSize: 13))),
      Text(v, style: const TextStyle(color: V.text, fontWeight: FontWeight.w500)),
    ]),
  );

  Widget _section(String title, String body) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SizedBox(height: 16),
      Text(title, style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: V.border)),
        child: Text(body, style: const TextStyle(color: V.text, height: 1.6, fontSize: 14)),
      ),
    ],
  );
}
