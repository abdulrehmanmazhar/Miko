import type { EventEmitter } from "events";

export type TTaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "canceled";

export interface ITaskAction {
  type: "pause" | "resume" | "cancel" | "retry";
  taskId: string;
}

export interface IGeneratorsOutput {
  progress: number;
  message: string;
  error?: Error;
  data?: any;
}

export type TTaskPriority = "urgent" | "normal" | "late";

export type TTaskIntensity = "low" | "medium" | "high";

export type TTaskFeedbackScope =
  | "global"
  | `route:${string}`
  | `component:${string}`;

export interface ITaskInstance {
  id: string;
  name: string;
  feedbackScope: TTaskFeedbackScope;
  status: TTaskStatus;
  createdAt: Date;
  priority: TTaskPriority;
  intensity: TTaskIntensity;
  progress: number;
  retries: number;
  maxRetries: number;
  message: string;
  error: string | null;
  data: any | null;
  taskArgs?: any;
  taskModule: string;
  event: EventEmitter;
  taskFunction?: (
    taskArgs: any,
  ) => AsyncGenerator<IGeneratorsOutput, void, unknown>;
  businessFunction: (taskArgs: any) => Promise<void>;
  getData: () => Promise<any>;
}
