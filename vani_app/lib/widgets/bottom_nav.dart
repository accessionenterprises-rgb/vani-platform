import 'package:flutter/material.dart';
import '../core/theme.dart';

class VaniBottomNav extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const VaniBottomNav({super.key, required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: V.surface,
        border: Border(top: BorderSide(color: V.border, width: 0.5)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home', index: 0, current: currentIndex, onTap: onTap),
              _NavItem(icon: Icons.smart_toy_outlined, activeIcon: Icons.smart_toy, label: 'Agents', index: 1, current: currentIndex, onTap: onTap),
              _NavItem(icon: Icons.call_outlined, activeIcon: Icons.call, label: 'Calls', index: 2, current: currentIndex, onTap: onTap),
              _NavItem(icon: Icons.description_outlined, activeIcon: Icons.description, label: 'KB', index: 3, current: currentIndex, onTap: onTap),
              _NavItem(icon: Icons.settings_outlined, activeIcon: Icons.settings, label: 'Settings', index: 4, current: currentIndex, onTap: onTap),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int index;
  final int current;
  final Function(int) onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.index,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 64,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: active ? V.primary.withOpacity(0.12) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                active ? activeIcon : icon,
                color: active ? V.primary : V.textMuted,
                size: 22,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: active ? V.primary : V.textMuted,
                fontSize: 10,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
