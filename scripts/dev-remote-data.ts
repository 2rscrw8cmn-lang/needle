import { spawn } from "node:child_process";

const env = {
  ...process.env,
  CLOUDFLARE_ENV: "remote",
};

const child =
  process.platform === "win32"
    ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run dev"], {
        stdio: "inherit",
        env,
      })
    : spawn("npm", ["run", "dev"], {
        stdio: "inherit",
        env,
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
