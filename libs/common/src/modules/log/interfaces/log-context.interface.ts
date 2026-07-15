/**
 * Represents the trace context for distributed tracing.
 */
export interface ITraceContext {
  trace_id?: string;
  span_id?: string;
  /** span_id ของผู้เรียก (caller) — ใช้ reconstruct call tree จาก log */
  parent_span_id?: string;
  correlation_id?: string;
}

/**
 * Represents the user context making the request.
 */
export interface IUserContext {
  id?: string;
  roles?: string[];
  ip_address?: string | null;
  user_agent?: string | null;
  // คุณสามารถเพิ่ม field อื่นๆ ที่จำเป็นได้ เช่น username, permissions
}

/**
 * Represents the full context object to be passed between microservices.
 */
export interface ICallContext {
  trace: ITraceContext;
  user?: IUserContext; // User อาจไม่มีในบางกรณี (เช่น system-to-system call)
}

export interface IRequestContext {
  user: IUserContext;
  trace: ITraceContext;
}

export interface ILogData {
  message: string;
  context?: Record<string, unknown> | string;
  details?: Record<string, unknown> | string;
}
