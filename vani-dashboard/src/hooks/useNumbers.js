import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export function useNumbers() {
  return useQuery({
    queryKey: ['numbers'],
    queryFn: api.listNumbers,
    staleTime: 60_000,
  })
}

export function useUpdateNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => api.updateNumber(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbers'] }),
  })
}

export function useDeleteNumber() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteNumber(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['numbers'] }),
  })
}

// Hunter
export function useHunterResults(status = 'available', country = null, tier = null) {
  return useQuery({
    queryKey: ['hunter', 'results', status, country, tier],
    queryFn: () => api.hunterResults(status, country, tier),
    staleTime: 30_000,
  })
}

export function useHunterScans(country = null) {
  return useQuery({
    queryKey: ['hunter', 'scans', country],
    queryFn: () => api.hunterScans(country),
  })
}

export function useHunterScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (country) => api.hunterScan(country),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunter'] })
    },
  })
}

export function useHunterPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (number) => api.hunterPurchase(number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunter'] })
      qc.invalidateQueries({ queryKey: ['numbers'] })
    },
  })
}
