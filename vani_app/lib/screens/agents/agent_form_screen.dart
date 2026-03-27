import 'dart:io';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';

// ─── Voice catalogue ────────────────────────────────────────
class _Voice {
  final String name;
  final String? id; // null = name IS the id
  const _Voice(this.name, [this.id]);
  String get value => id ?? name.toLowerCase();
}

const _voicesByProvider = <String, List<_Voice>>{
  'openai': [
    _Voice('Alloy'), _Voice('Ash'), _Voice('Ballad'), _Voice('Cedar'),
    _Voice('Coral'), _Voice('Echo'), _Voice('Fable'), _Voice('Marin'),
    _Voice('Nova'), _Voice('Onyx'), _Voice('Sage'), _Voice('Shimmer'), _Voice('Verse'),
  ],
  'sarvam-v2': [
    _Voice('Anushka'), _Voice('Abhilash'), _Voice('Manisha'), _Voice('Vidya'),
    _Voice('Arya'), _Voice('Karun'), _Voice('Hitesh'),
  ],
  'sarvam-v3': [
    _Voice('Shreya'), _Voice('Amelia'), _Voice('Sophia'), _Voice('Priya'),
    _Voice('Neha'), _Voice('Kavya'), _Voice('Simran'), _Voice('Ritu'),
    _Voice('Pooja'), _Voice('Ishita'), _Voice('Roopa'), _Voice('Tanya'),
    _Voice('Shruti'), _Voice('Suhani'), _Voice('Rupali'), _Voice('Kavitha'),
    _Voice('Rahul'), _Voice('Amit'), _Voice('Dev'), _Voice('Rohan'),
    _Voice('Kabir'), _Voice('Aditya'), _Voice('Ashutosh'), _Voice('Ratan'),
    _Voice('Varun'), _Voice('Manan'), _Voice('Sumit'), _Voice('Aayan'),
    _Voice('Shubh'), _Voice('Advait'), _Voice('Anand'), _Voice('Tarun'),
    _Voice('Sunny'), _Voice('Mani'), _Voice('Gokul'), _Voice('Vijay'),
    _Voice('Mohit'), _Voice('Rehan'), _Voice('Soham'),
  ],
  'cartesia': [
    _Voice('Brooke', 'e07c00bc-4134-4eae-9ea4-1a55fb45746b'),
    _Voice('Blake', 'a167e0f3-df7e-4d52-a9c3-f949145efdab'),
    _Voice('Caroline', 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94'),
    _Voice('Katie', 'f786b574-daa5-4673-aa0c-cbe3e8534c02'),
  ],
  'elevenlabs': [
    _Voice('Sarah', 'EXAVITQu4vr4xnSDxMaL'),
    _Voice('Laura', 'FGY2WhTYpPnrIDTdsKH5'),
    _Voice('Alice', 'Xb7hH8MSUJpSbSDYk0k2'),
    _Voice('Jessica', 'cgSgspJ2msm6clMCkdW9'),
    _Voice('Bella', 'hpp4J3VqNfWAUOO0d1Us'),
  ],
};

const _llmOptions = <String, String>{
  'Groq Llama 3.3 70B': 'llama-3.3-70b',
  'GPT-4o-mini': 'gpt-4o-mini',
  'GPT-4.1-mini': 'gpt-4.1-mini',
  'GPT-5-mini': 'gpt-5-mini',
  'DeepSeek V3': 'deepseek-chat',
  'Gemini 2.0 Flash': 'gemini-2.0-flash',
};

const _sttOptions = <String, String>{
  'Deepgram Nova-3': 'deepgram-nova-3',
};

const _ttsOptions = <String, String>{
  'OpenAI': 'openai',
  'Sarvam v2': 'sarvam-v2',
  'Sarvam v3': 'sarvam-v3',
  'Cartesia': 'cartesia',
  'ElevenLabs': 'elevenlabs',
};

const _languages = <String, String>{
  'English': 'en',
  'Hindi': 'hi',
  'Tamil': 'ta',
  'Telugu': 'te',
  'Kannada': 'kn',
  'Malayalam': 'ml',
  'Bengali': 'bn',
  'Marathi': 'mr',
  'Gujarati': 'gu',
  'Multi': 'multi',
};

const _tones = ['friendly', 'professional', 'casual'];
const _objectives = ['support', 'sales', 'booking'];

// ─── Screen ─────────────────────────────────────────────────

class AgentFormScreen extends StatefulWidget {
  final VaniAgent? agent;
  const AgentFormScreen({super.key, this.agent});
  @override
  State<AgentFormScreen> createState() => _AgentFormScreenState();
}

class _AgentFormScreenState extends State<AgentFormScreen> {
  bool get _isEdit => widget.agent != null;
  bool _saving = false;

  // Basic
  final _nameCtrl = TextEditingController();
  final _greetingCtrl = TextEditingController();
  final _promptCtrl = TextEditingController();
  String _language = 'en';
  bool _active = true;

  // AI Stack
  String _llm = 'gpt-4o-mini';
  String _stt = 'deepgram-nova-3';
  String _tts = 'openai';
  String _voice = 'nova';

  // Tuning
  double _temperature = 0.7;
  double _maxTokens = 200;
  String _responseMode = 'balanced';

  // Call Settings
  double _endpointing = 300;
  double _silenceTimeout = 30;
  double _callTimeout = 600;
  bool _voicemailDetection = false;
  bool _dtmf = false;
  bool _noiseCancellation = true;
  final _finalMsgCtrl = TextEditingController();

  // Behavior
  String _tone = 'friendly';
  String _objective = 'support';
  final List<TextEditingController> _constraintCtrls = [];

  // KB
  List<KbDocument> _kbDocs = [];
  bool _kbLoading = false;
  bool _uploading = false;
  final _urlCtrl = TextEditingController();
  bool _scanningUrl = false;

  // Voice preview
  String? _previewingVoice;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _populateFromAgent(widget.agent!);
    if (_isEdit) _loadKb();
  }

  void _populateFromAgent(VaniAgent a) {
    _nameCtrl.text = a.name;
    _greetingCtrl.text = a.greeting ?? '';
    _promptCtrl.text = a.prompt ?? '';
    _language = a.language;
    _active = a.active;
    _llm = a.llmProvider;
    _stt = a.sttProvider;
    _tts = a.ttsProvider;
    _voice = a.voice;
    if (a.tuning != null) {
      _temperature = (a.tuning!['temperature'] ?? 0.7).toDouble();
      _maxTokens = (a.tuning!['max_tokens'] ?? 200).toDouble();
      _responseMode = a.tuning!['response_mode'] ?? 'balanced';
    }
    _endpointing = (a.endpointing ?? 300).toDouble();
    _silenceTimeout = (a.silenceTimeout ?? 30).toDouble();
    _callTimeout = (a.callTimeout ?? 600).toDouble();
    _voicemailDetection = a.voicemailDetection;
    _dtmf = a.dtmfEnabled;
    _noiseCancellation = a.noiseCancellation;
    _finalMsgCtrl.text = a.finalMessage ?? '';
    _tone = a.tone ?? 'friendly';
    _objective = a.objective ?? 'support';
    for (final c in a.constraints) {
      _constraintCtrls.add(TextEditingController(text: c));
    }
  }

  Future<void> _loadKb() async {
    if (!_isEdit) return;
    setState(() => _kbLoading = true);
    try {
      final docs = await VaniApi.instance.listKb(widget.agent!.id);
      if (mounted) setState(() { _kbDocs = docs; _kbLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _kbLoading = false);
    }
  }

  @override
  @override
  void dispose() {
    _audioPlayer.dispose();
    _nameCtrl.dispose();
    _greetingCtrl.dispose();
    _promptCtrl.dispose();
    _finalMsgCtrl.dispose();
    _urlCtrl.dispose();
    for (final c in _constraintCtrls) { c.dispose(); }
    super.dispose();
  }

  Map<String, dynamic> _buildBody() {
    return {
      'name': _nameCtrl.text.trim(),
      'greeting': _greetingCtrl.text.trim(),
      'prompt': _promptCtrl.text.trim(),
      'language': _language,
      'active': _active,
      'llm_provider': _llm,
      'stt_provider': _stt,
      'tts_provider': _tts,
      'voice': _voice,
      'tuning': {
        'temperature': _temperature,
        'max_tokens': _maxTokens.toInt(),
        'response_mode': _responseMode,
      },
      'call_settings': {
        'endpointing': _endpointing.toInt(),
        'silence_timeout': _silenceTimeout.toInt(),
        'call_timeout': _callTimeout.toInt(),
        'voicemail_detection': _voicemailDetection,
        'dtmf_enabled': _dtmf,
        'noise_cancellation': _noiseCancellation,
        'final_message': _finalMsgCtrl.text.trim(),
      },
      'behavior': {
        'tone': _tone,
        'objective': _objective,
        'constraints': _constraintCtrls.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList(),
      },
    };
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Agent name is required')));
      return;
    }
    setState(() => _saving = true);
    try {
      if (_isEdit) {
        await VaniApi.instance.updateAgent(widget.agent!.id, _buildBody());
      } else {
        await VaniApi.instance.createAgent(_buildBody());
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_isEdit ? 'Agent updated' : 'Agent created'),
          backgroundColor: V.green,
        ));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  final AudioPlayer _audioPlayer = AudioPlayer();

  Future<void> _previewVoice(String voiceValue) async {
    setState(() => _previewingVoice = voiceValue);
    try {
      final bytes = await VaniApi.instance.ttsPreview(_tts, voiceValue);
      // Save to temp file and play
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/preview_$voiceValue.wav');
      await file.writeAsBytes(Uint8List.fromList(bytes));
      await _audioPlayer.setFilePath(file.path);
      await _audioPlayer.play();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Preview failed: $e'), duration: const Duration(seconds: 2)),
        );
      }
    } finally {
      if (mounted) setState(() => _previewingVoice = null);
    }
  }

  Future<void> _pickKbFile() async {
    if (!_isEdit) return;
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'txt', 'docx']);
    if (result == null || result.files.isEmpty) return;
    setState(() => _uploading = true);
    try {
      await VaniApi.instance.uploadKbFile(widget.agent!.id, result.files.first.path!, result.files.first.name);
      await _loadKb();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _scanUrl() async {
    if (!_isEdit) return;
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) return;
    setState(() => _scanningUrl = true);
    try {
      await VaniApi.instance.scanKbUrl(widget.agent!.id, url);
      _urlCtrl.clear();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('URL scanned'), backgroundColor: V.green));
      await _loadKb();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Scan failed: $e')));
    } finally {
      if (mounted) setState(() => _scanningUrl = false);
    }
  }

  Future<void> _deleteKbDoc(KbDocument doc) async {
    if (!_isEdit) return;
    await VaniApi.instance.deleteKbDoc(widget.agent!.id, doc.id);
    setState(() => _kbDocs.removeWhere((d) => d.id == doc.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: Text(_isEdit ? 'Edit Agent' : 'Create Agent', style: const TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: _saving ? null : _save,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(color: V.primary, borderRadius: BorderRadius.circular(10)),
                child: _saving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_isEdit ? 'Save' : 'Create', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionBasicInfo().animate().fadeIn(),
            const SizedBox(height: 16),
            _sectionAiStack().animate().fadeIn(delay: 50.ms),
            const SizedBox(height: 16),
            _sectionTuning().animate().fadeIn(delay: 100.ms),
            const SizedBox(height: 16),
            _sectionCallSettings().animate().fadeIn(delay: 150.ms),
            const SizedBox(height: 16),
            _sectionBehavior().animate().fadeIn(delay: 200.ms),
            if (_isEdit) ...[
              const SizedBox(height: 16),
              _sectionKnowledgeBase().animate().fadeIn(delay: 250.ms),
            ],
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_isEdit ? 'Save Changes' : 'Create Agent', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Section: Basic Info ───────────────────────────────────
  Widget _sectionBasicInfo() => _card(
    icon: Icons.info_outline,
    title: 'Basic Info',
    children: [
      _label('Name'),
      _input(_nameCtrl, 'e.g. Reception Bot'),
      _label('Greeting message'),
      _input(_greetingCtrl, 'What agent says first', lines: 2),
      _label('Instructions / Prompt'),
      _inputScrollable(_promptCtrl, 'How agent should behave, what to say, what not to say...'),
      _label('Language'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _language,
        items: _languages.entries.map((e) => DropdownMenuItem(value: e.value, child: Text(e.key))).toList(),
        onChanged: (v) => setState(() => _language = v!),
      ),
      const SizedBox(height: 16),
      Row(children: [
        const Expanded(child: Text('Active', style: TextStyle(color: V.textSub, fontSize: 14, fontWeight: FontWeight.w500))),
        Switch.adaptive(value: _active, onChanged: (v) => setState(() => _active = v), activeColor: V.primary),
      ]),
    ],
  );

  // ─── Section: AI Stack ────────────────────────────────────
  Widget _sectionAiStack() => _card(
    icon: Icons.memory,
    title: 'AI Stack',
    children: [
      _label('LLM Provider'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _llm,
        items: _llmOptions.entries.map((e) => DropdownMenuItem(value: e.value, child: Text(e.key, style: const TextStyle(fontSize: 14)))).toList(),
        onChanged: (v) => setState(() => _llm = v!),
      ),
      _label('STT Provider'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _stt,
        items: _sttOptions.entries.map((e) => DropdownMenuItem(value: e.value, child: Text(e.key, style: const TextStyle(fontSize: 14)))).toList(),
        onChanged: (v) => setState(() => _stt = v!),
      ),
      _label('TTS Provider'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _tts,
        items: _ttsOptions.entries.map((e) => DropdownMenuItem(value: e.value, child: Text(e.key, style: const TextStyle(fontSize: 14)))).toList(),
        onChanged: (v) {
          setState(() {
            _tts = v!;
            // reset voice to first of new provider
            final voices = _voicesByProvider[_tts];
            if (voices != null && voices.isNotEmpty) {
              _voice = voices.first.value;
            }
          });
        },
      ),
      _label('Voice'),
      const SizedBox(height: 8),
      _voiceGrid(),
    ],
  );

  Widget _voiceGrid() {
    final voices = _voicesByProvider[_tts] ?? [];
    if (voices.isEmpty) {
      return const Text('No voices available for this provider', style: TextStyle(color: V.textMuted, fontSize: 13));
    }
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: voices.map((v) {
        final selected = _voice == v.value;
        final previewing = _previewingVoice == v.value;
        return GestureDetector(
          onTap: () => setState(() => _voice = v.value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: selected ? V.primary : V.surfaceMuted,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: selected ? V.primary : V.border),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(v.name, style: TextStyle(color: selected ? Colors.white : V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => _previewVoice(v.value),
                child: previewing
                    ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 1.5, color: selected ? Colors.white : V.primary))
                    : Icon(Icons.play_arrow_rounded, size: 16, color: selected ? Colors.white70 : V.textMuted),
              ),
            ]),
          ),
        );
      }).toList(),
    );
  }

  // ─── Section: Tuning ──────────────────────────────────────
  Widget _sectionTuning() => _card(
    icon: Icons.tune,
    title: 'Response Settings',
    children: [
      _label('Temperature: ${_temperature.toStringAsFixed(1)}'),
      Slider(
        value: _temperature, min: 0, max: 1, divisions: 10,
        activeColor: V.primary, inactiveColor: V.border,
        onChanged: (v) => setState(() => _temperature = v),
      ),
      _label('Max tokens: ${_maxTokens.toInt()}'),
      Slider(
        value: _maxTokens, min: 50, max: 1000, divisions: 19,
        activeColor: V.primary, inactiveColor: V.border,
        onChanged: (v) => setState(() => _maxTokens = v),
      ),
      _label('Response mode'),
      const SizedBox(height: 8),
      Row(children: [
        _toggleChip('Rapid', 'rapid', _responseMode, (v) => setState(() => _responseMode = v)),
        const SizedBox(width: 8),
        _toggleChip('Balanced', 'balanced', _responseMode, (v) => setState(() => _responseMode = v)),
      ]),
    ],
  );

  // ─── Section: Call Settings ───────────────────────────────
  Widget _sectionCallSettings() => _card(
    icon: Icons.call_outlined,
    title: 'Call Settings',
    children: [
      _label('Endpointing: ${_endpointing.toInt()}ms'),
      Slider(
        value: _endpointing, min: 50, max: 800, divisions: 15,
        activeColor: V.primary, inactiveColor: V.border,
        onChanged: (v) => setState(() => _endpointing = v),
      ),
      _label('Silence timeout: ${_silenceTimeout.toInt()}s'),
      Slider(
        value: _silenceTimeout, min: 5, max: 60, divisions: 11,
        activeColor: V.primary, inactiveColor: V.border,
        onChanged: (v) => setState(() => _silenceTimeout = v),
      ),
      _label('Call timeout: ${_callTimeout.toInt()}s'),
      Slider(
        value: _callTimeout, min: 60, max: 3600, divisions: 59,
        activeColor: V.primary, inactiveColor: V.border,
        onChanged: (v) => setState(() => _callTimeout = v),
      ),
      _toggleRow('Voicemail detection', _voicemailDetection, (v) => setState(() => _voicemailDetection = v)),
      _toggleRow('DTMF', _dtmf, (v) => setState(() => _dtmf = v)),
      _toggleRow('Noise cancellation', _noiseCancellation, (v) => setState(() => _noiseCancellation = v)),
      _label('Final message'),
      _input(_finalMsgCtrl, 'Message before call ends'),
    ],
  );

  // ─── Section: Behavior ────────────────────────────────────
  Widget _sectionBehavior() => _card(
    icon: Icons.psychology_outlined,
    title: 'Behavior',
    children: [
      _label('Tone'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _tones.contains(_tone) ? _tone : _tones.first,
        items: _tones.map((t) => DropdownMenuItem(value: t, child: Text(t[0].toUpperCase() + t.substring(1)))).toList(),
        onChanged: (v) => setState(() => _tone = v!),
      ),
      _label('Objective'),
      const SizedBox(height: 8),
      _dropdown<String>(
        value: _objectives.contains(_objective) ? _objective : _objectives.first,
        items: _objectives.map((o) => DropdownMenuItem(value: o, child: Text(o[0].toUpperCase() + o.substring(1)))).toList(),
        onChanged: (v) => setState(() => _objective = v!),
      ),
      _label('Constraints'),
      const SizedBox(height: 8),
      ..._constraintCtrls.asMap().entries.map((e) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Expanded(child: _input(e.value, 'Constraint ${e.key + 1}')),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => setState(() { _constraintCtrls[e.key].dispose(); _constraintCtrls.removeAt(e.key); }),
            child: const Icon(Icons.remove_circle_outline, color: V.red, size: 20),
          ),
        ]),
      )),
      GestureDetector(
        onTap: () => setState(() => _constraintCtrls.add(TextEditingController())),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.add_circle_outline, color: V.primary, size: 18),
            const SizedBox(width: 6),
            Text('Add constraint', style: TextStyle(color: V.primary, fontSize: 13, fontWeight: FontWeight.w500)),
          ]),
        ),
      ),
    ],
  );

  // ─── Section: Knowledge Base ──────────────────────────────
  Widget _sectionKnowledgeBase() => _card(
    icon: Icons.auto_stories_outlined,
    title: 'Knowledge Base',
    children: [
      // URL scan
      Row(children: [
        Expanded(child: _input(_urlCtrl, 'https://example.com')),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _scanningUrl ? null : _scanUrl,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: V.primary, borderRadius: BorderRadius.circular(10)),
            child: _scanningUrl
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.language, color: Colors.white, size: 18),
          ),
        ),
      ]),
      const SizedBox(height: 12),
      // Upload button
      GestureDetector(
        onTap: _uploading ? null : _pickKbFile,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: V.surfaceMuted,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: V.border, style: BorderStyle.solid),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _uploading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: V.primary))
                : const Icon(Icons.upload_file, color: V.primary, size: 18),
            const SizedBox(width: 8),
            Text(_uploading ? 'Uploading...' : 'Upload document', style: const TextStyle(color: V.primary, fontWeight: FontWeight.w500, fontSize: 14)),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      // Docs list
      if (_kbLoading)
        const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(color: V.primary, strokeWidth: 2)))
      else if (_kbDocs.isEmpty)
        const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No documents uploaded', style: TextStyle(color: V.textMuted, fontSize: 13)))
      else
        ..._kbDocs.map((doc) => _kbDocRow(doc)),
    ],
  );

  Widget _kbDocRow(KbDocument doc) {
    final ext = doc.filename.split('.').last.toLowerCase();
    return Dismissible(
      key: Key(doc.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(color: V.red, borderRadius: BorderRadius.circular(10)),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 18),
      ),
      onDismissed: (_) => _deleteKbDoc(doc),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: V.surfaceMuted, borderRadius: BorderRadius.circular(10)),
        child: Row(children: [
          Icon(ext == 'pdf' ? Icons.picture_as_pdf_outlined : Icons.article_outlined, color: V.primary, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(doc.filename, style: const TextStyle(color: V.text, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
          GestureDetector(
            onTap: () => _deleteKbDoc(doc),
            child: const Icon(Icons.close, color: V.textMuted, size: 16),
          ),
        ]),
      ),
    );
  }

  // ─── Shared Widgets ───────────────────────────────────────

  Widget _card({required IconData icon, required String title, required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: V.border),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: V.primary, size: 16)),
        const SizedBox(width: 10),
        Text(title, style: const TextStyle(color: V.text, fontSize: 16, fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 14),
      ...children,
    ]),
  );

  Widget _label(String t) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 4),
    child: Text(t, style: const TextStyle(color: V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
  );

  Widget _input(TextEditingController c, String hint, {int lines = 1}) => TextFormField(
    controller: c, maxLines: lines,
    style: const TextStyle(color: V.text, fontSize: 14),
    decoration: InputDecoration(
      hintText: hint, hintStyle: const TextStyle(color: V.textFaint),
      fillColor: V.surfaceMuted, filled: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.primary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
  );

  Widget _inputScrollable(TextEditingController c, String hint) => TextFormField(
    controller: c, minLines: 8, maxLines: 20,
    style: const TextStyle(color: V.text, fontSize: 14, height: 1.5),
    decoration: InputDecoration(
      hintText: hint, hintStyle: const TextStyle(color: V.textFaint),
      fillColor: V.surfaceMuted, filled: true,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: V.primary, width: 1.5)),
      contentPadding: const EdgeInsets.all(14),
    ),
  );

  Widget _dropdown<T>({required T value, required List<DropdownMenuItem<T>> items, required ValueChanged<T?> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: V.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: V.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: items.any((i) => i.value == value) ? value : items.first.value,
          items: items,
          onChanged: onChanged,
          isExpanded: true,
          style: const TextStyle(color: V.text, fontSize: 14),
          dropdownColor: Colors.white,
          icon: const Icon(Icons.keyboard_arrow_down, color: V.textMuted),
        ),
      ),
    );
  }

  Widget _toggleChip(String label, String value, String selected, ValueChanged<String> onTap) => GestureDetector(
    onTap: () => onTap(value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        color: selected == value ? V.primary : V.surfaceMuted,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected == value ? V.primary : V.border),
      ),
      child: Text(label, style: TextStyle(color: selected == value ? Colors.white : V.textSub, fontSize: 13, fontWeight: FontWeight.w500)),
    ),
  );

  Widget _toggleRow(String label, bool value, ValueChanged<bool> onChanged) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(color: V.textSub, fontSize: 14, fontWeight: FontWeight.w500))),
      Switch.adaptive(value: value, onChanged: onChanged, activeColor: V.primary),
    ]),
  );
}
