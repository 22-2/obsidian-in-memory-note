import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
import chalk from "chalk";

// 色の設定
const colors = {
	TRACE: chalk.magenta,
	DEBUG: chalk.cyan,
	INFO: chalk.blue,
	WARN: chalk.yellow,
	ERROR: chalk.red,
};

// prefix プラグインを適用
prefix.reg(log);

prefix.apply(log, {
	format(level, name, timestamp) {
		const color =
			colors[level.toUpperCase() as keyof typeof colors] || chalk.white;
		const nameStr = name ? `[${name}]` : "";
		return `${chalk.gray(`[${timestamp}]`)} ${color(level)} ${chalk.green(
			nameStr
		)}`;
	},
});

export const issue1Logger = log.getLogger(
	"Content Synchronization Across Multiple Views"
);
export const issue2Logger = log.getLogger(
	"addHotActiveView not inheriting masterNoteId"
);
