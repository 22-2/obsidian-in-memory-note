// --- Change (1): Centralize Log Level Definitions ---
// Log level names, priorities, and console method names are grouped into one object.
// This makes log level settings complete and intuitive at a glance.
export const LogLevelSettings = {
	debug: { priority: 1, name: "debug" },
	info: { priority: 2, name: "info" },
	warn: { priority: 3, name: "warn" },
	error: { priority: 4, name: "error" },
} as const;

// --- Change (2): Make LogLevel type more intuitive ---
// The LogLevel type is changed to specific string literal types: 'debug' | 'info' | 'warn' | 'error'.
// This makes the type itself represent the possible values, improving clarity.
export type LogLevel = keyof typeof LogLevelSettings;

export type LogFn = (...args: any[]) => void;

interface LoggerInternalSettings {
	level?: LogLevel;
	name: string;
}

// A function that does nothing
const noop = () => {};

/**
 * A Logger class for dynamic log level changes, prefix display, and identifying the caller's line number.
 *
 * The key feature of this logger is using `console` method `bind`.
 * This allows the console to correctly show the file name and line number where the log was called.
 * This greatly improves debugging efficiency.
 */
export class DirectLogger {
	private static _instance: DirectLogger;
	private settings: LoggerInternalSettings;
	private prefix: string;
	private children: DirectLogger[] = [];

	// --- Change (3): Remove redundant property, use a getter instead ---
	// Removed the separate property for log level priority.
	// Now, it's a getter that calculates priority dynamically from the current log level.
	// This reduces managed state, making the code simpler and more robust.
	private get currentLevelPriority(): number {
		// Safely defaults to 'info' if settings.level is not set.
		const level = this.settings.level ?? "info";
		return LogLevelSettings[level].priority;
	}

	public debug: (...args: any[]) => void = noop;
	public info: (...args: any[]) => void = noop;
	public warn: (...args: any[]) => void = noop;
	public error: (...args: any[]) => void = noop;
	public log: (...args: any[]) => void = noop;

	private constructor(settings: LoggerInternalSettings) {
		this.settings = settings;
		this.prefix = `[${settings.name}]`;

		// Set initial level using string literal type, e.g., 'info'
		this.settings.level = settings.level || "info";

		this.regenerateLogFunctions();
		console.info(
			`${this.prefix} Logger initialized with level: ${this.settings.level}`,
		);
	}

	public static get instance(): DirectLogger {
		if (!this._instance) {
			this._instance = new DirectLogger({
				name: "Nobi",
				level: INITIAL_LOG_LEVEL,
			});
		}
		return this._instance;
	}

	/**
	 * [New] Regenerates all log functions based on the current log level settings.
	 * This method centralizes logic, allowing `constructor` and `updateLoggingState` to share code.
	 * @private
	 * @description
	 * [Most Important] The core of this logger is `console[level].bind(console, this.prefix)`.
	 * 1. **Preserves Caller Info**: Returns a `bind`ed console function, delaying execution to the caller.
	 *    This means the console output correctly shows the file and line number where `Logger.debug(...)`
	 *    was written, not inside this logger class.
	 * 2. **Auto-Adds Prefix**: The prefix is passed as the second argument to `bind`, automatically added to the log output.
	 * 3. **Maintains `this` Context**: Ensures `console` methods run with the correct `this` (the `console` object itself).
	 */
	private regenerateLogFunctions(): void {
		const createLogFunction = (
			level: LogLevel,
		): ((...args: any[]) => void) => {
			// Compare priorities using the new getter.
			if (LogLevelSettings[level].priority >= this.currentLevelPriority) {
				return console[level].bind(console, this.prefix);
			}
			return noop;
		};

		this.debug = createLogFunction("debug");
		this.info = createLogFunction("info");
		this.warn = createLogFunction("warn");
		this.error = createLogFunction("error");

		// Set `log` as an alias for `info`
		this.log = this.info;
	}

	/**
	 * Dynamically updates the logger's log level and notifies the console of the change.
	 * @param logLevel The new log level to set
	 */
	updateLoggingState(logLevel: LogLevel) {
		this.settings.level = logLevel;

		// No need to update priority property, making the code cleaner.
		this.regenerateLogFunctions();

		// Propagate the change to children
		for (const child of this.children) {
			child.updateLoggingState(logLevel);
		}

		console.info(
			`${this.prefix} Logging level set to: ${this.settings.level}`,
		);
	}

	getLogLevel() {
		return this.settings.level || "info";
	}

	/**
	 * Creates a new child logger (sub-logger) with the current logger as its parent.
	 * The prefix is extended hierarchically (e.g., `[AppName]` -> `[AppName:SubName]`),
	 * and log level settings are inherited from the parent.
	 * @param options Options for the sub-logger
	 * @param options.name The name of the sub-logger, added to the prefix.
	 * @returns A new sub-logger instance
	 */
	getSubLogger({ name }: { name: string }): DirectLogger {
		const basePrefix = this.prefix.slice(1, -1);
		const newPrefix = `${basePrefix}:${name}`;
		const subLogger = new DirectLogger({
			name: newPrefix,
			level: this.settings.level,
		});
		this.children.push(subLogger);
		return subLogger;
	}
}

export const INITIAL_LOG_LEVEL = getInitialLogLevel();

function getInitialLogLevel(): LogLevel {
	if (typeof process === "undefined") {
		// Set default to info in browser environment
		return "info";
	}
	const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL;
	// Check if envLevel is one of the LogLevelSettings keys
	const availableLevels = Object.keys(LogLevelSettings) as LogLevel[];
	if (envLevel && availableLevels.includes(envLevel as any)) {
		return envLevel as LogLevel;
	}
	return "info"; // Default to info
}

export const Logger = DirectLogger.instance;