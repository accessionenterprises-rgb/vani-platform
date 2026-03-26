import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class V {
  // Backgrounds
  static const bg = Color(0xFFF8F8FC);
  static const bgPure = Color(0xFFFFFFFF);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF1F1F7);

  // Brand
  static const primary = Color(0xFF6C3AE0);
  static const primarySoft = Color(0xFF8B5CF6);
  static const primaryBg = Color(0xFFF0EBFF);
  static const primaryGlow = Color(0x206C3AE0);

  // Text
  static const text = Color(0xFF111118);
  static const textSub = Color(0xFF555570);
  static const textMuted = Color(0xFF9B9BB0);
  static const textFaint = Color(0xFFC4C4D4);

  // Borders
  static const border = Color(0xFFE8E8F0);
  static const borderLight = Color(0xFFF0F0F6);

  // Status
  static const green = Color(0xFF22C55E);
  static const red = Color(0xFFEF4444);
  static const amber = Color(0xFFEAB308);
  static const blue = Color(0xFF3B82F6);

  // Glass
  static const glass = Color(0xB3FFFFFF); // white 70%
  static const glassBorder = Color(0x33000000); // black 20%
}

ThemeData buildVaniTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: V.bg,
    colorScheme: const ColorScheme.light(
      primary: V.primary,
      secondary: V.primarySoft,
      surface: V.surface,
      error: V.red,
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: V.text),
    ),
  );
}
