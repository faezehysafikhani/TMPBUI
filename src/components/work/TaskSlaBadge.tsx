import React from 'react';
import type { Task } from '../../types';

/**
 * The SLA badge on a task card (CAT-119), from task.server?.slaDueAtUtc / slaBreachedAtUtc. Track 2
 * owns this file; TaskCard (Track 1) only renders it. Nothing until Track 2 fills it in.
 */
export const TaskSlaBadge: React.FC<{ task: Task }> = () => null;
