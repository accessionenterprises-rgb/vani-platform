import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: api.listAgents,
    staleTime: 30_000,
  })
}

export function useAgent(id) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => api.getAgent(id),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useAgentVersions(id) {
  return useQuery({
    queryKey: ['agent', id, 'versions'],
    queryFn: () => api.listAgentVersions(id),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.createAgent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => api.updateAgent(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['agent', id] })
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useAgentKB(agentId) {
  return useQuery({
    queryKey: ['agent', agentId, 'kb'],
    queryFn: () => api.listKb(agentId),
    enabled: !!agentId,
  })
}

export function useAgentTools(agentId) {
  return useQuery({
    queryKey: ['agent', agentId, 'tools'],
    queryFn: () => api.listTools(agentId),
    enabled: !!agentId,
  })
}
