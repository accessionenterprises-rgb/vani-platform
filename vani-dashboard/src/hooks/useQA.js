import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useQAOverview(agentId, days = 7) {
  return useQuery({
    queryKey: ['qa', 'overview', agentId, days],
    queryFn: () => api.qaAgentOverview(agentId, days),
    enabled: !!agentId,
    staleTime: 60_000,
  })
}

export function useQATests() {
  return useQuery({
    queryKey: ['qa', 'tests'],
    queryFn: api.qaListTests,
    staleTime: 30_000,
  })
}

export function useQATest(id) {
  return useQuery({
    queryKey: ['qa', 'test', id],
    queryFn: () => api.qaGetTest(id),
    enabled: !!id,
  })
}

export function useQASuggestions(agentId) {
  return useQuery({
    queryKey: ['qa', 'suggestions', agentId],
    queryFn: () => api.qaGetSuggestions(agentId),
    enabled: !!agentId,
  })
}

export function useQATrend(agentId, days = 30) {
  return useQuery({
    queryKey: ['qa', 'trend', agentId, days],
    queryFn: () => api.qaGetTrend(agentId, days),
    enabled: !!agentId,
  })
}

export function useRunQATest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, method }) => api.qaRunTest(agentId, method),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa', 'tests'] }),
  })
}

export function useAnalyzeTranscripts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, days }) => api.qaAnalyzeTranscripts(agentId, days),
    onSuccess: (_, { agentId }) => {
      qc.invalidateQueries({ queryKey: ['qa', 'overview', agentId] })
      qc.invalidateQueries({ queryKey: ['qa', 'suggestions', agentId] })
    },
  })
}
