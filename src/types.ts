export type Bindings = {
    DB: D1Database;
    TASK_DO: DurableObjectNamespace;
    RIDER_DO: DurableObjectNamespace;
    AUTO_ASSIGN_QUEUE: Queue;
    WEBHOOK_QUEUE: Queue;
  };
  
  export type Env = {
    Bindings: Bindings;
    Variables: {
      developerId: string;
    };
  };
  