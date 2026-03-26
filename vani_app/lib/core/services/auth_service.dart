import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/vani_api.dart';
import '../models/models.dart';

class AuthState {
  final VaniUser? user;
  final bool loading;
  final String? error;

  const AuthState({this.user, this.loading = false, this.error});
  AuthState copyWith({VaniUser? user, bool? loading, String? error}) =>
      AuthState(user: user ?? this.user, loading: loading ?? this.loading, error: error);
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _init();
  }

  Future<void> _init() async {
    final loggedIn = await VaniApi.instance.isLoggedIn();
    if (loggedIn) {
      final user = await VaniApi.instance.getMe();
      state = AuthState(user: user);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(loading: true, error: null);
    try {
      await VaniApi.instance.login(email, password);
      final user = await VaniApi.instance.getMe();
      state = AuthState(user: user);
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: _parseError(e));
      return false;
    }
  }

  Future<bool> signup(String email, String password, String name) async {
    state = state.copyWith(loading: true, error: null);
    try {
      await VaniApi.instance.signup(email, password, name);
      final user = await VaniApi.instance.getMe();
      state = AuthState(user: user);
      return true;
    } catch (e) {
      state = state.copyWith(loading: false, error: _parseError(e));
      return false;
    }
  }

  void skipLogin() {
    state = AuthState(
      user: VaniUser(
        id: 'demo',
        email: 'demo@vani.live',
        name: 'Shiva',
        businessName: 'Vani Demo',
      ),
    );
  }

  Future<void> logout() async {
    await VaniApi.instance.logout();
    state = const AuthState();
  }

  String _parseError(dynamic e) {
    if (e is DioException) {
      return e.response?.data?['detail'] ?? 'Something went wrong';
    }
    return e.toString();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);
