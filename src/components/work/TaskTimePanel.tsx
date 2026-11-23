import React from 'react';
import type { Task } from '../../types';

/**
 * The task detail's time block (CAT-77): estimate, time logged, start/stop timer. Track 2 owns this
 * file; TaskDetailModal (Track 1) only renders it. Nothing until Track 2 fills it in.
 */
export const TaskTimePanel: React.FC<{ task: Task }> = () => null;
