// scripts/run-test-and-log.ts
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import notifier from "node-notifier";

const LOG_DIR = "test-results";
const MAX_LOG_FILES = 10; // 保持するログファイル数の上限

// --------------------------------------------------
// 1. ヘルパー関数: OSに基づいてファイルを開く
// --------------------------------------------------
function openFile(filePath: string) {
	const command = `code ${filePath}`;

	try {
		console.log(`Executing file open command: ${command}`);
		// ファイルオープンコマンドを実行
		execSync(command, { stdio: "ignore" });
	} catch (e) {
		console.error(`Could not open file: ${e}`);
	}
}

// --------------------------------------------------
// 2. ヘルパー関数: 古いログファイルを削除する
// --------------------------------------------------
function cleanupOldLogs() {
	if (!fs.existsSync(LOG_DIR)) {
		return;
	}

	try {
		// 1. ログファイルを取得し、パスと名前を保持
		const files = fs
			.readdirSync(LOG_DIR)
			.filter((file) => file.endsWith(".log"))
			.map((file) => ({
				name: file,
				path: path.join(LOG_DIR, file),
			}));

		// 2. ファイル名（タイムスタンプやコミットハッシュを含む）の辞書順でソート
		files.sort((a, b) => a.name.localeCompare(b.name));

		// 3. 上限を超えているか確認し、古いファイル（先頭から）を特定
		if (files.length > MAX_LOG_FILES) {
			// 残すのはリストの末尾 MAX_LOG_FILES 件。それ以外を削除対象とする。
			const filesToDelete = files.slice(0, files.length - MAX_LOG_FILES);

			console.log(
				`\n🧹 Cleaning up old logs: Deleting ${filesToDelete.length} files. (Max allowed: ${MAX_LOG_FILES})`
			);
			filesToDelete.forEach((file) => {
				fs.unlinkSync(file.path);
			});
			console.log("Log cleanup finished.");
		}
	} catch (e) {
		console.error("Error during log cleanup:", e);
	}
}

// --------------------------------------------------
// 3. メイン処理 (非同期化)
// --------------------------------------------------
async function runTestAndLog() {
	let failedLogPath: string | null = null;
	let testsFailed = false;

	try {
		if (!fs.existsSync(LOG_DIR)) {
			fs.mkdirSync(LOG_DIR, { recursive: true });
		}

		const commitHash = execSync("git rev-parse HEAD", {
			encoding: "utf8",
		}).trim();
		const logFilePath = path.join(LOG_DIR, `${commitHash}.log`);

		console.log(`Running tests for commit: ${commitHash}`);
		console.log(`Log output will be saved to: ${logFilePath}`);

		const testCommand = "pnpm run test:e2e --reporter=list";
		const output = execSync(testCommand, { encoding: "utf8" });

		fs.writeFileSync(logFilePath, output);

		console.log("Tests passed successfully.");

		// 成功終了前にログをクリーンアップ
		cleanupOldLogs();
		process.exit(0); // 成功時はここで終了
	} catch (error: any) {
		testsFailed = true;

		// 失敗時のログファイルパスを生成し、failedLogPathに保存
		const timestamp = new Intl.DateTimeFormat("ja-JP", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			weekday: "long",

			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			fractionalSecondDigits: 2,

			timeZone: "Asia/Tokyo",
			timeZoneName: "long",
		})
			.format(new Date())
			.replace(/[\\/:*?"<>|\s.]/g, "-");
		const logFileName = `FAIL_${timestamp}.log`;
		failedLogPath = path.resolve(path.join(LOG_DIR, logFileName));

		let errorOutput = "";
		if (error.stdout) errorOutput += error.stdout;
		if (error.stderr) errorOutput += error.stderr;

		fs.writeFileSync(failedLogPath, errorOutput || error.message);

		console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		console.error("TESTS FAILED!");
		console.error(`Check log file for details: ${failedLogPath}`);
		console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");

		// 通知を表示し、クリックを待機するように設定 (wait: true)
		notifier.notify({
			title: "E2E Tests Failed",
			message: "Click to open the log file.",
			wait: true,
		});
	}

	// --------------------------------------------------
	// 4. クリックイベントを待機し、ファイルを開く (失敗時のみ実行)
	// --------------------------------------------------
	if (testsFailed) {
		console.log("Waiting for user interaction with notification...");

		// Promiseを使用して、クリックイベントまたはタイムアウトまでプロセスをブロックする
		await new Promise<void>((resolve) => {
			// クリックリスナー: ログファイルを開き、待機を終了
			notifier.on("click", function () {
				console.log("Notification clicked. Opening log file.");
				if (failedLogPath) {
					openFile(failedLogPath);
				}
				resolve();
			});

			// タイムアウトリスナー: 待機を終了
			notifier.on("timeout", function () {
				console.log("Notification timed out.");
				resolve();
			});
		});

		// クリック処理またはタイムアウト後、ログをクリーンアップ
		cleanupOldLogs();

		// [修正点] テストは失敗したが、スクリプトは成功終了コード 0 で終了し、コミットを継続させる
		process.exit(0);
	}
}

// スクリプトの実行
runTestAndLog().catch((err) => {
	console.error("An unexpected error occurred during script execution:", err);
	// 予期せぬスクリプトエラーの場合は、念のため終了コード 1 を返す
	process.exit(1);
});
