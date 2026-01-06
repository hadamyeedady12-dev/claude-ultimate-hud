export interface StdinInput {
  model: {
    display_name: string;
  };
  context_window: {
    context_window_size: number;
    current_usage?: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
  cost: {
    total_cost_usd: number;
  };
  cwd?: string;
  transcript_path?: string;
}

export interface Config {
  language: 'en' | 'ko' | 'auto';
  plan: 'pro' | 'max';
  cache: {
    ttlSeconds: number;
  };
}

export const DEFAULT_CONFIG: Config = {
  language: 'auto',
  plan: 'max',
  cache: {
    ttlSeconds: 60,
  },
};

export interface RateLimitInfo {
  utilization: number;
  resets_at?: string;
}

export interface UsageLimits {
  five_hour?: RateLimitInfo;
  seven_day?: RateLimitInfo;
  seven_day_sonnet?: RateLimitInfo;
}

export interface ConfigCounts {
  claudeMdCount: number;
  rulesCount: number;
  mcpCount: number;
  hooksCount: number;
}

export interface ToolEntry {
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
}

export interface AgentEntry {
  type: string;
  model?: string;
  description?: string;
  status: 'running' | 'completed';
  startTime: Date;
  endTime?: Date;
}

export interface TodoEntry {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TranscriptData {
  sessionStart?: Date;
  tools: ToolEntry[];
  agents: AgentEntry[];
  todos: TodoEntry[];
}

export interface RenderContext {
  stdin: StdinInput;
  config: Config;
  transcript: TranscriptData;
  configCounts: ConfigCounts;
  gitBranch?: string;
  sessionDuration: string;
  rateLimits: UsageLimits | null;
}

export interface Translations {
  labels: {
    '5h': string;
    '7d_all': string;
    '7d_sonnet': string;
  };
  time: {
    hours: string;
    minutes: string;
    shortHours: string;
    shortMinutes: string;
  };
  errors: {
    no_context: string;
  };
}
