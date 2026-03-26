import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';
import '../../core/services/auth_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsState();
}

class _SettingsState extends ConsumerState<SettingsScreen> {
  VaniAgent? _agent;
  PhoneNumber? _phone;
  bool _loading = true;
  bool _saving = false;

  final _nameCtrl = TextEditingController();
  final _greetingCtrl = TextEditingController();
  final _promptCtrl = TextEditingController();
  String _voice = 'nova';
  String _language = 'en';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final agents = await VaniApi.instance.listAgents();
      final numbers = await VaniApi.instance.listNumbers();
      if (agents.isNotEmpty) {
        _agent = agents.first;
        _nameCtrl.text = _agent!.name;
        _greetingCtrl.text = _agent!.greeting ?? '';
        _promptCtrl.text = _agent!.prompt ?? '';
        _voice = _agent!.voice;
        _language = _agent!.language;
      }
      _phone = numbers.isNotEmpty ? numbers.first : null;
      if (mounted) setState(() => _loading = false);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_agent == null) return;
    setState(() => _saving = true);
    try {
      await VaniApi.instance.updateAgent(_agent!.id, {
        'name': _nameCtrl.text,
        'greeting': _greetingCtrl.text,
        'prompt': _promptCtrl.text,
        'voice': _voice,
        'language': _language,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved'), backgroundColor: V.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Settings', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: V.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Profile
                  _card([
                    Row(children: [
                      Container(
                        width: 46, height: 46,
                        decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(13)),
                        child: Center(child: Text((user?.name ?? 'V')[0].toUpperCase(), style: const TextStyle(color: V.primary, fontWeight: FontWeight.w700, fontSize: 18))),
                      ),
                      const SizedBox(width: 14),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(user?.name ?? 'User', style: const TextStyle(color: V.text, fontWeight: FontWeight.w600, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(user?.email ?? '', style: const TextStyle(color: V.textMuted, fontSize: 13)),
                      ]),
                    ]),
                  ]).animate().fadeIn(),

                  const SizedBox(height: 16),

                  // Phone
                  _card([
                    _header(Icons.phone_outlined, 'Phone Number'),
                    const SizedBox(height: 12),
                    _phone != null
                        ? Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(10)),
                            child: Row(children: [
                              const Icon(Icons.check_circle, color: V.green, size: 18),
                              const SizedBox(width: 10),
                              Text(_phone!.number, style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 16, letterSpacing: 0.5)),
                            ]),
                          )
                        : const Text('No number assigned', style: TextStyle(color: V.textMuted, fontSize: 13)),
                  ]).animate().fadeIn(delay: 50.ms),

                  const SizedBox(height: 16),

                  // Agent
                  _card([
                    _header(Icons.smart_toy_outlined, 'Agent Settings'),
                    const SizedBox(height: 14),
                    _label('Agent name'), _input(_nameCtrl, 'e.g. Reception Bot'),
                    _label('Greeting'), _input(_greetingCtrl, 'What agent says first', lines: 2),
                    _label('Instructions'), _input(_promptCtrl, 'How agent should behave...', lines: 4),
                  ]).animate().fadeIn(delay: 100.ms),

                  const SizedBox(height: 16),

                  // Voice
                  _card([
                    _header(Icons.record_voice_over_outlined, 'Voice & Language'),
                    const SizedBox(height: 14),
                    _label('Voice'),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: ['nova', 'alloy', 'echo', 'shimmer', 'priya', 'shreya'].map((v) => _chip(v, _voice, (val) => setState(() => _voice = val))).toList()),
                    _label('Language'),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      _chip('en', _language, (val) => setState(() => _language = val), label: 'English'),
                      _chip('hi', _language, (val) => setState(() => _language = val), label: 'Hindi'),
                      _chip('multi', _language, (val) => setState(() => _language = val), label: 'Multi'),
                    ]),
                  ]).animate().fadeIn(delay: 150.ms),

                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity, height: 52,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
                      child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  Center(child: GestureDetector(
                    onTap: () { ref.read(authProvider.notifier).logout(); Navigator.of(context).popUntil((r) => r.isFirst); },
                    child: const Text('Log out', style: TextStyle(color: V.red, fontSize: 14, fontWeight: FontWeight.w500)),
                  )),

                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _card(List<Widget> children) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: V.border),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _header(IconData icon, String title) => Row(children: [
    Container(width: 32, height: 32, decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: V.primary, size: 16)),
    const SizedBox(width: 10),
    Text(title, style: const TextStyle(color: V.text, fontSize: 16, fontWeight: FontWeight.w600)),
  ]);

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text(t, style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)));

  Widget _input(TextEditingController c, String hint, {int lines = 1}) => TextFormField(
    controller: c, maxLines: lines,
    style: const TextStyle(color: V.text, fontSize: 14),
    decoration: InputDecoration(hintText: hint, hintStyle: const TextStyle(color: V.textFaint), fillColor: V.surfaceMuted, filled: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13)),
  );

  Widget _chip(String value, String selected, Function(String) onTap, {String? label}) => GestureDetector(
    onTap: () => onTap(value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: selected == value ? V.primary : V.surfaceMuted,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected == value ? V.primary : V.border),
      ),
      child: Text(label ?? value[0].toUpperCase() + value.substring(1),
        style: TextStyle(color: selected == value ? Colors.white : V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
    ),
  );
}
