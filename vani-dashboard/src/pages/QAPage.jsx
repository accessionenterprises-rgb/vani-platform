import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function QAPage() {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [overview, setOverview] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [testRuns, setTestRuns] = useState([])
  const [activeTest, setActiveTest] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [trend, setTrend] = useState(null)
  const [loading, setLoading] = useState({})
  const [days, setDays] = useState(7)

  useEffect(() => { api.listAgents().then(setAgents).catch(() => {}) }, [])
  useEffect(() => { api.qaListTests().then(setTestRuns).catch(() => {}) }, [])

  useEffect(() => {
    if (!selectedAgent) return
    setLoading(l => ({ ...l, overview: true, suggestions: true, trend: true }))
    api.qaAgentOverview(selectedAgent, days).then(setOverview).catch(() => setOverview(null)).finally(() => setLoading(l => ({ ...l, overview: false })))
    api.qaGetSuggestions(selectedAgent).then(setSuggestions).catch(() => setSuggestions(null)).finally(() => setLoading(l => ({ ...l, suggestions: false })))
    api.qaGetTrend(selectedAgent, 30).then(setTrend).catch(() => setTrend(null)).finally(() => setLoading(l => ({ ...l, trend: false })))
  }, [selectedAgent, days])

  const runTest = async () => {
    if (!selectedAgent) return
    setLoading(l => ({ ...l, test: true }))
    try {
      const res = await api.qaRunTest(selectedAgent)
      // Poll for results
      const poll = setInterval(async () => {
        try {
          const result = await api.qaGetTest(res.test_run_id)
          if (result.run?.status === 'completed') {
            clearInterval(poll)
            setActiveTest(result)
            setLoading(l => ({ ...l, test: false }))
            api.qaListTests().then(setTestRuns)
          }
        } catch {}
      }, 3000)
    } catch {
      setLoading(l => ({ ...l, test: false }))
    }
  }

  const analyzeTranscripts = async () => {
    if (!selectedAgent) return
    setLoading(l => ({ ...l, analysis: true }))
    try {
      const res = await api.qaAnalyzeTranscripts(selectedAgent, days)
      setAnalysis(res)
    } catch {}
    setLoading(l => ({ ...l, analysis: false }))
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Quality Analysis</h1>
          <p className="text-sm text-zinc-400 mt-1">Test, analyze, and improve your voice agents</p>
        </div>
        <div className="flex gap-3">
          <select value={days} onChange={e => setDays(+e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300">
            <option value="">Select agent</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedAgent ? (
        <div className="flex items-center justify-center h-64 text-zinc-500">Select an agent to view quality analysis</div>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Stat label="Total Calls" value={overview.total_calls} />
              <Stat label="Completed" value={overview.completed} color="text-emerald-400" />
              <Stat label="Failed" value={overview.failed} color="text-red-400" />
              <Stat label="Avg Duration" value={`${overview.avg_duration_sec}s`} />
              <Stat label="Completion" value={`${overview.completion_rate}%`} color="text-blue-400" />
              <Stat label="QA Score" value={overview.avg_qa_score ? `${overview.avg_qa_score}/10` : '—'} color="text-violet-400" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={runTest} disabled={loading.test}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading.test ? 'Running tests...' : '▶ Run QA Test'}
            </button>
            <button onClick={analyzeTranscripts} disabled={loading.analysis}
              className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading.analysis ? 'Analyzing...' : '🔍 Analyze Transcripts'}
            </button>
          </div>

          {/* Active test results */}
          {activeTest && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Latest Test Results</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-bold text-violet-400">{activeTest.run?.avg_score ?? '—'}/10</div>
                <div className="text-sm text-zinc-400">
                  {activeTest.run?.scenario_count} scenarios • {activeTest.run?.total_issues} issues found
                </div>
              </div>
              <div className="space-y-3">
                {(activeTest.results || []).map((r, i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white text-sm">{r.scenario}</span>
                      <ScoreBadge score={r.overall_score} />
                    </div>
                    {(r.turns || []).map((t, j) => (
                      <div key={j} className="text-xs mt-2 space-y-1">
                        <div className="text-blue-300">USER: {t.user}</div>
                        <div className="text-zinc-300">AGENT: {t.agent}</div>
                        <div className="text-zinc-500">{t.latency_ms}ms {t.latency_ok ? '✓' : '⚠️ slow'}</div>
                      </div>
                    ))}
                    {r.issues?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {r.issues.map((issue, k) => (
                          <div key={k} className="text-xs text-amber-400">⚠ {issue}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript Analysis */}
          {analysis && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Transcript Analysis</h2>
                <span className={`text-2xl font-bold ${gradeColor(analysis.overall_grade)}`}>{analysis.overall_grade}</span>
              </div>
              <p className="text-sm text-zinc-300 mb-4">{analysis.summary}</p>
              {analysis.issues?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-400">Issues Found</h3>
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${issue.severity === 'high' ? 'bg-red-500/20 text-red-400' : issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-600/30 text-zinc-400'}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-zinc-500">{issue.frequency}</span>
                      </div>
                      <p className="text-sm text-white">{issue.problem}</p>
                      {issue.example && <p className="text-xs text-zinc-400 mt-1 italic">"{issue.example}"</p>}
                      {issue.fix && <p className="text-xs text-emerald-400 mt-1">Fix: {issue.fix}</p>}
                    </div>
                  ))}
                </div>
              )}
              {analysis.suggestions?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Suggestions</h3>
                  {analysis.suggestions.map((s, i) => (
                    <div key={i} className="text-sm text-zinc-300 flex items-start gap-2 mb-1">
                      <span className="text-violet-400 mt-0.5">→</span> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {suggestions?.suggestions?.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Improvement Suggestions</h2>
              <div className="space-y-3">
                {suggestions.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-3">
                    <span className={`text-xs px-2 py-0.5 rounded mt-0.5 ${s.priority === 'high' ? 'bg-red-500/20 text-red-400' : s.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-600/30 text-zinc-400'}`}>
                      {s.priority}
                    </span>
                    <div>
                      <span className="text-xs text-zinc-500 uppercase">{s.category}</span>
                      <p className="text-sm text-zinc-200">{s.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend Chart (simple text for now) */}
          {trend?.timeline?.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Trend (Last 30 days)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs">
                      <th className="text-left py-2">Date</th>
                      <th className="text-right py-2">Calls</th>
                      <th className="text-right py-2">Completed</th>
                      <th className="text-right py-2">Avg Duration</th>
                      <th className="text-right py-2">QA Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.timeline.map((d, i) => (
                      <tr key={i} className="border-t border-zinc-800 text-zinc-300">
                        <td className="py-2">{d.date}</td>
                        <td className="text-right">{d.calls ?? '—'}</td>
                        <td className="text-right">{d.completed ?? '—'}</td>
                        <td className="text-right">{d.avg_duration ? `${d.avg_duration}s` : '—'}</td>
                        <td className="text-right">{d.qa_score ? <ScoreBadge score={d.qa_score} /> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Past test runs */}
          {testRuns.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-white mb-4">Past QA Tests</h2>
              <div className="space-y-2">
                {testRuns.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-3 cursor-pointer hover:border-zinc-600"
                    onClick={async () => { try { setActiveTest(await api.qaGetTest(r.id)) } catch {} }}>
                    <div>
                      <span className="text-sm text-white">{r.scenario_count} scenarios</span>
                      <span className="text-xs text-zinc-500 ml-3">{r.method}</span>
                      <span className="text-xs text-zinc-500 ml-3">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreBadge score={r.avg_score} />
                      <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function ScoreBadge({ score }) {
  const s = parseFloat(score) || 0
  const color = s >= 8 ? 'bg-emerald-500/20 text-emerald-400' : s >= 6 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>{s}/10</span>
}

function gradeColor(grade) {
  if (grade === 'A') return 'text-emerald-400'
  if (grade === 'B') return 'text-blue-400'
  if (grade === 'C') return 'text-amber-400'
  return 'text-red-400'
}
