import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';
import 'agent_form_screen.dart';

class AgentsListScreen extends StatefulWidget {
  const AgentsListScreen({super.key});
  @override
  State<AgentsListScreen> createState() => _AgentsListScreenState();
}

class _AgentsListScreenState extends State<AgentsListScreen> {
  List<VaniAgent> _agents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final agents = await VaniApi.instance.listAgents();
      if (mounted) setState(() { _agents = agents; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(VaniAgent agent) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Agent?'),
        content: Text('This will permanently delete "${agent.name}" and all its data.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: V.red))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await VaniApi.instance.deleteAgent(agent.id);
      setState(() => _agents.removeWhere((a) => a.id == agent.id));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Agent deleted'), backgroundColor: V.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
    }
  }

  void _openForm({VaniAgent? agent}) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => AgentFormScreen(agent: agent)),
    );
    if (result == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Agents', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); _openForm(); },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: V.primary, borderRadius: BorderRadius.circular(10)),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.add, color: Colors.white, size: 16),
                  SizedBox(width: 4),
                  Text('Create', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                ]),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: V.primary))
          : _agents.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: V.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _agents.length,
                    itemBuilder: (_, i) => _card(_agents[i]).animate().fadeIn(delay: (i * 40).ms),
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: V.primary,
        onPressed: () => _openBuilderChat(context),
        child: const Icon(Icons.chat_rounded, color: Colors.white),
      ),
    );
  }

  void _openBuilderChat(BuildContext ctx) {
    final sessionId = 'builder-${Random().nextInt(999999)}';
    final messages = <Map<String, String>>[
      {'role': 'assistant', 'text': 'What kind of agent do you want to build? Tell me about your business and I\'ll set it up for you.'},
    ];
    final textCtrl = TextEditingController();
    bool sending = false;

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: V.border)),
                ),
                child: Row(children: [
                  const Icon(Icons.smart_toy, color: V.primary, size: 20),
                  const SizedBox(width: 8),
                  const Text('Agent Builder', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.close, color: V.textMuted),
                  ),
                ]),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final m = messages[i];
                    final isUser = m['role'] == 'user';
                    return Align(
                      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                        decoration: BoxDecoration(
                          color: isUser ? V.primary : V.surfaceMuted,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(m['text']!, style: TextStyle(color: isUser ? Colors.white : V.text, fontSize: 14)),
                      ),
                    );
                  },
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: V.border))),
                child: SafeArea(
                  top: false,
                  child: Row(children: [
                    Expanded(
                      child: TextField(
                        controller: textCtrl,
                        decoration: InputDecoration(
                          hintText: 'Describe your agent...',
                          hintStyle: const TextStyle(color: V.textMuted),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: sending ? null : () async {
                        final text = textCtrl.text.trim();
                        if (text.isEmpty) return;
                        setSheetState(() {
                          messages.add({'role': 'user', 'text': text});
                          sending = true;
                        });
                        textCtrl.clear();
                        try {
                          final res = await VaniApi.instance.builderChat(text, sessionId);
                          final reply = res['response'] ?? res['message'] ?? 'I understand. Let me set that up.';
                          setSheetState(() {
                            messages.add({'role': 'assistant', 'text': reply.toString()});
                            sending = false;
                          });
                        } catch (e) {
                          setSheetState(() {
                            messages.add({'role': 'assistant', 'text': 'Sorry, something went wrong. Try again.'});
                            sending = false;
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: V.primary, borderRadius: BorderRadius.circular(12)),
                        child: sending
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      ),
                    ),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  }

  Widget _empty() => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 64, height: 64,
        decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(18)),
        child: const Icon(Icons.smart_toy_outlined, color: V.primary, size: 28),
      ),
      const SizedBox(height: 16),
      const Text('No agents yet', style: TextStyle(color: V.text, fontSize: 17, fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      const Text('Create your first AI voice agent', style: TextStyle(color: V.textMuted, fontSize: 14)),
      const SizedBox(height: 24),
      ElevatedButton.icon(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Create Agent'),
        style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
      ),
    ]),
  );

  Widget _card(VaniAgent agent) {
    return Dismissible(
      key: Key(agent.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(color: V.red, borderRadius: BorderRadius.circular(14)),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      confirmDismiss: (_) async {
        await _delete(agent);
        return false; // we handle removal in _delete
      },
      child: GestureDetector(
        onTap: () => _openForm(agent: agent),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: V.border),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Row(children: [
            Container(
              width: 46, height: 46,
              decoration: BoxDecoration(
                gradient: agent.active
                    ? const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6C3AE0)])
                    : null,
                color: agent.active ? null : V.surfaceMuted,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(Icons.smart_toy_outlined, color: agent.active ? Colors.white : V.textMuted, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(agent.name, style: const TextStyle(color: V.text, fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 3),
              Text(
                agent.greeting ?? 'No greeting set',
                style: const TextStyle(color: V.textMuted, fontSize: 13),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 4, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: agent.active ? const Color(0xFFDCFCE7) : V.surfaceMuted,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    agent.active ? 'Active' : 'Inactive',
                    style: TextStyle(color: agent.active ? V.green : V.textMuted, fontSize: 11, fontWeight: FontWeight.w500),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(6)),
                  child: Text(agent.llmProvider, style: const TextStyle(color: V.textSub, fontSize: 11), overflow: TextOverflow.ellipsis),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(6)),
                  child: Text(agent.voice, style: const TextStyle(color: V.textSub, fontSize: 11), overflow: TextOverflow.ellipsis),
                ),
              ]),
            ])),
            const Icon(Icons.chevron_right, color: V.textFaint, size: 20),
          ]),
        ),
      ),
    );
  }
}
