import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useAnalyticsOverview(period = 7) {
  return useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => api.analyticsOverview(period),
    staleTime: 60_000,
  })
}

export function useAnalyticsCalls(period = 7) {
  return useQuery({
    queryKey: ['analytics', 'calls', period],
    queryFn: () => api.analyticsCalls(period),
    staleTime: 60_000,
  })
}

export function useAnalyticsAgents(period = 7) {
  return useQuery({
    queryKey: ['analytics', 'agents', period],
    queryFn: () => api.analyticsAgents(period),
    staleTime: 60_000,
  })
}

export function useAnalyticsIntents(period = 7) {
  return useQuery({
    queryKey: ['analytics', 'intents', period],
    queryFn: () => api.analyticsIntents(period),
    staleTime: 60_000,
  })
}

export function useAnalyticsProviders(period = 7) {
  return useQuery({
    queryKey: ['analytics', 'providers', period],
    queryFn: () => api.analyticsProviders(period),
    staleTime: 60_000,
  })
}
