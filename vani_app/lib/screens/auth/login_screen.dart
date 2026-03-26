import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/services/auth_service.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSignup = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = ref.read(authProvider.notifier);
    bool ok;
    if (_isSignup) {
      ok = await auth.signup(_emailCtrl.text.trim(), _passwordCtrl.text, _nameCtrl.text.trim());
    } else {
      ok = await auth.login(_emailCtrl.text.trim(), _passwordCtrl.text);
    }
    if (!ok && mounted) {
      final error = ref.read(authProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error ?? 'Failed')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authProvider).loading;
    final h = MediaQuery.of(context).size.height;
    final w = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: V.bg,
      body: Stack(
        children: [
          // Soft gradient accents
          Positioned(top: -h * 0.1, left: -w * 0.2, child: _blob(w * 0.7, V.primary.withOpacity(0.06))),
          Positioned(top: h * 0.3, right: -w * 0.3, child: _blob(w * 0.5, V.primarySoft.withOpacity(0.04))),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(height: h * 0.08),

                    // Logo
                    Container(
                      width: 50, height: 50,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), V.primary]),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [BoxShadow(color: V.primary.withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 6))],
                      ),
                      child: const Icon(Icons.mic, color: Colors.white, size: 23),
                    ).animate().fadeIn(duration: 500.ms),

                    const SizedBox(height: 36),

                    Text(
                      _isSignup ? 'Create\naccount' : 'Welcome\nback',
                      style: const TextStyle(color: V.text, fontSize: 34, fontWeight: FontWeight.w700, height: 1.15, letterSpacing: -0.8),
                    ).animate().fadeIn(delay: 100.ms),

                    const SizedBox(height: 10),

                    Text(
                      _isSignup ? 'Set up your AI voice agent' : 'Sign in to your voice agent',
                      style: const TextStyle(color: V.textMuted, fontSize: 16),
                    ).animate().fadeIn(delay: 150.ms),

                    const SizedBox(height: 40),

                    // Glass form card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: V.border),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 24, offset: const Offset(0, 8)),
                        ],
                      ),
                      child: Column(
                        children: [
                          if (_isSignup) ...[
                            _input(_nameCtrl, 'Full name', Icons.person_outline),
                            const SizedBox(height: 14),
                          ],
                          _input(_emailCtrl, 'Email', Icons.mail_outline, type: TextInputType.emailAddress),
                          const SizedBox(height: 14),
                          _input(_passwordCtrl, 'Password', Icons.lock_outline, obscure: true),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity, height: 54,
                            child: ElevatedButton(
                              onPressed: loading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: V.primary,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                elevation: 0,
                              ),
                              child: loading
                                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : Text(_isSignup ? 'Create Account' : 'Sign In', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.03, duration: 400.ms),

                    const SizedBox(height: 24),

                    Center(
                      child: GestureDetector(
                        onTap: () => setState(() => _isSignup = !_isSignup),
                        child: RichText(
                          text: TextSpan(style: const TextStyle(fontSize: 14), children: [
                            TextSpan(text: _isSignup ? 'Already have an account? ' : "Don't have an account? ", style: const TextStyle(color: V.textMuted)),
                            TextSpan(text: _isSignup ? 'Sign in' : 'Sign up', style: const TextStyle(color: V.primary, fontWeight: FontWeight.w600)),
                          ]),
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    Center(
                      child: GestureDetector(
                        onTap: () => ref.read(authProvider.notifier).skipLogin(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: V.surfaceMuted,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: V.border),
                          ),
                          child: const Text('Explore demo →', style: TextStyle(color: V.textMuted, fontSize: 14)),
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String hint, IconData icon,
      {TextInputType type = TextInputType.text, bool obscure = false}) {
    return TextFormField(
      controller: ctrl,
      keyboardType: type,
      obscureText: obscure ? _obscure : false,
      style: const TextStyle(color: V.text, fontSize: 15),
      validator: (v) => v!.isEmpty ? 'Required' : null,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: V.textFaint),
        fillColor: V.surfaceMuted,
        filled: true,
        prefixIcon: Icon(icon, color: V.textMuted, size: 20),
        suffixIcon: obscure
            ? GestureDetector(
                onTap: () => setState(() => _obscure = !_obscure),
                child: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: V.textMuted, size: 20))
            : null,
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: const BorderSide(color: V.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: const BorderSide(color: V.primary, width: 1.5)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      ),
    );
  }

  Widget _blob(double size, Color color) => Container(
        width: size, height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [color, Colors.transparent])),
      );
}
