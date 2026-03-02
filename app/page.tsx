"use client";
import React, { useState } from "react";

export default function Home() {
  const [companies, setCompanies] = useState("");
  const [titles, setTitles] = useState("CEO, CFO, CTO, CMO, COO");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!companies.trim()) {
      setError("Please enter at least one company name.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);

    const companyList = companies.split(",").map((c) => c.trim()).filter((c) => c);
    const titleList = titles.split(",").map((t) => t.trim()).filter((t) => t);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companies: companyList, titles: titleList }),
      });

      if (!res.ok) {
        throw new Error("Failed to run scraper via API.");
      }

      const data = await res.json();
      setResults(data.data);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-start p-8 font-sans">
      <div className="w-full max-w-4xl flex flex-col items-center mt-12 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            C-Suite Intelligence Agent
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Autonomous waterfall research methodology. Discovers verified emails and phone numbers for top executives.
          </p>
        </div>

        <div className="w-full bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">Target Companies (comma-separated)</label>
            <input
              type="text"
              value={companies}
              onChange={(e) => setCompanies(e.target.value)}
              placeholder="e.g. OpenAI, Anthropic, Vercel"
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">Target Titles (comma-separated)</label>
            <input
              type="text"
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              placeholder="e.g. CEO, CFO, CTO"
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <button
            onClick={handleScrape}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg ${loading
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white hover:shadow-emerald-500/20"
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Executing Waterfall Layers...</span>
              </span>
            ) : (
              "Deploy Research Agent"
            )}
          </button>

          {error && <div className="text-red-400 text-sm font-semibold text-center mt-4">{error}</div>}
        </div>

        {results && (
          <div className="w-full space-y-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-2">Intelligence Report</h2>
            {results.map((companyData: any, i: number) => (
              <div key={i} className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="bg-[#1a1a1a] px-6 py-4 flex justify-between items-center border-b border-gray-800">
                  <h3 className="text-xl font-bold text-blue-400">{companyData.company}</h3>
                  <div className="text-sm text-gray-400 font-mono flex items-center space-x-4">
                    <span>Domain: <span className="text-white">{companyData.domain}</span></span>
                    <span>Pattern: <span className="text-white">{companyData.email_pattern}</span></span>
                  </div>
                </div>
                <div className="divide-y divide-gray-800">
                  {companyData.executives.map((exec: any, j: number) => (
                    <div key={j} className="p-6 hover:bg-[#151515] transition-colors flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 text-sm">
                      <div className="space-y-1">
                        <div className="font-bold text-lg text-white">{exec.full_name}</div>
                        <div className="text-emerald-400 font-medium">{exec.title}</div>
                        <div className="text-gray-500">
                          <a href={exec.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-blue-400 underline">LinkedIn</a>
                        </div>
                      </div>

                      <div className="space-y-1 w-full md:w-1/3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Email:</span>
                          <span className="text-white font-mono">{exec.email.address}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">HQ Phone:</span>
                          <span className="text-white font-mono">{exec.phone.number || "Unlisted"}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full font-semibold text-xs border border-gray-700">
                          Score: {exec.data_quality_score}/100
                        </span>
                        {exec.data_quality_score > 50 ? (
                          <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                        ) : (
                          <span className="h-3 w-3 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
