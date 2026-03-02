import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

async function fetchSECTicker(companyName: string) {
    try {
        const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
            headers: { 'User-Agent': 'CSuiteIntelligenceScraper/1.0 (Contact: researcher@example.com)' },
            next: { revalidate: 86400 } // Cache 24 hrs
        });

        if (!res.ok) return null;

        const data = await res.json();
        const searchName = companyName.toLowerCase().split(' ')[0]; // E.g., "Apple Inc" -> "apple"

        for (const key in data) {
            const entry = data[key];
            if (entry.title && entry.title.toLowerCase().includes(searchName)) {
                return {
                    cik_str: entry.cik_str,
                    ticker: entry.ticker,
                    title: entry.title
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        let { company, titles } = body;

        // 1. Find the CIK (Central Index Key) for the public company
        const companyId = await fetchSECTicker(company);

        if (!companyId) {
            // Not a public company or SEC format differs
            return NextResponse.json({ status: "skipped", data: [], message: `No SEC CIK found for ${company}` });
        }

        // Pad CIK to 10 digits
        const paddedCik = companyId.cik_str.toString().padStart(10, '0');

        // 2. Fetch submissions JSON
        const submissionsRes = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
            headers: { 'User-Agent': 'CSuiteIntelligenceScraper/1.0 (Contact: researcher@example.com)' }
        });

        if (!submissionsRes.ok) {
            return NextResponse.json({ status: "error", message: "SEC Submissions API failed" });
        }

        const subData = await submissionsRes.json();
        const filings = subData.filings?.recent;

        const extractedExecutives: any[] = [];

        if (filings) {
            // Find index of lateast DEF 14A (Proxy Statement)
            const proxyIndex = filings.form.findIndex((f: string) => f === 'DEF 14A');

            if (proxyIndex !== -1) {
                const accessionNumber = filings.accessionNumber[proxyIndex].replace(/-/g, '');
                const primaryDocument = filings.primaryDocument[proxyIndex];
                const filingUrl = `https://www.sec.gov/Archives/edgar/data/${companyId.cik_str}/${accessionNumber}/${primaryDocument}`;

                // Fetch the filing HTML
                const filingRes = await fetch(filingUrl, {
                    headers: { 'User-Agent': 'CSuiteIntelligenceScraper/1.0 (Contact: researcher@example.com)' }
                });

                if (filingRes.ok) {
                    const filingHtml = await filingRes.text();
                    const $ = cheerio.load(filingHtml);
                    const bodyText = $('body').text();

                    // Search for titles in the text and try to extract names
                    const blacklist = ['Chief', 'Executive', 'Officer', 'President', 'Secretary', 'Treasurer', 'Financial', 'Technology', 'Operating', 'Director', 'Board', 'Chairman', 'Name', 'Title', 'Age', 'Since', 'Year', 'Experience', 'Independent', 'Registered', 'Public'];

                    for (const title of titles) {
                        let titleRegex = new RegExp(`${title}[^.]{1,120}`, 'i');
                        if (title === 'CEO') titleRegex = /Chief Executive Officer[^.]{1,120}/i;

                        const match = bodyText.match(titleRegex);
                        if (match) {
                            const potentialNames = match[0].match(/[A-Z][a-zA-Z'\-]{2,}(?:\s+[A-Z][a-zA-Z'\-]{2,})+/g) || [];
                            for (const nameCandidate of potentialNames) {
                                const words = nameCandidate.split(/\s+/);
                                const isBlacklisted = words.some(w => blacklist.some(b => w.toLowerCase().includes(b.toLowerCase())));
                                if (!isBlacklisted && words.length >= 2 && words.length <= 4) {
                                    extractedExecutives.push({
                                        full_name: nameCandidate.trim(),
                                        title: title,
                                        source: "SEC EDGAR DEF 14A",
                                        confidence: 95
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            status: "success",
            metadata: {
                cik: paddedCik,
                ticker: companyId.ticker,
                sec_entity: companyId.title
            },
            data: extractedExecutives
        });

    } catch (error: any) {
        console.error("SEC API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to search SEC EDGAR" }, { status: 500 });
    }
}
