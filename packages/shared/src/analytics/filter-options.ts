import type { TimeRange } from '../types.js';
import type { EnvironmentFilter } from './env-filter.js';

export interface AnalyticsQueryOptions {
  environment?: EnvironmentFilter;
}

export type { TimeRange, EnvironmentFilter };
