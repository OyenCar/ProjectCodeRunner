import React, { useState } from 'react';
import { Play, Loader2, Terminal, Code2, AlertCircle } from 'lucide-react';

const API_URL = "http://localhost:3000";

const App = () => {
  const [code, setCode] = useState("print('Hello, World!')");
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, running, completed, error
  const [executionTime, setExecutionTime] = useState(null);

  const pollStatus = async (jobId) => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/status?id=${jobId}`);
        const result = await response.json();

        if (result.status === "COMPLETED") {
          clearInterval(intervalId);
          setOutput(result.output);
          setExecutionTime(result.executionTime);
          setStatus("completed");
        } else if (result.status === "FAILED") {
          clearInterval(intervalId);
          setOutput(result.error);
          setStatus("error");
        }
      } catch (err) {
        clearInterval(intervalId);
        setStatus("error");
        setOutput("Failed to connect to server while checking status.");
      }
    }, 2000);
  };

  const runCode = async () => {
    setStatus("loading");
    setOutput("");
    setExecutionTime(null);

    try {
      const response = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("running");
        pollStatus(data.jobId);
      } else {
        setStatus("error");
        setOutput("Failed to submit code: " + data.message);
      }
    } catch (err) {
      setStatus("error");
      setOutput("Error connecting to backend server.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
      <header className="mb-8 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
          <Code2 size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Gemini Code Runner
        </h1>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-slate-800 p-4 rounded-t-xl border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Language:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-700 text-white text-sm rounded px-3 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="python">Python 3.9</option>
                <option value="javascript">Node.js 18</option>
                <option value="go">Go 1.20</option>
                <option value="cpp">C++ (GCC)</option>
              </select>
            </div>

            <button
              onClick={runCode}
              disabled={status === "loading" || status === "running"}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${status === "loading" || status === "running"
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                }`}
            >
              {status === "loading" || status === "running" ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processing
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" /> Run Code
                </>
              )}
            </button>
          </div>

          <div className="flex-1 relative group">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
              className="w-full h-full bg-slate-800 text-slate-100 font-mono text-sm p-6 rounded-b-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-600 leading-relaxed custom-scrollbar"
              placeholder="Write your code here..."
            />
            <div className="absolute top-2 right-4 text-xs text-slate-500 pointer-events-none">
              Editor Input
            </div>
          </div>
        </section>

        <section className="flex flex-col bg-black rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-400">Console Output</span>
            </div>
            {executionTime && (
              <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                Done in {executionTime}
              </span>
            )}
          </div>

          <div className="flex-1 p-6 font-mono text-sm overflow-auto">
            {status === "idle" && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                <Code2 size={48} className="opacity-20" />
                <p>Ready to run code...</p>
              </div>
            )}

            {(status === "loading" || status === "running") && (
              <div className="flex items-center gap-3 text-yellow-500">
                <Loader2 size={16} className="animate-spin" />
                <span>Running remote execution...</span>
              </div>
            )}

            {status === "completed" && (
              <pre className="text-slate-300 whitespace-pre-wrap">{output}</pre>
            )}

            {status === "error" && (
              <div className="flex items-start gap-3 text-red-400">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <pre className="whitespace-pre-wrap">{output || "Unknown error occurred."}</pre>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;