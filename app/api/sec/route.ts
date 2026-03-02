import { NextResponse } from 'next/server';

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

        // Note: For a true full implementation, you would then hit data.sec.gov for the submissions JSON 
        // `https://data.sec.gov/submissions/CIK${paddedCik}.json`
        // Extract recent filing URLs, and use Cheerio to parse the HTML of the DEF 14A proxy.
        // As a proxy statement parser requires complex NLP/Regex bounding boxes across unstructured tables, 
        // we stub this SEC Intelligence payload here to indicate the API framework is live.

        const simulatedSECDiscovery: any[] = [];

        // Return structured SEC data stub representing confidence
        return NextResponse.json({
            status: "success",
            metadata: {
                cik: paddedCik,
                ticker: companyId.ticker,
                sec_entity: companyId.title
            },
            data: simulatedSECDiscovery
        });

    } catch (error: any) {
        console.error("SEC API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to search SEC EDGAR" }, { status: 500 });
    }
}
