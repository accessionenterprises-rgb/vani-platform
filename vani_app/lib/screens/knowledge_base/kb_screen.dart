import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme.dart';
import '../../core/api/vani_api.dart';
import '../../core/models/models.dart';

class KbScreen extends StatefulWidget {
  const KbScreen({super.key});
  @override
  State<KbScreen> createState() => _KbScreenState();
}

class _KbScreenState extends State<KbScreen> {
  List<KbDocument> _docs = [];
  bool _loading = true;
  String? _agentId;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final agents = await VaniApi.instance.listAgents();
      if (agents.isEmpty) { if (mounted) setState(() => _loading = false); return; }
      _agentId = agents.first.id;
      final docs = await VaniApi.instance.listKb(_agentId!);
      if (mounted) setState(() { _docs = docs; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pick() async {
    if (_agentId == null) return;
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'txt', 'docx']);
    if (result == null || result.files.isEmpty) return;
    setState(() => _uploading = true);
    try {
      await VaniApi.instance.uploadKbFile(_agentId!, result.files.first.path!, result.files.first.name);
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _delete(KbDocument doc) async {
    if (_agentId == null) return;
    await VaniApi.instance.deleteKbDoc(_agentId!, doc.id);
    setState(() => _docs.removeWhere((d) => d.id == doc.id));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: V.bg,
      appBar: AppBar(
        backgroundColor: V.bg,
        title: const Text('Knowledge Base', style: TextStyle(color: V.text, fontWeight: FontWeight.w700)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: V.text), onPressed: () => Navigator.pop(context)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: _uploading ? null : _pick,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: V.primary, borderRadius: BorderRadius.circular(10)),
                child: _uploading
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.add, color: Colors.white, size: 16),
                        SizedBox(width: 4),
                        Text('Add', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                      ]),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: V.primary))
          : _docs.isEmpty
              ? _empty()
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _docs.length,
                  itemBuilder: (_, i) => _card(_docs[i]).animate().fadeIn(delay: (i * 40).ms),
                ),
    );
  }

  Widget _empty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(18)),
              child: const Icon(Icons.description_outlined, color: V.primary, size: 28),
            ),
            const SizedBox(height: 16),
            const Text('No documents yet', style: TextStyle(color: V.text, fontSize: 17, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            const Text('Upload PDFs, menus, FAQs, price lists', style: TextStyle(color: V.textMuted, fontSize: 14)),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _pick,
              icon: const Icon(Icons.upload_file, size: 18),
              label: const Text('Upload'),
              style: ElevatedButton.styleFrom(backgroundColor: V.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            ),
          ],
        ),
      );

  Widget _card(KbDocument doc) {
    final ext = doc.filename.split('.').last.toLowerCase();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: V.border),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: V.primaryBg, borderRadius: BorderRadius.circular(10)),
            child: Icon(ext == 'pdf' ? Icons.picture_as_pdf_outlined : Icons.article_outlined, color: V.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doc.filename, style: const TextStyle(color: V.text, fontWeight: FontWeight.w500, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                Text('${doc.createdAt.day}/${doc.createdAt.month}/${doc.createdAt.year}', style: const TextStyle(color: V.textMuted, fontSize: 12)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => showDialog(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text('Delete?'),
                content: const Text('Agent will no longer have access.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                  TextButton(onPressed: () { Navigator.pop(context); _delete(doc); }, child: const Text('Delete', style: TextStyle(color: V.red))),
                ],
              ),
            ),
            child: const Icon(Icons.delete_outline, color: V.textMuted, size: 20),
          ),
        ],
      ),
    );
  }
}
