/** Token buffer added to current usage to account for autocompact overhead */
export const AUTOCOMPACT_BUFFER = 45000;

/** Width of the progress bar in terminal characters */
export const PROGRESS_BAR_WIDTH = 10;

/** Max running tools to display */
export const MAX_RUNNING_TOOLS = 2;

/** Max completed tool types to display (sorted by frequency) */
export const MAX_COMPLETED_TOOL_TYPES = 4;

/** Max agents to display at once */
export const MAX_AGENTS_DISPLAY = 3;

/** Max completed agents to show */
export const MAX_COMPLETED_AGENTS = 2;

/** Max description length for agent entries */
export const MAX_AGENT_DESC_LENGTH = 40;

/** Max content length for todo entries */
export const MAX_TODO_CONTENT_LENGTH = 50;

/** Max recent tools kept from transcript */
export const MAX_TRANSCRIPT_TOOLS = 20;

/** Max recent agents kept from transcript */
export const MAX_TRANSCRIPT_AGENTS = 10;

/** Timeout for stdin reading in milliseconds */
export const STDIN_TIMEOUT_MS = 5000;

/** Timeout for external process calls (git, security keychain) in milliseconds */
export const EXEC_TIMEOUT_MS = 3000;

/** Timeout for API requests in milliseconds */
export const API_TIMEOUT_MS = 5000;
