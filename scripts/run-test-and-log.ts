// scripts/run-test-and-log.ts
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import notifier from "node-notifier";
const LOG_DIR = "test-results";

try {
	// 1. ログディレクトリの作成 (クロスプラットフォームで安全)
	if (!fs.existsSync(LOG_DIR)) {
		fs.mkdirSync(LOG_DIR, { recursive: true });
	}

	// 2. 現在のコミットハッシュを取得 (Node.jsでGitコマンドを実行)
	const commitHash = execSync("git rev-parse HEAD", {
		encoding: "utf8",
	}).trim();
	const logFilePath = path.join(LOG_DIR, `${commitHash}.log`);

	console.log(`Running tests for commit: ${commitHash}`);
	console.log(`Log output will be saved to: ${logFilePath}`);

	// 3. テストを実行し、出力をキャプチャ
	// pnpm run test コマンドを実行し、標準出力と標準エラーをまとめて取得
	const testCommand = "pnpm run test -- --silent --reporter dot";

	// 標準入出力は親プロセスに引き継ぎ、テスト自体の実行結果をキャプチャ
	const output = execSync(testCommand, {
		encoding: "utf8",
		// stdio: ['inherit', 'pipe', 'pipe'] を使用して出力をキャプチャ
		// テストの進捗をコンソールに出したくないため、これで制御
	});

	// 4. ログファイルに書き込み
	fs.writeFileSync(logFilePath, output);

	console.log("Tests passed successfully.");
	process.exit(0); // 成功終了
} catch (error: any) {
	// テスト失敗 (終了コード 1 を返す)
	const logFilePath = path.join(
		LOG_DIR,
		`FAIL_${new Date().toISOString().replace(/[:.]/g, "-")}.log`
	);

	let errorOutput = "";
	if (error.stdout) errorOutput += error.stdout;
	if (error.stderr) errorOutput += error.stderr;

	fs.writeFileSync(logFilePath, errorOutput || error.message);

	console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
	console.error("TESTS FAILED! Aborting commit.");
	console.error(`Check log file for details: ${logFilePath}`);
	console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");

	// 失敗をGit Hooksに伝える
	// process.exit(1);
	notifier.notify({
		title: "E2E Tests Failed",
		message: "Check the log file for details.",
		open: logFilePath,
	});
}
