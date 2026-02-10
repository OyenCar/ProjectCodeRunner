const express = require("express");
const cors = require("cors");
const Queue = require("bull");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure temp directory exists
const TEMP_DIR = path.join(__dirname, "temp");
fs.ensureDirSync(TEMP_DIR);

// Setup Bull Queue
// Connects to local Redis at default port 6379
const jobQueue = new Queue("jobQueue", {
    redis: { port: 6379, host: "127.0.0.1" },
});

// Worker Logic
jobQueue.process(async (job) => {
    const { language, code } = job.data;
    const jobId = job.id;
    const fileName = `${jobId}.${getExtension(language)}`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
        // Write code to temp file
        await fs.writeFile(filePath, code);

        // Construct Docker command
        const dockerCommand = getDockerCommand(language, fileName);

        // Execute
        const result = await executeCommand(dockerCommand);

        // Cleanup
        await fs.remove(filePath);

        return result; // { output, executionTime }
    } catch (error) {
        // Cleanup on error
        await fs.remove(filePath).catch(() => { });
        throw new Error(error.message || "Execution failed");
    }
});

// Helper: Get file extension
function getExtension(language) {
    switch (language) {
        case "python": return "py";
        case "javascript": return "js";
        case "cpp": return "cpp";
        case "go": return "go";
        default: return "txt";
    }
}

// Helper: Get Docker command
function getDockerCommand(language, fileName) {
    const image = {
        python: "python:3.9-slim",
        javascript: "node:18-alpine",
        cpp: "gcc:latest",
        go: "golang:1.20-alpine",
    }[language];

    // Commands to run inside the container
    const runCmd = {
        python: `python /app/${fileName}`,
        javascript: `node /app/${fileName}`,
        cpp: `g++ -o /app/out /app/${fileName} && /app/out`,
        go: `go run /app/${fileName}`,
    }[language];

    if (!image || !runCmd) throw new Error("Unsupported language");

    // Security limits:
    // --network none: No internet access
    // --memory 128m: Limit RAM
    // --cpus 0.5: Limit CPU
    // -v: Mount temp dir to /app
    // --rm: Remove container after run
    return `docker run --rm --network none --memory 128m --cpus 0.5 -v "${TEMP_DIR}:/app" ${image} sh -c "${runCmd.replace(/"/g, '\\"')}"`;
}

// Helper: Execute Shell Command with Timeout
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
            const end = Date.now();
            const executionTime = `${((end - start) / 1000).toFixed(2)}s`;

            if (error && error.killed) {
                return reject(new Error("Time Limit Exceeded (10s)"));
            }
            if (error) {
                // Return stderr as error message if execution failed
                return reject(new Error(stderr || error.message));
            }

            resolve({
                output: stdout + (stderr ? `\n[Stderr]\n${stderr}` : ""),
                executionTime
            });
        });
    });
}

// API Endpoints

// POST /run
app.post("/run", async (req, res) => {
    const { language, code } = req.body;

    if (!language || !code) {
        return res.status(400).json({ message: "Language and code are required" });
    }

    try {
        const job = await jobQueue.add({ language, code });
        res.json({ jobId: job.id, status: "queued" });
    } catch (err) {
        res.status(500).json({ message: "Failed to add job to queue" });
    }
});

// GET /status?id=...
app.get("/status", async (req, res) => {
    const jobId = req.query.id;
    if (!jobId) return res.status(400).json({ message: "Job ID required" });

    try {
        const job = await jobQueue.getJob(jobId);
        if (!job) return res.status(404).json({ message: "Job not found" });

        const state = await job.getState(); // completed, failed, active, waiting...
        const result = job.returnvalue;
        const reason = job.failedReason;

        // Map Bull states to our API format
        let status = "PENDING";
        if (state === "completed") status = "COMPLETED";
        else if (state === "failed") status = "FAILED";
        else if (state === "active") status = "RUNNING";

        res.json({
            jobId,
            status,
            output: result ? result.output : null,
            executionTime: result ? result.executionTime : null,
            error: reason || null,
        });
    } catch (err) {
        res.status(500).json({ message: "Error retrieving job status" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Redis Queue connected`);
});
