import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'core/services/auth_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/calls/calls_screen.dart';
import 'screens/knowledge_base/kb_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/dialer/dialer_screen.dart';
import 'screens/playground/playground_screen.dart';
import 'screens/agents/agents_list_screen.dart';

class VaniApp extends ConsumerWidget {
  const VaniApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Vani',
      theme: buildVaniTheme(),
      debugShowCheckedModeBanner: false,
      home: const _AuthGate(),
      routes: {
        '/home': (_) => const HomeScreen(),
        '/onboarding': (_) => const OnboardingScreen(),
        '/calls': (_) => const CallsScreen(),
        '/kb': (_) => const KbScreen(),
        '/settings': (_) => const SettingsScreen(),
        '/dialer': (_) => const DialerScreen(),
        '/playground': (_) => const PlaygroundScreen(),
        '/agents': (_) => const AgentsListScreen(),
      },
    );
  }
}

class _AuthGate extends ConsumerWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (auth.user == null) return const LoginScreen();
    return const HomeScreen();
  }
}
