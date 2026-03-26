import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vani_app/app.dart';

void main() {
  testWidgets('Vani app starts', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: VaniApp()));
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
