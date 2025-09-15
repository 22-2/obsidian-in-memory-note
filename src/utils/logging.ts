// Log levels as a constant object.
export const LOG_LEVEL = {
	DEBUG: "debug",
	INFO: "info",
	WARN: "warn",
	ERROR: "error",
} as const;

// LogLevel type generated from the constant object.
export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

// Priority of log levels.
const logLevelPriorities: Record<LogLevel, number> = {
	[LOG_LEVEL.DEBUG]: 1,
	[LOG_LEVEL.INFO]: 2,
	[LOG_LEVEL.WARN]: 3,
	[LOG_LEVEL.ERROR]: 4,
};

interface LoggerInternalSettings {
	level?: LogLevel;
	name: string;
}

// A no-operation function.
const noop = () => {};

/**
 * A logger class that supports dynamic log levels, prefixes, and correct source location tracking.
 *
 * This logger's key feature is its use of `console[level].bind(console, prefix)`.
 * This approach ensures that the file name and line number logged to the console
 * correspond to where the log function was called, not the logger's internal implementation.
 * This greatly improves debugging efficiency.
 */
export class DirectLogger {
	private settings: LoggerInternalSettings;
	private prefix: string;
	private settingLevelPriority: number;

	// Log functions are held as properties.
	public debug: (...args: any[]) => void = noop;
	public info: (...args: any[]) => void = noop;
	public warn: (...args: any[]) => void = noop;
	public error: (...args: any[]) => void = noop;
	public log: (...args: any[]) => void = noop;

	constructor(settings: LoggerInternalSettings) {
		this.settings = settings;
		this.prefix = `[${settings.name}]`;

		// Set initial level, defaulting to INFO.
		const initialLevel = settings.level || LOG_LEVEL.INFO;
		this.settings.level = initialLevel;
		this.settingLevelPriority = logLevelPriorities[initialLevel];

		// Initialize log functions in the constructor.
		this.regenerateLogFunctions();
	}

	/**
	 * Regenerates all log functions based on the current log level setting.
	 * This centralizes the logic for both the constructor and `updateLoggingState`.
	 * @private
	 */
	private regenerateLogFunctions(): void {
		const createLogFunction = (
			level: LogLevel
		): ((...args: any[]) => void) => {
			if (logLevelPriorities[level] >= this.settingLevelPriority) {
				// The core of this logger: binding the console method.
				// 1. **Preserves Caller Information**: Binding returns a function that, when executed,
				//    logs the correct file and line number of the call site.
				// 2. **Auto-Prefixing**: The prefix is passed as the first argument to the bound function.
				// 3. **Maintains `this` Context**: Ensures `console[level]` is called with `console` as `this`.
				return console[level].bind(console, this.prefix);
			}
			return noop;
		};

		this.debug = createLogFunction(LOG_LEVEL.DEBUG);
		this.info = createLogFunction(LOG_LEVEL.INFO);
		this.warn = createLogFunction(LOG_LEVEL.WARN);
		this.error = createLogFunction(LOG_LEVEL.ERROR);

		// `log` is an alias for `info`.
		this.log = this.info;
	}

	/**
	 * Dynamically updates the logger's log level and notifies the console of the change.
	 * @param logLevel The new log level to set.
	 */
	updateLoggingState(logLevel: LogLevel) {
		this.settings.level = logLevel;
		this.settingLevelPriority = logLevelPriorities[this.settings.level];

		// Regenerate log functions after the level changes.
		this.regenerateLogFunctions();

		// Use console.info directly to announce the change, regardless of the new level.
		console.info(
			`${this.prefix} Logging level set to: ${this.settings.level}`
		);
	}

	/**
	 * Creates a new child logger (sub-logger) from the current logger.
	 * The prefix is extended hierarchically (e.g., `[AppName]` -> `[AppName:SubName]`),
	 * and the log level is inherited from the parent.
	 * @param options - Options for the sub-logger.
	 * @param options.name - The name of the sub-logger, added to the prefix.
	 * @returns A new sub-logger instance.
	 */
	getSubLogger({ name }: { name: string }): DirectLogger {
		const basePrefix = this.prefix.slice(1, -1);
		const newPrefix = `${basePrefix}:${name}`;
		const subLogger = new DirectLogger({
			name: newPrefix,
			level: this.settings.level,
		});
		return subLogger;
	}
}

export const INITIAL_LOG_LEVEL = getInitialLogLevel();

function getInitialLogLevel(): LogLevel {
	const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL;
	// Check if envLevel is a valid log level.
	if (envLevel && Object.values(LOG_LEVEL).includes(envLevel as any)) {
		return envLevel as LogLevel;
	}
	return LOG_LEVEL.INFO; // Default to INFO
}
