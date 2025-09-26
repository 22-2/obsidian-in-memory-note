// scripts/run-test-and-log.ts (ESM形式のimportを使用)
// 注意: このファイルを実行するには、Node.js >= 16 と適切なtsconfig設定が必要です。
import { exec, execSync } from "child_process";
import fs from "fs";
import path from "path";
// node-notifier を削除し、powertoast をインポート
import { Toast } from "powertoast";
import open from "open";
const LOG_DIR = "test-results";
const MAX_LOG_FILES = 10;
const HTML_REPORT_PATH = path.resolve("playwright-report/index.html");

// --------------------------------------------------
// 1. ヘルパー関数: OSに基づいてファイルを開く (Windows専用として簡略化)
// --------------------------------------------------
function openFile(filePath: string) {
	// Windowsに限定するため、プラットフォームチェックを簡略化

	try {
		console.log(`Executing file  (async): ${filePath}`);

		// exec を使用して非同期でコマンドを実行し、子プロセスが切り離されることを期待する
		open(filePath).catch((error) => {
			if (error) {
				console.error(`Error opening file: ${filePath}`);
				console.error(error);
			}
		});
	} catch (e) {
		console.error(`Could not initialize file : ${filePath}`);
		console.error(e);
	}
}

// --------------------------------------------------
// 2. ヘルパー関数: 古いログファイルを削除する (変更なし)
// --------------------------------------------------
function cleanupOldLogs() {
	if (!fs.existsSync(LOG_DIR)) {
		return;
	}
	// ... (ログクリーンアップ処理は省略) ...
	try {
		const files = fs
			.readdirSync(LOG_DIR)
			.filter((file) => file.endsWith(".log"))
			.map((file) => ({
				name: file,
				path: path.join(LOG_DIR, file),
			}));

		files.sort((a, b) => a.name.localeCompare(b.name));

		if (files.length > MAX_LOG_FILES) {
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
// 3. メイン処理
// --------------------------------------------------
async function runTestAndLog() {
	let failedLogPath: string | null = null;
	let testsFailed = false;

	try {
		// ... (テスト実行、成功時は exit 0) ...
		if (!fs.existsSync(LOG_DIR)) {
			fs.mkdirSync(LOG_DIR, { recursive: true });
		}

		const commitHash = execSync("git rev-parse HEAD", {
			encoding: "utf8",
		}).trim();
		const logFilePath = path.join(LOG_DIR, `${commitHash}.log`);

		const testCommand = "pnpm run test:e2e --reporter=list";
		const output = execSync(testCommand, { encoding: "utf8" });

		fs.writeFileSync(logFilePath, output);

		console.log("Tests passed successfully.");

		cleanupOldLogs();
		process.exit(0);
	} catch (error: any) {
		testsFailed = true;

		// 失敗時のログファイルパスを生成
		const timestamp = new Intl.DateTimeFormat("ja-JP", {
			// ... (タイムスタンプ生成処理は省略) ...
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			fractionalSecondDigits: 2,
			timeZone: "Asia/Tokyo",
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
	}

	// --------------------------------------------------
	// 4. powertoast を使用した通知とイベント処理 (失敗時のみ実行)
	// --------------------------------------------------
	if (testsFailed && failedLogPath) {
		console.log("Showing powertoast notification...");

		// powertoast の keepalive を長めに設定し、イベントリスナーを維持する
		const toast = new Toast({
			title: "E2E Tests Failed",
			message: "クリックでログを開く。下のボタンでHTMLレポートを開く。",
			// アクションボタンを定義 (activation 引数でクリック時のIDを指定)
			button: [
				{ text: "Open HTML Report", activation: "myapp:report" },
				{ text: "Open Raw Log", activation: "myapp:log" },
			],
		});

		// アクションボタンがクリックされたときの処理
		toast.on("activated", (event: string, input: object) => {
			console.log(`Toast activated with event: ${event}`);

			if (event === "report") {
				openFile(HTML_REPORT_PATH); // HTMLレポート
			} else if (event === "log" && failedLogPath) {
				openFile(failedLogPath); // 生ログ
			} else {
				// 通知本体のクリックや不明なアクションの場合のフォールバック
				openFile(failedLogPath);
			}
		});

		// 通知が消えるのを待機するための Promise
		await new Promise<void>((resolve) => {
			// トーストが消去されたら resolve
			toast.on("dismissed", (reason: string) => {
				console.log(`Toast dismissed: ${reason}`);
				resolve();
			});

			// keepalive オプションを設定し、イベント待ちの時間を指定
			// powertoastのドキュメントによると、イベント処理が必要な場合は keepalive が重要
			// デフォルトの通知表示時間は5秒なので、6秒待機する
			toast
				.show({ keepalive: 6 })
				.then(() => {
					// 通知が表示されたが、まだユーザー操作を待っている状態
					console.log("Toast shown. Awaiting user interaction...");
				})
				.catch((err) => {
					console.error("Failed to show toast:", err);
					resolve(); // エラー時はすぐに終了
				});

			// Note: activated イベントは通知が消える前に発生するため、
			// activated イベント内で openFile が実行された後、明示的な resolve は不要。
			// dismissed イベントが最終的に Promise を解決する。
		});

		cleanupOldLogs();
		process.exit(0);
	}
}

// スクリプトの実行
runTestAndLog().catch((err) => {
	console.error("An unexpected error occurred during script execution:", err);
	process.exit(1);
});
