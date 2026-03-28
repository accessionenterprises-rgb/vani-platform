import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';
import '../../core/services/auth_service.dart';

// ─── Provider / Voice data ─────────────────────────────────────

class _TtsProviderInfo {
  final String key;
  final String label;
  final List<_VoiceInfo> voices;
  const _TtsProviderInfo(this.key, this.label, this.voices);
}

class _VoiceInfo {
  final String name;
  final String? id; // if voice id differs from name
  final bool isMale;
  const _VoiceInfo(this.name, {this.id, this.isMale = false});
  String get value => id ?? name;
}

class _LlmOption {
  final String key;
  final String label;
  const _LlmOption(this.key, this.label);
}

class _SttOption {
  final String key;
  final String label;
  const _SttOption(this.key, this.label);
}

// ─── Static catalogues ──────────────────────────────────────────

final _ttsProviders = <_TtsProviderInfo>[
  _TtsProviderInfo('openai', 'OpenAI', [
    _VoiceInfo('alloy'), _VoiceInfo('ash', isMale: true), _VoiceInfo('ballad', isMale: true),
    _VoiceInfo('cedar', isMale: true), _VoiceInfo('coral'), _VoiceInfo('echo', isMale: true),
    _VoiceInfo('fable'), _VoiceInfo('marin'), _VoiceInfo('nova'),
    _VoiceInfo('onyx', isMale: true), _VoiceInfo('sage'), _VoiceInfo('shimmer'), _VoiceInfo('verse'),
  ]),
  _TtsProviderInfo('sarvam-v2', 'Sarvam v2 \u00b7 \u20b90.83/min', [
    _VoiceInfo('anushka'), _VoiceInfo('abhilash', isMale: true), _VoiceInfo('manisha'),
    _VoiceInfo('vidya'), _VoiceInfo('arya', isMale: true), _VoiceInfo('karun', isMale: true),
    _VoiceInfo('hitesh', isMale: true),
  ]),
  _TtsProviderInfo('sarvam-v3', 'Sarvam v3 \u00b7 \u20b91.65/min', [
    _VoiceInfo('shreya'), _VoiceInfo('amelia'), _VoiceInfo('sophia'), _VoiceInfo('priya'),
    _VoiceInfo('neha'), _VoiceInfo('kavya'), _VoiceInfo('simran'), _VoiceInfo('ritu'),
    _VoiceInfo('pooja'), _VoiceInfo('ishita'), _VoiceInfo('roopa'), _VoiceInfo('tanya'),
    _VoiceInfo('shruti'), _VoiceInfo('suhani'), _VoiceInfo('rupali'), _VoiceInfo('kavitha'),
    _VoiceInfo('rahul', isMale: true), _VoiceInfo('amit', isMale: true), _VoiceInfo('dev', isMale: true),
    _VoiceInfo('rohan', isMale: true), _VoiceInfo('kabir', isMale: true), _VoiceInfo('aditya', isMale: true),
    _VoiceInfo('ashutosh', isMale: true), _VoiceInfo('ratan', isMale: true), _VoiceInfo('varun', isMale: true),
    _VoiceInfo('manan', isMale: true), _VoiceInfo('sumit', isMale: true), _VoiceInfo('aayan', isMale: true),
    _VoiceInfo('shubh', isMale: true), _VoiceInfo('advait', isMale: true), _VoiceInfo('anand', isMale: true),
    _VoiceInfo('tarun', isMale: true), _VoiceInfo('sunny', isMale: true), _VoiceInfo('mani', isMale: true),
    _VoiceInfo('gokul', isMale: true), _VoiceInfo('vijay', isMale: true), _VoiceInfo('mohit', isMale: true),
    _VoiceInfo('rehan', isMale: true), _VoiceInfo('soham', isMale: true),
  ]),
  _TtsProviderInfo('cartesia', 'Cartesia', [
    _VoiceInfo('Brooke', id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b'),
    _VoiceInfo('Blake', isMale: true), _VoiceInfo('Caroline'), _VoiceInfo('Katie'),
    _VoiceInfo('Jacqueline'), _VoiceInfo('Ronald', isMale: true),
  ]),
  _TtsProviderInfo('elevenlabs', 'ElevenLabs', [
    _VoiceInfo('Sarah', id: 'EXAVITQu4vr4xnSDxMaL'), _VoiceInfo('Rachel'), _VoiceInfo('Laura'),
    _VoiceInfo('Alice'), _VoiceInfo('Matilda'), _VoiceInfo('Jessica'),
    _VoiceInfo('Bella'), _VoiceInfo('Lily'), _VoiceInfo('Aria'),
  ]),
  _TtsProviderInfo('amazon-polly', 'Amazon Polly Neural', [
    _VoiceInfo('Danielle'), _VoiceInfo('Ruth'), _VoiceInfo('Joanna'),
    _VoiceInfo('Kendra'), _VoiceInfo('Kimberly'), _VoiceInfo('Salli'), _VoiceInfo('Ivy'),
  ]),
  _TtsProviderInfo('google-cloud', 'Google Cloud', [
    _VoiceInfo('en-US-Neural2-C'), _VoiceInfo('en-US-Neural2-F'), _VoiceInfo('en-US-Neural2-H'),
  ]),
  _TtsProviderInfo('azure', 'Azure Neural', [
    _VoiceInfo('en-US-JennyNeural'), _VoiceInfo('en-US-AriaNeural'),
  ]),
  _TtsProviderInfo('gemini-live', 'Gemini Live \u00b7 \u20b92.19/min', [
    _VoiceInfo('Puck', id: 'Puck', isMale: true), _VoiceInfo('Zephyr', id: 'Zephyr'),
    _VoiceInfo('Kore', id: 'Kore'), _VoiceInfo('Charon', id: 'Charon', isMale: true),
    _VoiceInfo('Aoede', id: 'Aoede'), _VoiceInfo('Leda', id: 'Leda'),
    _VoiceInfo('Fenrir', id: 'Fenrir', isMale: true), _VoiceInfo('Orus', id: 'Orus', isMale: true),
    _VoiceInfo('Erinome', id: 'Erinome'), _VoiceInfo('Autonoe', id: 'Autonoe'),
    _VoiceInfo('Umbriel', id: 'Umbriel', isMale: true), _VoiceInfo('Schedar', id: 'Schedar', isMale: true),
    _VoiceInfo('Gacrux', id: 'Gacrux', isMale: true), _VoiceInfo('Achernar', id: 'Achernar'),
    _VoiceInfo('Sulafat', id: 'Sulafat'), _VoiceInfo('Despina', id: 'Despina'),
    _VoiceInfo('Algieba', id: 'Algieba', isMale: true), _VoiceInfo('Laomedeia', id: 'Laomedeia'),
    _VoiceInfo('Achird', id: 'Achird', isMale: true), _VoiceInfo('Sadachbia', id: 'Sadachbia', isMale: true),
    _VoiceInfo('Enceladus', id: 'Enceladus', isMale: true), _VoiceInfo('Algenib', id: 'Algenib', isMale: true),
    _VoiceInfo('Zubenelgenubi', id: 'Zubenelgenubi', isMale: true), _VoiceInfo('Sadaltager', id: 'Sadaltager', isMale: true),
    _VoiceInfo('Callirrhoe', id: 'Callirrhoe'), _VoiceInfo('Iapetus', id: 'Iapetus', isMale: true),
    _VoiceInfo('Rasalgethi', id: 'Rasalgethi', isMale: true), _VoiceInfo('Alnilam', id: 'Alnilam', isMale: true),
    _VoiceInfo('Pulcherrima', id: 'Pulcherrima'), _VoiceInfo('Vindemiatrix', id: 'Vindemiatrix'),
  ]),
];

final _llmOptions = <_LlmOption>[
  _LlmOption('llama-3.3-70b', 'Groq Llama 3.3 70B \u00b7 Fastest'),
  _LlmOption('gpt-4o-mini', 'GPT-4o-mini'),
  _LlmOption('gpt-4.1-mini', 'GPT-4.1-mini'),
  _LlmOption('gpt-5-mini', 'GPT-5-mini'),
  _LlmOption('deepseek-chat', 'DeepSeek V3'),
  _LlmOption('gemini-2.0-flash', 'Gemini 2.0 Flash'),
];

final _sttOptions = <_SttOption>[
  _SttOption('deepgram-nova-3', 'Deepgram Nova-3 \u00b7 Default'),
];

// ─── Screen ─────────────────────────────────────────────────────

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
  bool _previewPlaying = false;

  final _nameCtrl = TextEditingController();
  final _greetingCtrl = TextEditingController();
  final _promptCtrl = TextEditingController();

  String _voice = 'nova';
  String _ttsProvider = 'openai';
  String _llmProvider = 'gpt-4o-mini';
  String _sttProvider = 'deepgram-nova-3';
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
        _ttsProvider = _agent!.ttsProvider;
        _llmProvider = _agent!.llmProvider;
        _sttProvider = _agent!.sttProvider;
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
        'tts_provider': _ttsProvider,
        'llm_provider': _llmProvider,
        'stt_provider': _sttProvider,
        'language': _language,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved'), backgroundColor: V.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _previewVoice(String voiceVal) async {
    if (_previewPlaying) return;
    setState(() => _previewPlaying = true);
    try {
      // Fire and forget -- server plays preview or returns bytes
      await VaniApi.instance.ttsPreview(_ttsProvider, voiceVal, text: 'Hello, how can I help you today?');
    } catch (_) {
      // preview not critical
    } finally {
      if (mounted) setState(() => _previewPlaying = false);
    }
  }

  _TtsProviderInfo get _currentTtsProvider {
    return _ttsProviders.firstWhere(
      (p) => p.key == _ttsProvider,
      orElse: () => _ttsProviders.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Settings', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: V.text),
          onPressed: () => Navigator.pop(context),
        ),
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
                        child: Center(
                          child: Text(
                            (user?.name ?? 'V')[0].toUpperCase(),
                            style: const TextStyle(color: V.primary, fontWeight: FontWeight.w700, fontSize: 18),
                          ),
                        ),
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

                  // Agent config
                  _card([
                    _header(Icons.smart_toy_outlined, 'Agent Settings'),
                    const SizedBox(height: 14),
                    _label('Agent name'),
                    _input(_nameCtrl, 'e.g. Reception Bot'),
                    _label('Greeting'),
                    _input(_greetingCtrl, 'What agent says first', lines: 2),
                    _label('Instructions'),
                    _input(_promptCtrl, 'How agent should behave...', lines: 8, maxLines: 20),
                  ]).animate().fadeIn(delay: 100.ms),

                  const SizedBox(height: 16),

                  // TTS provider + voices
                  _card([
                    _header(Icons.record_voice_over_outlined, 'TTS Provider'),
                    const SizedBox(height: 14),
                    _dropdownField<String>(
                      value: _ttsProvider,
                      items: _ttsProviders.map((p) => DropdownMenuItem(value: p.key, child: Text(p.label, style: const TextStyle(fontSize: 14)))).toList(),
                      onChanged: (v) {
                        if (v == null) return;
                        setState(() {
                          _ttsProvider = v;
                          // auto-select first voice of new provider
                          final voices = _currentTtsProvider.voices;
                          if (voices.isNotEmpty) _voice = voices.first.value;
                        });
                      },
                    ),
                    if (_ttsProvider == 'gemini-live') ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFFE082))),
                        child: const Text('Gemini Live is a speech-to-speech model. It replaces STT + LLM + TTS with a single model. STT and LLM selections above will be ignored.',
                          style: TextStyle(color: Color(0xFF795548), fontSize: 12)),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text('Voices', style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 10),
                    _voiceGrid(),
                  ]).animate().fadeIn(delay: 150.ms),

                  const SizedBox(height: 16),

                  // LLM provider
                  _card([
                    _header(Icons.psychology_outlined, 'LLM Provider'),
                    const SizedBox(height: 14),
                    _dropdownField<String>(
                      value: _llmProvider,
                      items: _llmOptions.map((o) => DropdownMenuItem(value: o.key, child: Text(o.label, style: const TextStyle(fontSize: 14)))).toList(),
                      onChanged: (v) { if (v != null) setState(() => _llmProvider = v); },
                    ),
                  ]).animate().fadeIn(delay: 200.ms),

                  const SizedBox(height: 16),

                  // STT provider
                  _card([
                    _header(Icons.hearing_outlined, 'STT Provider'),
                    const SizedBox(height: 14),
                    _dropdownField<String>(
                      value: _sttProvider,
                      items: _sttOptions.map((o) => DropdownMenuItem(value: o.key, child: Text(o.label, style: const TextStyle(fontSize: 14)))).toList(),
                      onChanged: (v) { if (v != null) setState(() => _sttProvider = v); },
                    ),
                  ]).animate().fadeIn(delay: 250.ms),

                  const SizedBox(height: 16),

                  // Language
                  _card([
                    _header(Icons.language_outlined, 'Language'),
                    const SizedBox(height: 14),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      _chip('en', _language, (val) => setState(() => _language = val), label: 'English'),
                      _chip('hi', _language, (val) => setState(() => _language = val), label: 'Hindi'),
                      _chip('multi', _language, (val) => setState(() => _language = val), label: 'Multi'),
                    ]),
                  ]).animate().fadeIn(delay: 300.ms),

                  const SizedBox(height: 24),

                  // Save button
                  SizedBox(
                    width: double.infinity, height: 52,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: V.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                      ),
                      child: _saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  Center(
                    child: GestureDetector(
                      onTap: () {
                        ref.read(authProvider.notifier).logout();
                        Navigator.of(context).popUntil((r) => r.isFirst);
                      },
                      child: const Text('Log out', style: TextStyle(color: V.red, fontSize: 14, fontWeight: FontWeight.w500)),
                    ),
                  ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  // ─── Voice grid ────────────────────────────────────────────────

  Widget _voiceGrid() {
    final voices = _currentTtsProvider.voices;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: voices.map((v) {
        final selected = _voice == v.value;
        return GestureDetector(
          onTap: () {
            setState(() => _voice = v.value);
            _previewVoice(v.value);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: selected ? V.primary : V.surfaceMuted,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: selected ? V.primary : V.border, width: selected ? 1.5 : 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  v.isMale ? Icons.male_rounded : Icons.female_rounded,
                  size: 14,
                  color: selected ? Colors.white70 : V.textMuted,
                ),
                const SizedBox(width: 6),
                Text(
                  v.name,
                  style: TextStyle(
                    color: selected ? Colors.white : V.textSub,
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
                if (selected) ...[
                  const SizedBox(width: 6),
                  const Icon(Icons.check_rounded, size: 14, color: Colors.white),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  // ─── Shared widgets ───────────────────────────────────────────

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
    Container(
      width: 32, height: 32,
      decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: V.primary, size: 16),
    ),
    const SizedBox(width: 10),
    Text(title, style: const TextStyle(color: V.text, fontSize: 16, fontWeight: FontWeight.w600)),
  ]);

  Widget _label(String t) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 8),
    child: Text(t, style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
  );

  Widget _input(TextEditingController c, String hint, {int lines = 1, int? maxLines}) => TextFormField(
    controller: c,
    minLines: lines,
    maxLines: maxLines ?? lines,
    style: const TextStyle(color: V.text, fontSize: 14),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: V.textFaint),
      fillColor: V.surfaceMuted,
      filled: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
  );

  Widget _dropdownField<T>({required T value, required List<DropdownMenuItem<T>> items, required ValueChanged<T?> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: V.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: V.border),
      ),
      child: DropdownButton<T>(
        value: items.any((i) => i.value == value) ? value : items.first.value,
        items: items,
        onChanged: onChanged,
        isExpanded: true,
        underline: const SizedBox(),
        dropdownColor: Colors.white,
        style: const TextStyle(color: V.text, fontSize: 14),
        icon: const Icon(Icons.expand_more_rounded, color: V.textMuted, size: 20),
      ),
    );
  }

  Widget _chip(String value, String selected, Function(String) onTap, {String? label}) => GestureDetector(
    onTap: () => onTap(value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: selected == value ? V.primary : V.surfaceMuted,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected == value ? V.primary : V.border),
      ),
      child: Text(
        label ?? value[0].toUpperCase() + value.substring(1),
        style: TextStyle(color: selected == value ? Colors.white : V.textSub, fontSize: 13, fontWeight: FontWeight.w500),
      ),
    ),
  );
}
