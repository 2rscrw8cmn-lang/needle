import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_ENV: "remote",
  },
});

child.on("error", (error) => {
  console.error(`Needle remote-data dev failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Needle remote-data dev exited from signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
