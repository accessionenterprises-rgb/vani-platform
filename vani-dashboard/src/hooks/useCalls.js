import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useCalls(filters = {}) {
  // Build clean params — strip empty values
  const params = {}
  if (filters.status && filters.status !== 'all') params.status = filters.status
  if (filters.agent_id) params.agent_id = filters.agent_id
  if (filters.limit) params.limit = filters.limit
  if (filters.offset) params.offset = filters.offset

  return useQuery({
    queryKey: ['calls', params],
    queryFn: () => api.listCalls(params),
    staleTime: 15_000,
    refetchInterval: 30_000, // auto-refresh every 30s
  })
}

export function useCall(id) {
  return useQuery({
    queryKey: ['call', id],
    queryFn: () => api.getCall(id),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCallTranscript(id) {
  return useQuery({
    queryKey: ['call', id, 'transcript'],
    queryFn: () => api.getTranscript(id),
    enabled: !!id,
  })
}

// Append a transcript chunk without invalidation (no flicker, no scroll reset)
export function useAppendTranscriptChunk() {
  const qc = useQueryClient()
  return (callId, chunk) => {
    qc.setQueryData(['call', callId], (old) => {
      if (!old) return old
      const transcript = old.transcript || ''
      return { ...old, transcript: transcript + '\n' + chunk }
    })
  }
}
