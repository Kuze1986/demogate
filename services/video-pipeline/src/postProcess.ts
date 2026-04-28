import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

export async function runFfmpegPostProcess(input: {
  rawVideoPath: string;
  narrationPath: string;
  outputPath: string;
}) {
  const hasNarration =
    existsSync(input.narrationPath) && statSync(input.narrationPath).size > 0;
  const args = hasNarration
    ? [
        "-i",
        input.rawVideoPath,
        "-i",
        input.narrationPath,
        "-vf",
        "drawtext=text='DemoForge':x=20:y=20:fontcolor=white:fontsize=20",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-shortest",
        input.outputPath,
        "-y",
      ]
    : [
        "-i",
        input.rawVideoPath,
        "-vf",
        "drawtext=text='DemoForge':x=20:y=20:fontcolor=white:fontsize=20",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-an",
        input.outputPath,
        "-y",
      ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with exit code ${code ?? -1}`));
    });
    proc.on("error", reject);
  });
}
