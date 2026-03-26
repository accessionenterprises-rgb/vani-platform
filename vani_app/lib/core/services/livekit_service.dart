import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/vani_api.dart';

enum VoiceCallState { idle, connecting, active, ending }

/// Stubbed until Flutter is upgraded and livekit_client is added back.
/// Full LiveKit implementation is ready — just uncomment livekit_client in pubspec
/// and replace this file with the real version.
class VoiceCallNotifier extends StateNotifier<VoiceCallState> {
  VoiceCallNotifier() : super(VoiceCallState.idle);

  double _audioLevel = 0.0;
  final List<Function(double)> _audioLevelListeners = [];

  double get audioLevel => _audioLevel;

  void addAudioLevelListener(Function(double) listener) {
    _audioLevelListeners.add(listener);
  }

  void removeAudioLevelListener(Function(double) listener) {
    _audioLevelListeners.remove(listener);
  }

  Future<void> startCall(String agentId) async {
    if (state != VoiceCallState.idle) return;
    state = VoiceCallState.connecting;

    try {
      // This calls vani-api to create a LiveKit room and get a token
      final session = await VaniApi.instance.startVoiceSession(agentId: agentId);
      // TODO: Connect to LiveKit room with session['token'] and session['livekit_url']
      // For now, simulate connection
      await Future.delayed(const Duration(seconds: 1));
      state = VoiceCallState.active;
      _simulateAudio();
    } catch (e) {
      state = VoiceCallState.idle;
      rethrow;
    }
  }

  Future<void> endCall() async {
    if (state == VoiceCallState.idle) return;
    state = VoiceCallState.ending;
    _audioLevel = 0.0;
    await Future.delayed(const Duration(milliseconds: 300));
    state = VoiceCallState.idle;
  }

  void _simulateAudio() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(milliseconds: 150));
      if (state != VoiceCallState.active) return false;
      // Simulate audio level changes for avatar animation demo
      _audioLevel = (_audioLevel > 0.5) ? 0.1 : 0.7;
      for (final listener in _audioLevelListeners) {
        listener(_audioLevel);
      }
      return true;
    });
  }

  @override
  void dispose() {
    endCall();
    super.dispose();
  }
}

final voiceCallProvider = StateNotifierProvider<VoiceCallNotifier, VoiceCallState>(
  (ref) => VoiceCallNotifier(),
);
