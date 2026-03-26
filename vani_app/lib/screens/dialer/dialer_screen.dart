import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';

class DialerScreen extends StatefulWidget {
  const DialerScreen({super.key});
  @override
  State<DialerScreen> createState() => _DialerState();
}

class _DialerState extends State<DialerScreen> {
  String _number = '';
  bool _calling = false;
  String? _fromNumber;

  @override
  void initState() {
    super.initState();
    _loadNumber();
  }

  Future<void> _loadNumber() async {
    try {
      final numbers = await VaniApi.instance.listNumbers();
      if (numbers.isNotEmpty && mounted) setState(() => _fromNumber = numbers.first.number);
    } catch (_) {}
  }

  void _tap(String digit) {
    HapticFeedback.lightImpact();
    setState(() => _number += digit);
  }

  void _delete() {
    if (_number.isNotEmpty) {
      HapticFeedback.selectionClick();
      setState(() => _number = _number.substring(0, _number.length - 1));
    }
  }

  Future<void> _call() async {
    if (_number.length < 5) return;
    HapticFeedback.mediumImpact();
    setState(() => _calling = true);

    try {
      await VaniApi.instance.makeOutboundCall(_number);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Calling $_number...'), backgroundColor: V.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _calling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Dialer', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
      ),
      body: Column(
        children: [
          const SizedBox(height: 20),

          // From number
          if (_fromNumber != null)
            Text('Calling from $_fromNumber', style: const TextStyle(color: V.textMuted, fontSize: 12)),

          const SizedBox(height: 16),

          // Number display
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              _number.isEmpty ? 'Enter number' : _formatNumber(_number),
              style: TextStyle(
                color: _number.isEmpty ? V.textFaint : V.text,
                fontSize: _number.length > 10 ? 28 : 34,
                fontWeight: FontWeight.w300,
                letterSpacing: 2,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
            ),
          ),

          const SizedBox(height: 36),

          // Dial pad
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _padRow(['1', '2', '3']),
                  const SizedBox(height: 16),
                  _padRow(['4', '5', '6']),
                  const SizedBox(height: 16),
                  _padRow(['7', '8', '9']),
                  const SizedBox(height: 16),
                  _padRow(['*', '0', '#']),
                ],
              ),
            ),
          ),

          // Bottom: call + delete
          Padding(
            padding: const EdgeInsets.fromLTRB(40, 0, 40, 48),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                const SizedBox(width: 64),

                // Call button
                GestureDetector(
                  onTap: _calling ? null : _call,
                  child: Container(
                    width: 68, height: 68,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: V.green,
                      boxShadow: [BoxShadow(color: V.green.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 4))],
                    ),
                    child: _calling
                        ? const Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)))
                        : const Icon(Icons.call_rounded, color: Colors.white, size: 28),
                  ),
                ),

                // Delete button
                GestureDetector(
                  onTap: _delete,
                  onLongPress: () { HapticFeedback.mediumImpact(); setState(() => _number = ''); },
                  child: Container(
                    width: 64, height: 64,
                    decoration: const BoxDecoration(shape: BoxShape.circle),
                    child: Icon(Icons.backspace_outlined, color: _number.isEmpty ? V.textFaint : V.textSub, size: 24),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _padRow(List<String> digits) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits.map((d) => _dialBtn(d)).toList(),
    );
  }

  Widget _dialBtn(String digit) {
    final sub = _subLabel(digit);
    return GestureDetector(
      onTap: () => _tap(digit),
      child: Container(
        width: 72, height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          border: Border.all(color: V.border),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4)],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(digit, style: const TextStyle(color: V.text, fontSize: 26, fontWeight: FontWeight.w300)),
            if (sub.isNotEmpty)
              Text(sub, style: const TextStyle(color: V.textMuted, fontSize: 9, fontWeight: FontWeight.w500, letterSpacing: 2)),
          ],
        ),
      ),
    );
  }

  String _subLabel(String d) {
    switch (d) {
      case '2': return 'ABC';
      case '3': return 'DEF';
      case '4': return 'GHI';
      case '5': return 'JKL';
      case '6': return 'MNO';
      case '7': return 'PQRS';
      case '8': return 'TUV';
      case '9': return 'WXYZ';
      case '0': return '+';
      default: return '';
    }
  }

  String _formatNumber(String n) {
    if (n.length <= 5) return n;
    if (n.length <= 10) return '${n.substring(0, 5)} ${n.substring(5)}';
    return '+${n.substring(0, 2)} ${n.substring(2, 7)} ${n.substring(7)}';
  }
}
