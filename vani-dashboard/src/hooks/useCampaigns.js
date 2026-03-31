import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: api.listCampaigns,
    staleTime: 30_000,
  })
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.getCampaign(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCampaignContacts(id, params = {}) {
  return useQuery({
    queryKey: ['campaign', id, 'contacts', params],
    queryFn: () => api.getCampaignContacts(id, params),
    enabled: !!id,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.createCampaign(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useStartCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.startCampaign(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function usePauseCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.pauseCampaign(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useCancelCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.cancelCampaign(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
