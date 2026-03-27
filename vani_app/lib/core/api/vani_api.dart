import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

const _baseUrl = 'https://api.vani.live';

class VaniApi {
  static final VaniApi _instance = VaniApi._();
  static VaniApi get instance => _instance;

  final _storage = const FlutterSecureStorage();
  late final Dio _dio;

  VaniApi._() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  // ─── Auth ───────────────────────────────────────────────

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final token = res.data['access_token'];
    await _storage.write(key: 'access_token', value: token);
    return res.data;
  }

  Future<Map<String, dynamic>> signup(String email, String password, String name) async {
    final res = await _dio.post('/auth/signup', data: {
      'email': email,
      'password': password,
      'name': name,
    });
    final token = res.data['access_token'];
    await _storage.write(key: 'access_token', value: token);
    return res.data;
  }

  Future<void> logout() async {
    await _storage.delete(key: 'access_token');
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

  Future<VaniUser?> getMe() async {
    try {
      final res = await _dio.get('/auth/me');
      return VaniUser.fromJson(res.data);
    } catch (_) {
      return null;
    }
  }

  // ─── Agents ─────────────────────────────────────────────

  Future<List<VaniAgent>> listAgents() async {
    final res = await _dio.get('/agents');
    return (res.data as List).map((e) => VaniAgent.fromJson(e)).toList();
  }

  Future<VaniAgent> getAgent(String id) async {
    final res = await _dio.get('/agents/$id');
    return VaniAgent.fromJson(res.data);
  }

  Future<VaniAgent> createAgent(Map<String, dynamic> data) async {
    final res = await _dio.post('/agents', data: data);
    return VaniAgent.fromJson(res.data);
  }

  Future<VaniAgent> updateAgent(String id, Map<String, dynamic> data) async {
    final res = await _dio.patch('/agents/$id', data: data);
    return VaniAgent.fromJson(res.data);
  }

  Future<void> deleteAgent(String id) async {
    await _dio.delete('/agents/$id');
  }

  // ─── Knowledge Base ──────────────────────────────────────

  Future<List<KbDocument>> listKb(String agentId) async {
    final res = await _dio.get('/agents/$agentId/kb');
    return (res.data as List).map((e) => KbDocument.fromJson(e)).toList();
  }

  Future<void> uploadKbFile(String agentId, String filePath, String filename) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: filename),
    });
    await _dio.post('/agents/$agentId/kb', data: formData);
  }

  Future<void> addKbText(String agentId, String content, String filename) async {
    await _dio.post('/agents/$agentId/kb', data: {
      'content': content,
      'filename': filename,
    });
  }

  Future<void> deleteKbDoc(String agentId, String docId) async {
    await _dio.delete('/agents/$agentId/kb/$docId');
  }

  Future<Map<String, dynamic>> scanKbUrl(String agentId, String url) async {
    final res = await _dio.post('/agents/$agentId/kb/url', data: {'url': url});
    return res.data;
  }

  Future<Map<String, dynamic>> builderChat(String message, String sessionId) async {
    final res = await _dio.post('/builder/chat', data: {
      'message': message,
      'session_id': sessionId,
    });
    return res.data;
  }

  Future<List<int>> ttsPreview(String provider, String voice, {String? text}) async {
    final res = await _dio.post('/tts-preview',
      data: {'provider': provider, 'voice': voice, if (text != null) 'text': text},
      options: Options(responseType: ResponseType.bytes),
    );
    return (res.data as List<int>);
  }

  // ─── Calls ──────────────────────────────────────────────

  Future<List<VaniCall>> listCalls({int limit = 50}) async {
    final res = await _dio.get('/calls', queryParameters: {'limit': limit});
    return (res.data as List).map((e) => VaniCall.fromJson(e)).toList();
  }

  Future<VaniCall> getCall(String id) async {
    final res = await _dio.get('/calls/$id');
    return VaniCall.fromJson(res.data);
  }

  // ─── Playground (in-app voice) ──────────────────────────

  Future<Map<String, dynamic>> startVoiceSession({required String agentId}) async {
    final res = await _dio.post('/playground/voice/start', data: {
      'agent_id': agentId,
    });
    return res.data; // { token, room_name, livekit_url }
  }

  // ─── Phone Numbers ───────────────────────────────────────

  Future<List<PhoneNumber>> listNumbers() async {
    final res = await _dio.get('/numbers');
    return (res.data as List).map((e) => PhoneNumber.fromJson(e)).toList();
  }

  // ─── Playground chat ────────────────────────────────────

  Future<Map<String, dynamic>> playgroundChat(String agentId, String message, {String? sessionId}) async {
    final res = await _dio.post('/playground/chat', data: {
      'agent_id': agentId,
      'message': message,
      if (sessionId != null) 'session_id': sessionId,
    });
    return res.data; // { reply, ... }
  }

  Future<void> clearPlaygroundChat(String sessionId) async {
    await _dio.delete('/playground/chat/$sessionId');
  }

  // ─── Outbound call ─────────────────────────────────────

  Future<Map<String, dynamic>> makeOutboundCall(String to, {String? agentId}) async {
    final res = await _dio.post('/calls/outbound', data: {
      'to': to,
      if (agentId != null) 'agent_id': agentId,
    });
    return res.data;
  }

  // ─── Billing ──────────────────────────────────────────────

  Future<Map<String, dynamic>> getBillingUsage() async {
    final res = await _dio.get('/billing/usage');
    return res.data;
  }

  Future<Map<String, dynamic>> getBillingPlan() async {
    final res = await _dio.get('/billing/plan');
    return res.data;
  }

  // ─── Website scan (onboarding) ───────────────────────────

  Future<Map<String, dynamic>> scanWebsite(String url, String agentId) async {
    final res = await _dio.post('/agents/$agentId/kb/scan', data: {'url': url});
    return res.data;
  }
}
