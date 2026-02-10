const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    try {
        console.log("1. Submitting Job...");
        const runRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/run',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            language: 'python',
            code: 'print("Hello from Backend Test")'
        });

        console.log("Job Submitted:", runRes);
        const jobId = runRes.jobId;
        if (!jobId) throw new Error("No Job ID returned");

        console.log("2. Polling Status...");
        let status = "PENDING";
        while (status !== "COMPLETED" && status !== "FAILED") {
            await new Promise(r => setTimeout(r, 1000));
            const statusRes = await request({
                hostname: 'localhost',
                port: 3000,
                path: `/status?id=${jobId}`,
                method: 'GET'
            });
            console.log("Status:", statusRes.status);
            status = statusRes.status;
            if (status === "COMPLETED") {
                console.log("Output:", statusRes.output);
                if (statusRes.output.trim() !== "Hello from Backend Test") {
                    throw new Error("Output mismatch");
                }
            }
        }
        console.log("Test Passed!");
    } catch (err) {
        console.error("Test Failed:", err);
        process.exit(1);
    }
}

test();
