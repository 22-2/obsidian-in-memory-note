import log from "loglevel";
import { Notice } from "obsidian"; // ObsidianのAPIからNoticeクラスをインポート
import { t } from "../i18n";

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
				args[0]?.toString() || t("notices.unknownError");
			new Notice(errorMessage);
		}
		rawMethod.apply(null, args);
	};
};

export function overwriteLogLevel() {
	log.methodFactory = obsidianNoticeMethodFactory;
}
