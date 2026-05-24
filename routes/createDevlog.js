import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export async function POST(req) {
  try {
    const { framework, devlogName } = await req.json();

    if (!devlogName) {
      return new Response(
        JSON.stringify({ success: false, message: "প্রজেক্টের নাম প্রয়োজন" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate unique container name
    const containerName = `devlog_${devlogName}_${Date.now()}`;

    // Server-side workspace folder
    const workspaceRoot = path.join(process.cwd(), "workspace");
    if (!fs.existsSync(workspaceRoot))
      fs.mkdirSync(workspaceRoot, { recursive: true });

    const devlogPath = path.join(workspaceRoot, devlogName);
    if (!fs.existsSync(devlogPath))
      fs.mkdirSync(devlogPath, { recursive: true });

    // Docker command to create container with mounted workspace
    let cmd = "";

    if (framework === "nextjs") {
      cmd = `
        docker run -d \
        --name ${containerName} \
        -v ${devlogPath}:/workspace \
        -w /workspace \
        node:20-alpine \
        sh -c "npx create-next-app@latest . --use-npm --yes && npm install"
      `;
    } else if (framework === "react") {
      cmd = `
        docker run -d \
        --name ${containerName} \
        -v ${devlogPath}:/workspace \
        -w /workspace \
        node:20-alpine \
        sh -c "npx create-react-app . && npm install"
      `;
    } else if (framework === "vue") {
      cmd = `
        docker run -d \
        --name ${containerName} \
        -v ${devlogPath}:/workspace \
        -w /workspace \
        node:20-alpine \
        sh -c "npm init vue@latest . --yes && npm install"
      `;
    } else {
      return new Response(
        JSON.stringify({ success: false, message: "Unknown framework" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Run Docker command
    await execAsync(cmd);

    // Success response
    return new Response(
      JSON.stringify({ success: true, containerName, devlogPath }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

