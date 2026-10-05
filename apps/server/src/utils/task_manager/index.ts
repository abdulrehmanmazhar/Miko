import type { ITaskInstance } from "../../types/task_manager.js";
import { EventEmitter } from "events";
import { taskRunner } from "./orchestrator.js";
import { getTaskModuleURL } from "../paths/index.js";

export const TaskEvents = new EventEmitter();

export class Task implements ITaskInstance {
  id: string = crypto.randomUUID();
  name: string = "unnamed-task";
  feedbackScope: ITaskInstance["feedbackScope"] = "global";
  status: ITaskInstance["status"] = "queued";
  createdAt: Date = new Date();
  priority: ITaskInstance["priority"] = "normal";
  intensity: ITaskInstance["intensity"] = "medium";
  progress: number = 0;
  retries: number = 0;
  maxRetries: number = 5;
  message: string = "";
  error: string | null = null;
  data: any = null;
  taskArgs?: any;
  taskModule: string;
  event: EventEmitter;

  constructor(task: Partial<ITaskInstance>) {
    this.id = task.id || crypto.randomUUID();
    this.name = task.name || "unnamed-task";
    this.feedbackScope = task.feedbackScope || "global";
    this.status = task.status || "queued";
    this.createdAt = task.createdAt || new Date();
    this.priority = task.priority || "normal";
    this.intensity = task.intensity || "medium";
    this.progress = task.progress || 0;
    this.retries = task.retries || 0;
    this.maxRetries = task.maxRetries || 5;
    this.message = task.message || "Task has been queued";
    this.error = task.error || null;
    this.data = task.data || null;
    this.taskArgs = task.taskArgs || [];
    this.taskModule = task.taskModule || "default-module";
    // require event to be passed explicitly (injected)
    this.event = task.event || TaskEvents;
    this.businessFunction = task.businessFunction || this.businessFunction;
    this.taskFunction = task.taskFunction || this.taskFunction;

    // this.getData =  () => Promise<any>;
  }

  // small helper to emit centralized updates
  private emitUpdate() {
    // emit via provided event instance
    this.event.emit("task:update", this);
  }

  set setStatus(value: ITaskInstance["status"]) {
    if (this.status === value) return;
    this.status = value;
    this.emitUpdate();
  }

  set setProgress(value: number) {
    if (this.progress === value) return;
    this.progress = value;
    this.emitUpdate();
  }

  set setMessage(value: string) {
    if (this.message === value) return;
    this.message = value;
    this.emitUpdate();
  }

  set setError(value: string | null) {
    if (this.error === value) return;
    this.error = value;
    this.emitUpdate();
  }

  set setData(value: string | null) {
    if (this.data === value) return;
    this.data = value;
    this.emitUpdate();
  }

  set setRetries(value: number) {
    if (this.retries === value) return;
    this.retries = value;
    this.emitUpdate();
  }

  private attachControlListeners() {
    let canceled = false;
    let paused = false;

    // each pause/resume will trigger a Promise resolver
    let resumeResolver: (() => void) | null = null;

    const cancelEvent = `task:cancel:${this.id}`;
    const pauseEvent = `task:pause:${this.id}`;
    const resumeEvent = `task:resume:${this.id}`;

    const onCancel = () => {
      console.log("cancel");
      canceled = true;
      if (resumeResolver) {
        resumeResolver(); // unblock if waiting
        resumeResolver = null;
      }
    };

    const onPause = () => {
      paused = true;
    };

    const onResume = () => {
      paused = false;
      if (resumeResolver) {
        resumeResolver();
        resumeResolver = null;
      }
    };

    this.event.on(cancelEvent, onCancel);
    this.event.on(pauseEvent, onPause);
    this.event.on(resumeEvent, onResume);

    const waitUntilResumed = async () => {
      if (!paused) return;
      await new Promise<void>((resolve) => {
        resumeResolver = resolve;
      });
    };

    const cleanup = () => {
      this.event.off(cancelEvent, onCancel);
      this.event.off(pauseEvent, onPause);
      this.event.off(resumeEvent, onResume);
    };

    const getFlags = () => ({
      isCanceled: canceled,
      isPaused: paused,
      waitUntilResumed,
    });

    return { getFlags, cleanup };
  }

  businessFunction = async (_taskArgs: any) => {
    const { getFlags, cleanup } = this.attachControlListeners();

    try {
      // Create generator controller
      const generator = (await taskRunner(
        this.taskModule,
        _taskArgs,
        this.intensity,
      )) as unknown as {
        next: () => Promise<{ value: any; done: boolean }>;
        cancel: () => void;
        [Symbol.asyncIterator]: () => AsyncIterator<any>;
      };

      this.setStatus = "running";
      this.setMessage = "Task started";

      // Loop manually via next() to fully control flow
      while (true) {
        const flags = getFlags();

        // Cancel task immediately if needed
        if (flags.isCanceled) {
          this.setStatus = "canceled";
          this.setMessage = "Task has been canceled";
          generator?.cancel(); // Terminates worker
          cleanup();
          return;
        }

        // Handle pause (simply wait until resumed)
        if (flags.isPaused) {
          this.setStatus = "paused";
          this.setMessage = "Task is paused";
          await flags.waitUntilResumed();
          this.setStatus = "running";
          this.setMessage = "Task resumed";
        }

        const nextGen = await generator.next();
        const { value, done } = nextGen;

        if (done) break; // Worker completed all steps

        const { progress, message, error, data } = value || {};

        if (typeof progress === "number") this.setProgress = progress;
        if (typeof message === "string") this.setMessage = message;
        if (data !== undefined) this.setData = data;

        if (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.setError = errMsg;
          this.setStatus = "failed";
          cleanup();
          return;
        }

        // You can add artificial throttling if needed:
        // await new Promise(res => setTimeout(res, 50));
      }

      // All done normally
      if (this.progress >= 100) {
        this.setStatus = "completed";
        this.setMessage = "Task completed successfully";
      }

      cleanup();
      return;
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      this.setError = msg;
      this.setStatus = "failed";
      cleanup();
      return;
    }
  };

  /**
   * Default example taskFunction (async generator). Real tasks will override this.
   */
  taskFunction: (
    args: any,
  ) => AsyncGenerator<
    { progress: number; message: string; error?: any; data?: any },
    void,
    unknown
  > = async function* (_taskArgs: any) {
    yield {
      progress: 0,
      message: "Task function not implemented",
    };

    for (let i = 1; i <= 100; i++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate work
        if (i === 90) {
          throw new Error("Simulated error at 90%");
        }
        yield { progress: i, message: `Importing... ${i}%` };
      } catch (error) {
        yield { progress: i, message: `Error at ${i}%`, error };
      }
    }
  };

  getData = async (timeoutMs = 300000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const interval = setInterval(() => {
        if (this.status === "completed" && this.data !== null) {
          clearInterval(interval);
          resolve(this.data);
          return;
        }

        if (this.status === "failed" || this.error) {
          clearInterval(interval);
          reject(this.error || new Error("Task failed"));
          return;
        }

        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for task data"));
          return;
        }
      }, 100);
    });
  };
}

export class TaskManager {
  tasks: Record<string, Partial<ITaskInstance>> = {};
  taskQueue: ITaskInstance[] = [];
  taskEvents: EventEmitter = new EventEmitter();
  maxLowTasks: number = 10;
  maxMediumTasks: number = 5;
  maxHighTasks: number = 2;

  private _runTaskQueueDebounceTimer: NodeJS.Timeout | null = null;
  private _feedback: (arg: any) => void = (arg) => {};

  constructor(
    maxLowTasks: number,
    maxMediumTasks: number,
    maxHighTasks: number,
    event: EventEmitter,
    feedback: (arg: any) => void,
  ) {
    this.taskEvents = event;
    this.maxLowTasks = maxLowTasks;
    this.maxMediumTasks = maxMediumTasks;
    this.maxHighTasks = maxHighTasks;
    this._feedback = feedback;

    // bind debounced handler
    this.taskEvents.on("task:update", async (task: ITaskInstance) => {
      try {
        // clear junk in task queue
        // this.clearCompletedTasks().catch((e) => {
        //   console.error("clearCompletedTasks failed:", e);
        // });
        // await this.clearCompletedTasks();

        // update queue quickly too (so UI sees changes)
        await this.updateTaskQueue(task);

        await this.clearCompletedTasks();

        // schedule a debounced run to avoid thrashing
        this.scheduleRun();
      } catch (error) {
        console.log(error);
      }
    });
  }

  scheduleRun(delay = 50) {
    if (this._runTaskQueueDebounceTimer) {
      clearTimeout(this._runTaskQueueDebounceTimer);
    }
    this._runTaskQueueDebounceTimer = setTimeout(() => {
      this.runTaskQueue();
    }, delay);
  }

  registerTask(task: ITaskInstance["name"], defaults: Partial<ITaskInstance>) {
    this.tasks[task] = defaults;
  }

  async updateTaskQueue(task: ITaskInstance) {
    const existing = this.taskQueue.find((t) => t.id === task.id);
    if (!existing) {
      this.taskQueue.push(task);
    } else {
      // keep same object reference where possible to allow UI to track objects
      this.taskQueue = this.taskQueue.map((t) => (t.id === task.id ? task : t));
    }

    // send feedback to renderer process about task queue update (best-effort)
    try {
      // win?.webContents?.send?.("queue:update", this.taskQueue);
      this._feedback(this.taskQueue);
    } catch (e) {
      // swallow IPC errors
      console.log("IPC send failed", e);
    }

    return Promise.resolve();
  }

  async initiateTask(
    task: ITaskInstance["name"],
    taskArgs: unknown,
    optionalArgs?: Partial<ITaskInstance>,
  ) {
    if (!this.tasks[task]) {
      throw new Error(`Task ${task} not registered`);
    }

    const taskInstance = new Task({
      ...this.tasks[task],
      ...optionalArgs,
      name: task,
      taskArgs,
      event: this.taskEvents,
    });

    // put in queue and emit update (which will schedule run)
    this.taskEvents.emit("task:update", taskInstance);
    return taskInstance;
  }

  /**
   * Efficient scheduler:
   * - pick available slots per intensity
   * - run selected tasks in parallel (Promise.allSettled)
   * - update statuses and record errors
   */
  async runTaskQueue() {
    if (this.taskQueue.length === 0) return;

    const {
      maxHighTasks: maxHigh,
      maxMediumTasks: maxMed,
      maxLowTasks: maxLow,
    } = this;

    // snapshot filtered lists
    const runningTasks = this.taskQueue.filter((t) => t.status === "running");
    const queuedTasks = this.taskQueue.filter((t) => t.status === "queued");

    if (queuedTasks.length === 0) return;

    // group queued by intensity
    const byIntensity = {
      high: queuedTasks.filter((t) => t.intensity === "high"),
      medium: queuedTasks.filter((t) => t.intensity === "medium"),
      low: queuedTasks.filter((t) => t.intensity === "low"),
    };

    const runningCount = {
      high: runningTasks.filter((t) => t.intensity === "high").length,
      medium: runningTasks.filter((t) => t.intensity === "medium").length,
      low: runningTasks.filter((t) => t.intensity === "low").length,
    };

    const available = {
      high: Math.max(0, maxHigh - runningCount.high),
      medium: Math.max(0, maxMed - runningCount.medium),
      low: Math.max(0, maxLow - runningCount.low),
    };

    // select tasks limited by availability
    const selectedHigh = byIntensity.high.slice(0, available.high);
    const selectedMed = byIntensity.medium.slice(0, available.medium);
    const selectedLow = byIntensity.low.slice(0, available.low);

    const toRun = [...selectedHigh, ...selectedMed, ...selectedLow];

    if (toRun.length === 0) return;

    // Kick off all selected tasks in parallel, but each task run is individually handled (status updates & error capture)
    const runners = toRun.map((task) =>
      (async () => {
        try {
          // if (task.intensity === "high") {
          //   await runInChildProcess(task.businessFunction, [task.taskArgs]);
          // } else if (task.intensity === "medium") {
          //   await runInWorkerThread(task.businessFunction, [task.taskArgs]);
          // } else {
          //   await runInMainThread(task.businessFunction, [task.taskArgs]);
          // }
          task.businessFunction(task.taskArgs).catch((err) => {
            console.log(err);
          });
        } catch (err) {
          throw err;
        } finally {
          // schedule a queue run after this finishes (debounced)
          this.scheduleRun();
        }
      })(),
    );

    // wait for all runs to settle
    await Promise.allSettled(runners);

    // For observability
    const runningAfter = this.taskQueue.filter(
      (t) => t.status === "running",
    ).length;
    const queuedAfter = this.taskQueue.filter(
      (t) => t.status === "queued",
    ).length;

    console.debug(
      `runTaskQueue: started ${toRun.length} tasks — running:${runningAfter} queued:${queuedAfter}`,
    );
  }

  getRegisteredTasks() {
    return Object.keys(this.tasks);
  }

  getTaskQueue() {
    return this.taskQueue;
  }

  async cancelTask(id: string) {
    // namespaced event
    const task = this.taskQueue.find((t) => t.id === id);
    if (!task) return console.log("not found in queue");
    if (task.status !== "failed") {
      this.taskEvents.emit(`task:cancel:${id}`);
    } else {
      task.status = "canceled";
      this.taskEvents.emit("task:update", task);
    }
  }

  async pauseTask(id: string) {
    this.taskEvents.emit(`task:pause:${id}`);
  }

  async resumeTask(id: string) {
    this.taskEvents.emit(`task:resume:${id}`);
  }

  async retryTask(id: string) {
    const task = this.taskQueue.find((t) => t.id === id);
    if (!task) return;
    if (task.retries >= task.maxRetries) {
      return;
    }
    task.retries += 1;
    task.error = null;
    task.status = "queued";
    this.taskEvents.emit("task:update", task);
  }

  async clearCompletedTasks() {
    this.taskQueue = this.taskQueue.filter(
      (task) => task.status !== "completed" && task.status !== "canceled",
    );
    return Promise.resolve();
  }
}

const databaseTasks = [
  {
    name: "get_actions",
    defaults: {
      feedbackScope: "global",
      intensity: "low",
      taskModule: getTaskModuleURL("database/get_actions.js"),
      retries: 0,
      maxRetries: 1,
    } as Partial<ITaskInstance>,
  },
  //   {
  //     name: "export-sentia",
  //     defaults: {
  //       feedbackScope: "global",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("ExportSentiaFileTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "create-question-media",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("CreateQuestionMediaTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "connect-question-node",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("CreateNodeQuestionTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "shuffle-array",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("ShuffleArrayTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "excel-populate",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("ExcelPopulateTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "excel-reader",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("ExcelReaderTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "extract-zips",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("ExtractZipTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "create-question",
  //     defaults: {
  //       feedbackScope: "component:question",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("createQuestionTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "create-tag",
  //     defaults: {
  //       feedbackScope: "route:qbanks",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("createTagTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "create-qbank",
  //     defaults: {
  //       feedbackScope: "route:qbanks",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("createQBankTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "create-qbank-routes",
  //     defaults: {
  //       feedbackScope: "route:questionLibrary",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("CreateQBankRoutesTask.js"),
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "import-quiz",
  //     defaults: {
  //       feedbackScope: "component:ExportQuiz",
  //       priority: "normal",
  //       intensity: "medium",
  //       taskModule: getTaskModuleURL("importQuiz.js"),
  //       retries: 0,
  //       maxRetries: 5,
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "export-quiz",
  //     defaults: {
  //       feedbackScope: "component:ExportQuiz",
  //       priority: "normal",
  //       intensity: "medium",
  //       retries: 0,
  //       maxRetries: 5,
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "sync-data",
  //     defaults: {
  //       feedbackScope: "component:ExportQuiz",
  //       priority: "normal",
  //       intensity: "medium",
  //       retries: 0,
  //       maxRetries: 5,
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "backup-data",
  //     defaults: {
  //       feedbackScope: "component:ExportQuiz",
  //       priority: "normal",
  //       intensity: "medium",
  //       retries: 0,
  //       maxRetries: 5,
  //     } as Partial<ITaskInstance>,
  //   },
  //   {
  //     name: "restore-data",
  //     defaults: {
  //       feedbackScope: "component:ExportQuiz",
  //       priority: "normal",
  //       intensity: "medium",
  //       retries: 0,
  //       maxRetries: 5,
  //     } as Partial<ITaskInstance>,
  //   },
];

export const databaseTaskManager = new TaskManager(
  1,
  0,
  0,
  new EventEmitter(),
  () => {},
);

for (let task of databaseTasks) {
  databaseTaskManager.registerTask(task.name, task.defaults);
}
