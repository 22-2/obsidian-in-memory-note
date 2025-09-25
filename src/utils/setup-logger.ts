import log from "loglevel";
import { Notice } from "obsidian"; // ObsidianのAPIからNoticeクラスをインポート

const originalFactory = log.methodFactory;

const obsidianNoticeMethodFactory: log.MethodFactory = (
	methodName,
	logLevel,
	loggerName
) => {
	const rawMethod = originalFactory(methodName, logLevel, loggerName);

	return (...args) => {
		if (logLevel === log.levels.ERROR) {
			const errorMessage =
				args[0]?.toString() || "An unknown error occurred.";
			new Notice(errorMessage);
		}
		rawMethod(args);
	};
};

export function overwriteLogLevel() {
	log.methodFactory = obsidianNoticeMethodFactory;
}
