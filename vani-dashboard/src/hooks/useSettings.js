import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// Team
export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: api.listTeam,
    staleTime: 60_000,
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.inviteMember(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }) => api.updateMember(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.removeMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

// API Keys
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: api.listKeys,
    staleTime: 60_000,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name) => api.createKey(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

// Webhooks
export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: api.listWebhooks,
    staleTime: 60_000,
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.createWebhook(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => api.updateWebhook(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

// Billing
export function useBillingPlan() {
  return useQuery({
    queryKey: ['billing', 'plan'],
    queryFn: api.getBillingPlan,
    staleTime: 300_000, // 5 min — billing doesn't change often
  })
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: api.getBillingInvoices,
    staleTime: 300_000,
  })
}
