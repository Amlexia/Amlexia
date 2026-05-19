export type PlanTier = 'startup' | 'pro' | 'enterprise';

export interface PlanLimits {
  eventsPerMonth: number;
  maxProjects: number;
  requestsPerMinute: number;
  retentionRawDays: number;
}

/** Realistic limits for indie devs / early startups (not 100k/mo). */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  startup: {
    eventsPerMonth: 10_000,
    maxProjects: 1,
    requestsPerMinute: 120,
    retentionRawDays: 7,
  },
  pro: {
    eventsPerMonth: 2_000_000,
    maxProjects: Number.POSITIVE_INFINITY,
    requestsPerMinute: 1_000,
    retentionRawDays: 30,
  },
  enterprise: {
    eventsPerMonth: Number.POSITIVE_INFINITY,
    maxProjects: Number.POSITIVE_INFINITY,
    requestsPerMinute: 5_000,
    retentionRawDays: 90,
  },
};

export function getPlanLimits(tier?: string | null): PlanLimits {
  const key = (tier ?? 'startup') as PlanTier;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.startup;
}

export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}
