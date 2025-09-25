// precommitが走るとJULESでバグが起きるのでその対処
// check-os.js
import os from "os";

// OSがWindows (win32) でない場合
if (os.platform() !== "win32") {
	console.log("---");
	console.log("Skipping pre-commit tests. This environment is not Windows.");
	// 正常終了コード 0 を返すことで、Husky/Git Hooksのコミット中断を防ぐっす。
	process.exit(0);
}
// Windowsの場合は続行（exit code 0 で終了せず、次のスクリプトへ処理を渡す）
