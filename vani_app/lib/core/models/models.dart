class VaniUser {
  final String id;
  final String email;
  final String? name;
  final String? businessName;
  final String? phone;
  final String? avatarUrl;

  VaniUser({
    required this.id,
    required this.email,
    this.name,
    this.businessName,
    this.phone,
    this.avatarUrl,
  });

  factory VaniUser.fromJson(Map<String, dynamic> j) => VaniUser(
        id: j['id'],
        email: j['email'],
        name: j['name'],
        businessName: j['business_name'],
        phone: j['phone'],
        avatarUrl: j['avatar_url'],
      );
}

class VaniAgent {
  final String id;
  final String name;
  final String? greeting;
  final String? prompt;
  final String voice;
  final String language;
  final String sttProvider;
  final String llmProvider;
  final String ttsProvider;
  final bool active;
  final Map<String, dynamic>? tuning;
  // Call settings
  final int? endpointing;
  final int? silenceTimeout;
  final int? callTimeout;
  final bool voicemailDetection;
  final bool dtmfEnabled;
  final bool noiseCancellation;
  final String? finalMessage;
  // Behavior
  final String? tone;
  final String? objective;
  final List<String> constraints;

  VaniAgent({
    required this.id,
    required this.name,
    this.greeting,
    this.prompt,
    required this.voice,
    required this.language,
    required this.sttProvider,
    required this.llmProvider,
    required this.ttsProvider,
    required this.active,
    this.tuning,
    this.endpointing,
    this.silenceTimeout,
    this.callTimeout,
    this.voicemailDetection = false,
    this.dtmfEnabled = false,
    this.noiseCancellation = true,
    this.finalMessage,
    this.tone,
    this.objective,
    this.constraints = const [],
  });

  factory VaniAgent.fromJson(Map<String, dynamic> j) {
    final tuning = j['tuning'] is Map<String, dynamic> ? j['tuning'] as Map<String, dynamic> : null;
    final behavior = j['behavior'] is Map<String, dynamic> ? j['behavior'] as Map<String, dynamic> : null;
    final callSettings = j['call_settings'] is Map<String, dynamic> ? j['call_settings'] as Map<String, dynamic> : null;

    return VaniAgent(
      id: j['id'],
      name: j['name'] ?? 'My Agent',
      greeting: j['greeting'],
      prompt: j['prompt'],
      voice: j['voice'] ?? 'nova',
      language: j['language'] ?? 'en',
      sttProvider: j['stt_provider'] ?? 'deepgram-nova-3',
      llmProvider: j['llm_provider'] ?? 'gpt-4o-mini',
      ttsProvider: j['tts_provider'] ?? 'openai',
      active: j['active'] ?? true,
      tuning: tuning,
      endpointing: callSettings?['endpointing'] ?? j['endpointing'],
      silenceTimeout: callSettings?['silence_timeout'] ?? j['silence_timeout'],
      callTimeout: callSettings?['call_timeout'] ?? j['call_timeout'],
      voicemailDetection: callSettings?['voicemail_detection'] ?? j['voicemail_detection'] ?? false,
      dtmfEnabled: callSettings?['dtmf_enabled'] ?? j['dtmf_enabled'] ?? false,
      noiseCancellation: callSettings?['noise_cancellation'] ?? j['noise_cancellation'] ?? true,
      finalMessage: callSettings?['final_message'] ?? j['final_message'],
      tone: behavior?['tone'] ?? j['tone'],
      objective: behavior?['objective'] ?? j['objective'],
      constraints: _parseConstraints(behavior?['constraints'] ?? j['constraints']),
    );
  }

  static List<String> _parseConstraints(dynamic v) {
    if (v is List) return v.map((e) => e.toString()).toList();
    return [];
  }
}

class VaniCall {
  final String id;
  final String? phone;
  final String? agentId;
  final String status;
  final String direction;
  final int? durationSec;
  final String? transcript;
  final String? summary;
  final String? sentiment;
  final DateTime? startedAt;
  final DateTime? endedAt;

  VaniCall({
    required this.id,
    this.phone,
    this.agentId,
    required this.status,
    required this.direction,
    this.durationSec,
    this.transcript,
    this.summary,
    this.sentiment,
    this.startedAt,
    this.endedAt,
  });

  factory VaniCall.fromJson(Map<String, dynamic> j) => VaniCall(
        id: j['id'],
        phone: j['phone'],
        agentId: j['agent_id'],
        status: j['status'] ?? 'completed',
        direction: j['direction'] ?? 'inbound',
        durationSec: j['duration_sec'],
        transcript: j['transcript'],
        summary: j['summary'],
        sentiment: j['sentiment'],
        startedAt: j['started_at'] != null ? DateTime.parse(j['started_at']) : null,
        endedAt: j['ended_at'] != null ? DateTime.parse(j['ended_at']) : null,
      );

  String get formattedDuration {
    if (durationSec == null) return '—';
    final m = durationSec! ~/ 60;
    final s = durationSec! % 60;
    if (m == 0) return '${s}s';
    return '${m}m ${s}s';
  }
}

class KbDocument {
  final String id;
  final String filename;
  final String? content;
  final DateTime createdAt;

  KbDocument({
    required this.id,
    required this.filename,
    this.content,
    required this.createdAt,
  });

  factory KbDocument.fromJson(Map<String, dynamic> j) => KbDocument(
        id: j['id'],
        filename: j['filename'],
        content: j['content'],
        createdAt: DateTime.parse(j['created_at']),
      );
}

class PhoneNumber {
  final String id;
  final String number;
  final String? agentId;
  final String status;
  final String provider;

  PhoneNumber({
    required this.id,
    required this.number,
    this.agentId,
    required this.status,
    required this.provider,
  });

  factory PhoneNumber.fromJson(Map<String, dynamic> j) => PhoneNumber(
        id: j['id'],
        number: j['number'],
        agentId: j['agent_id'],
        status: j['status'] ?? 'active',
        provider: j['provider'] ?? 'twilio',
      );
}
