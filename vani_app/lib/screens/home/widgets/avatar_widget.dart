import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme.dart';

enum AvatarState { idle, listening, thinking, speaking }

class VaniAvatar extends StatefulWidget {
  final AvatarState state;
  final double audioLevel;
  final double size;

  const VaniAvatar({
    super.key,
    required this.state,
    this.audioLevel = 0.0,
    this.size = 220,
  });

  @override
  State<VaniAvatar> createState() => _VaniAvatarState();
}

class _VaniAvatarState extends State<VaniAvatar> with TickerProviderStateMixin {
  late AnimationController _breathe;
  late AnimationController _pulse;
  late AnimationController _orbit;
  late AnimationController _wave;
  late AnimationController _glow;

  @override
  void initState() {
    super.initState();
    _breathe = AnimationController(vsync: this, duration: const Duration(milliseconds: 4000))..repeat(reverse: true);
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
    _orbit = AnimationController(vsync: this, duration: const Duration(milliseconds: 12000))..repeat();
    _wave = AnimationController(vsync: this, duration: const Duration(milliseconds: 2500))..repeat();
    _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 3000))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _breathe.dispose();
    _pulse.dispose();
    _orbit.dispose();
    _wave.dispose();
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_breathe, _pulse, _orbit, _wave, _glow]),
      builder: (context, _) {
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: CustomPaint(
            painter: _PremiumOrbPainter(
              state: widget.state,
              audioLevel: widget.audioLevel,
              breathe: Curves.easeInOut.transform(_breathe.value),
              pulse: Curves.easeOut.transform(_pulse.value),
              orbit: _orbit.value * 2 * math.pi,
              wave: _wave.value,
              glow: Curves.easeInOut.transform(_glow.value),
            ),
          ),
        );
      },
    );
  }
}

class _PremiumOrbPainter extends CustomPainter {
  final AvatarState state;
  final double audioLevel;
  final double breathe;
  final double pulse;
  final double orbit;
  final double wave;
  final double glow;

  _PremiumOrbPainter({
    required this.state,
    required this.audioLevel,
    required this.breathe,
    required this.pulse,
    required this.orbit,
    required this.wave,
    required this.glow,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = size.width * 0.38;

    _drawAmbientGlow(canvas, center, maxR, size);
    _drawOuterRings(canvas, center, maxR);
    _drawOrbitParticles(canvas, center, maxR);
    _drawMainOrb(canvas, center, maxR);
    _drawInnerLight(canvas, center, maxR);
    if (state == AvatarState.speaking || audioLevel > 0.1) {
      _drawSoundBars(canvas, center, maxR);
    }
  }

  void _drawAmbientGlow(Canvas canvas, Offset center, double maxR, Size size) {
    // Large ambient background glow
    final glowRadius = maxR * (1.8 + breathe * 0.3 + audioLevel * 0.4);
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          V.primary.withOpacity(0.12 + glow * 0.08),
          V.primaryMuted.withOpacity(0.05),
          Colors.transparent,
        ],
        stops: const [0.0, 0.5, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: glowRadius));
    canvas.drawCircle(center, glowRadius, glowPaint);

    // Secondary accent glow
    final accent2 = Offset(center.dx + maxR * 0.3, center.dy - maxR * 0.2);
    final accentPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          V.accent.withOpacity(0.06 + glow * 0.03),
          Colors.transparent,
        ],
      ).createShader(Rect.fromCircle(center: accent2, radius: maxR * 1.2));
    canvas.drawCircle(accent2, maxR * 1.2, accentPaint);
  }

  void _drawOuterRings(Canvas canvas, Offset center, double maxR) {
    final isActive = state != AvatarState.idle;
    final ringCount = isActive ? 3 : 2;

    for (int i = 0; i < ringCount; i++) {
      final progress = (wave + i / ringCount) % 1.0;
      final radius = maxR * (1.05 + progress * 0.7);
      final opacity = (1 - progress) * (isActive ? 0.15 : 0.06);

      final ringPaint = Paint()
        ..color = V.primary.withOpacity(opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5 * (1 - progress);

      canvas.drawCircle(center, radius, ringPaint);
    }

    // Subtle static ring
    final staticRing = Paint()
      ..color = V.primaryLight.withOpacity(0.04 + breathe * 0.02)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;
    canvas.drawCircle(center, maxR * 1.15, staticRing);
  }

  void _drawOrbitParticles(Canvas canvas, Offset center, double maxR) {
    final particles = 8;
    final orbitR = maxR * (1.2 + breathe * 0.05);

    for (int i = 0; i < particles; i++) {
      final angle = orbit + (2 * math.pi * i / particles);
      final wobble = math.sin(orbit * 2 + i) * maxR * 0.05;
      final px = center.dx + (orbitR + wobble) * math.cos(angle);
      final py = center.dy + (orbitR + wobble) * math.sin(angle);
      final particleSize = 1.5 + (math.sin(orbit + i * 1.5) + 1) * 1.0;
      final opacity = 0.15 + (math.sin(orbit * 2 + i) + 1) * 0.15;

      final pPaint = Paint()
        ..color = V.primaryLight.withOpacity(opacity);
      canvas.drawCircle(Offset(px, py), particleSize, pPaint);

      // Tiny glow around each particle
      final pgPaint = Paint()
        ..color = V.primary.withOpacity(opacity * 0.3);
      canvas.drawCircle(Offset(px, py), particleSize * 3, pgPaint);
    }
  }

  void _drawMainOrb(Canvas canvas, Offset center, double maxR) {
    final r = maxR * (0.92 + breathe * 0.08 + audioLevel * 0.06);

    // Deep shadow
    final shadowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          V.orbDeep.withOpacity(0.6),
          Colors.transparent,
        ],
      ).createShader(Rect.fromCircle(center: Offset(center.dx, center.dy + r * 0.1), radius: r * 1.3));
    canvas.drawCircle(Offset(center.dx, center.dy + r * 0.1), r * 1.3, shadowPaint);

    // Main gradient orb
    final orbPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.3, -0.35),
        radius: 0.9,
        colors: [
          const Color(0xFFB794F4),
          V.primary,
          V.orbCore,
          V.orbDeep,
          const Color(0xFF1E0A4A),
        ],
        stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: r));
    canvas.drawCircle(center, r, orbPaint);

    // Glass-like rim highlight
    final rimPath = Path()
      ..addArc(
        Rect.fromCircle(center: center, radius: r),
        -math.pi * 0.8,
        math.pi * 0.6,
      );
    final rimPaint = Paint()
      ..color = Colors.white.withOpacity(0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2);
    canvas.drawPath(rimPath, rimPaint);
  }

  void _drawInnerLight(Canvas canvas, Offset center, double maxR) {
    final r = maxR * (0.92 + breathe * 0.08);

    // Top-left specular highlight
    final highlightCenter = Offset(center.dx - r * 0.25, center.dy - r * 0.3);
    final specPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.white.withOpacity(0.2 + pulse * 0.05),
          Colors.white.withOpacity(0.05),
          Colors.transparent,
        ],
        stops: const [0.0, 0.3, 1.0],
      ).createShader(Rect.fromCircle(center: highlightCenter, radius: r * 0.5));
    canvas.drawCircle(highlightCenter, r * 0.5, specPaint);

    // Center glow when active
    if (state != AvatarState.idle || audioLevel > 0.05) {
      final intensity = state == AvatarState.speaking ? 0.2 + audioLevel * 0.3 : 0.1;
      final corePaint = Paint()
        ..shader = RadialGradient(
          colors: [
            V.orbGlow.withOpacity(intensity),
            Colors.transparent,
          ],
        ).createShader(Rect.fromCircle(center: center, radius: r * 0.5));
      canvas.drawCircle(center, r * 0.5, corePaint);
    }
  }

  void _drawSoundBars(Canvas canvas, Offset center, double maxR) {
    final r = maxR * 0.92;
    final barCount = 5;
    final barWidth = 3.0;
    final gap = 6.0;
    final totalW = barCount * barWidth + (barCount - 1) * gap;
    final startX = center.dx - totalW / 2;
    final heights = [0.35, 0.65, 1.0, 0.65, 0.35];

    for (int i = 0; i < barCount; i++) {
      final x = startX + i * (barWidth + gap) + barWidth / 2;
      final maxH = r * 0.3 * heights[i];
      final animH = maxH * (0.3 + audioLevel * 0.5 + pulse * 0.2);

      final barPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withOpacity(0.9),
            Colors.white.withOpacity(0.4),
          ],
        ).createShader(Rect.fromLTRB(x, center.dy - animH, x + barWidth, center.dy + animH))
        ..strokeCap = StrokeCap.round
        ..strokeWidth = barWidth;

      canvas.drawLine(
        Offset(x, center.dy - animH),
        Offset(x, center.dy + animH),
        barPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _PremiumOrbPainter old) => true;
}
