import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import { CopyPluginOptions } from "./esbuild.config.mts";

export const copyPlugin = ({ opts }: CopyPluginOptions): esbuild.Plugin => ({
	name: "copy-plugin",
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length > 0) {
				console.warn("[CopyPlugin] Build failed. Skipping file copy.");
				return;
			}

			console.log("[CopyPlugin] Starting file copy process...");

			for (const { src, dest } of opts) {
				if (!dest) {
					console.error(`[CopyPlugin] Destination path is required.`);
					continue;
				}

				try {
					// 1. まず、コピー先のディレクトリ（dest）が存在するか確認し、なければ再帰的に作成する
					await fs.mkdir(dest, { recursive: true });

					for (const srcPath of src) {
						// 2. 堅牢な方法でファイル名を取得する
						const fileName = path.basename(srcPath);
						const destPath = path.join(dest, fileName);

						try {
							// 3. ソースファイルが存在するか確認
							await fs.access(srcPath);

							// 4. ファイルをコピーする
							await fs.copyFile(srcPath, destPath);
							console.log(
								`[CopyPlugin] Copied: ${srcPath} -> ${destPath}`
							);
						} catch (e) {
							if (
								e instanceof Error &&
								"code" in e &&
								e.code === "ENOENT"
							) {
								console.warn(
									`[CopyPlugin] Warning: Source file not found: ${srcPath}. Skipping.`
								);
							} else {
								console.error(
									`[CopyPlugin] Failed to copy ${srcPath}:`,
									e
								);
							}
						}
					}
				} catch (e) {
					// 主にfs.mkdirが失敗した場合などの致命的なエラーをキャッチ
					console.error(
						`[CopyPlugin] Failed processing destination group for '${dest}':`,
						e
					);
				}
			}
			console.log("[CopyPlugin] File copy process finished.");
		});
	},
});
