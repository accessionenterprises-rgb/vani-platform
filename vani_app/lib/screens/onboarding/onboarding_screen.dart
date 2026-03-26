import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingState();
}

class _OnboardingState extends ConsumerState<OnboardingScreen> {
  final _pageCtrl = PageController();
  int _page = 0;
  bool _submitting = false;

  final _bizNameCtrl = TextEditingController();
  final _bizTypeCtrl = TextEditingController();
  final _servicesCtrl = TextEditingController();
  final _hoursCtrl = TextEditingController();
  final _urlCtrl = TextEditingController();
  String _tone = 'friendly';
  String _language = 'en';
  bool _scanning = false;
  String? _scanResult;

  void _next() { if (_page < 2) { _pageCtrl.nextPage(duration: 350.ms, curve: Curves.easeInOut); setState(() => _page++); } else { _finish(); } }
  void _back() { if (_page > 0) { _pageCtrl.previousPage(duration: 350.ms, curve: Curves.easeInOut); setState(() => _page--); } }

  Future<void> _scanUrl() async {
    if (_urlCtrl.text.isEmpty) return;
    setState(() => _scanning = true);
    try {
      final agents = await VaniApi.instance.listAgents();
      final aid = agents.isNotEmpty ? agents.first.id : (await VaniApi.instance.createAgent({'name': '${_bizNameCtrl.text} Agent'})).id;
      final r = await VaniApi.instance.scanWebsite(_urlCtrl.text.trim(), aid);
      setState(() => _scanResult = 'Scanned ${r['pages_scanned'] ?? 0} pages');
    } catch (_) {
      setState(() => _scanResult = 'Scan failed');
    } finally {
      setState(() => _scanning = false);
    }
  }

  Future<void> _finish() async {
    setState(() => _submitting = true);
    try {
      final agents = await VaniApi.instance.listAgents();
      final prompt = 'You are a professional AI assistant for ${_bizNameCtrl.text}.\nBusiness: ${_bizTypeCtrl.text}\nServices: ${_servicesCtrl.text}\nHours: ${_hoursCtrl.text}\nTone: $_tone';
      if (agents.isEmpty) {
        await VaniApi.instance.createAgent({'name': '${_bizNameCtrl.text} Agent', 'prompt': prompt, 'language': _language});
      } else {
        await VaniApi.instance.updateAgent(agents.first.id, {'prompt': prompt, 'language': _language});
      }
    } catch (_) {}
    setState(() => _submitting = false);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
        title: const Text('Setup', style: TextStyle(color: V.text, fontWeight: FontWeight.w600)),
      ),
      body: Column(
        children: [
          // Progress
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Row(children: List.generate(3, (i) => Expanded(
              child: Container(
                height: 3, margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                decoration: BoxDecoration(color: i <= _page ? V.primary : V.border, borderRadius: BorderRadius.circular(2)),
              ),
            ))),
          ),
          Expanded(child: PageView(controller: _pageCtrl, physics: const NeverScrollableScrollPhysics(), children: [_p1(), _p2(), _p3()])),
          _bottom(),
        ],
      ),
    );
  }

  Widget _p1() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Tell us about\nyour business', style: TextStyle(color: V.text, fontSize: 26, fontWeight: FontWeight.w700, height: 1.2)).animate().fadeIn(),
      const SizedBox(height: 6),
      const Text('This helps your agent answer calls accurately', style: TextStyle(color: V.textMuted, fontSize: 14)),
      const SizedBox(height: 28),
      _lbl('Business name'), _inp(_bizNameCtrl, 'e.g. The Grand Hotel'),
      _lbl('Type'), _inp(_bizTypeCtrl, 'e.g. Hotel, Restaurant, Clinic'),
      _lbl('Services'), _inp(_servicesCtrl, 'e.g. Room booking, dining, spa', lines: 2),
      _lbl('Hours'), _inp(_hoursCtrl, 'e.g. Mon–Sat 9am–9pm'),
      _lbl('Tone'),
      const SizedBox(height: 8),
      Row(children: ['friendly', 'formal', 'sales'].map((t) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: _chip(t, _tone, (v) => setState(() => _tone = v)),
      )).toList()),
      _lbl('Language'),
      const SizedBox(height: 8),
      Row(children: [
        _chip('en', _language, (v) => setState(() => _language = v), label: 'English'),
        const SizedBox(width: 8),
        _chip('hi', _language, (v) => setState(() => _language = v), label: 'Hindi'),
      ]),
    ]),
  );

  Widget _p2() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Scan your website', style: TextStyle(color: V.text, fontSize: 26, fontWeight: FontWeight.w700)).animate().fadeIn(),
      const SizedBox(height: 6),
      const Text('Agent learns from your site automatically', style: TextStyle(color: V.textMuted, fontSize: 14)),
      const SizedBox(height: 28),
      Row(children: [
        Expanded(child: _inp(_urlCtrl, 'https://yourbusiness.com')),
        const SizedBox(width: 10),
        SizedBox(height: 50, child: ElevatedButton(
          onPressed: _scanning ? null : _scanUrl,
          style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: _scanning ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Scan'),
        )),
      ]),
      if (_scanResult != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(10)),
          child: Row(children: [const Icon(Icons.check_circle_outline, color: V.primary, size: 18), const SizedBox(width: 8), Text(_scanResult!, style: const TextStyle(color: V.primary, fontSize: 13))]),
        ),
      ],
      const SizedBox(height: 24),
      const Text('Social media', style: TextStyle(color: V.textSub, fontSize: 14, fontWeight: FontWeight.w500)),
      const SizedBox(height: 12),
      _inp(TextEditingController(), 'Instagram URL'),
      const SizedBox(height: 10),
      _inp(TextEditingController(), 'LinkedIn URL'),
    ]),
  );

  Widget _p3() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Upload documents', style: TextStyle(color: V.text, fontSize: 26, fontWeight: FontWeight.w700)).animate().fadeIn(),
      const SizedBox(height: 6),
      const Text('Menus, price lists, FAQs — agent reads everything', style: TextStyle(color: V.textMuted, fontSize: 14)),
      const SizedBox(height: 28),
      GestureDetector(
        onTap: () {},
        child: Container(
          width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 36),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: V.border)),
          child: const Column(children: [
            Icon(Icons.upload_file_outlined, color: V.primary, size: 36),
            SizedBox(height: 10),
            Text('Tap to upload', style: TextStyle(color: V.text, fontSize: 16, fontWeight: FontWeight.w500)),
            SizedBox(height: 4),
            Text('PDF, DOCX, TXT', style: TextStyle(color: V.textMuted, fontSize: 13)),
          ]),
        ),
      ),
      const SizedBox(height: 28),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(14)),
        child: const Row(children: [
          Icon(Icons.check_circle, color: V.primary, size: 20),
          SizedBox(width: 12),
          Expanded(child: Text("You're almost ready! Agent goes live after setup.", style: TextStyle(color: V.primary, fontSize: 14))),
        ]),
      ),
    ]),
  );

  Widget _bottom() => Padding(
    padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
    child: Row(children: [
      if (_page > 0) TextButton(onPressed: _back, child: const Text('Back', style: TextStyle(color: V.textMuted))),
      const Spacer(),
      SizedBox(width: 140, height: 50, child: ElevatedButton(
        onPressed: _submitting ? null : _next,
        style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        child: _submitting
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(_page < 2 ? 'Continue' : "Let's go →", style: const TextStyle(fontWeight: FontWeight.w600)),
      )),
    ]),
  );

  Widget _lbl(String t) => Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text(t, style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)));

  Widget _inp(TextEditingController c, String hint, {int lines = 1}) => TextFormField(
    controller: c, maxLines: lines,
    style: const TextStyle(color: V.text, fontSize: 14),
    decoration: InputDecoration(hintText: hint, hintStyle: const TextStyle(color: V.textFaint), fillColor: Colors.white, filled: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13)),
  );

  Widget _chip(String value, String selected, Function(String) onTap, {String? label}) => GestureDetector(
    onTap: () => onTap(value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: selected == value ? V.primary : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected == value ? V.primary : V.border),
      ),
      child: Text(label ?? value[0].toUpperCase() + value.substring(1),
        style: TextStyle(color: selected == value ? Colors.white : V.textSub, fontSize: 13)),
    ),
  );
}
