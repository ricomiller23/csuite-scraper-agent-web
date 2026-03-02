import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

async function fetchWikiPageHTML(companyName: string): Promise<string> {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(companyName.replace(/ /g, '_'))}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'CSuiteIntelligenceScraper/1.0 (Contact: researcher@example.com)' },
            next: { revalidate: 3600 }
        });
        if (!response.ok) return '';
        return await response.text();
    } catch (e) {
        return '';
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        let { company, titles } = body;

        // Fetch Wiki Article
        let html = await fetchWikiPageHTML(company);

        // Sometimes company names need "_(company)" on Wiki
        if (!html) {
            html = await fetchWikiPageHTML(`${company}_(company)`);
        }

        if (!html) {
            return NextResponse.json({ status: "success", data: [] });
        }

        const $ = cheerio.load(html);
        const infobox = $('.infobox.vcard');

        const extractedExecutives: any[] = [];

        if (infobox.length) {
            infobox.find('tr').each((i, row) => {
                const headerText = $(row).find('th').text().toLowerCase();

                // Wiki Infobox "Key people" section
                if (headerText.includes('key people')) {
                    const dataHtml = $(row).find('td').html() || '';

                    // Split the HTML using <br> since Wiki separates Key People like "Tim Cook (CEO)<br>Luca Maestri (CFO)"
                    const peopleParts = dataHtml.split(/<br\s*\/?>/i);

                    peopleParts.forEach(part => {
                        const personText = cheerio.load(part).text().trim().replace(/\[\d+\]/g, ''); // Strip citation tags [1]

                        // Parse format: "Person Name, Title" or "Person Name (Title)"
                        for (const targetTitle of titles) {
                            // Check if target title exists in this string line
                            const normalizedPart = personText.toLowerCase();
                            const normalizedTarget = targetTitle.toLowerCase();

                            // e.g. "Tim Cook, CEO"
                            if (normalizedPart.includes(normalizedTarget) ||
                                (normalizedTarget === 'ceo' && normalizedPart.includes('chief executive officer'))) {

                                // Best effort extraction: Split by comma or parenthesis
                                let name = personText;
                                if (personText.includes(',')) {
                                    name = personText.split(',')[0].trim();
                                } else if (personText.includes('(')) {
                                    name = personText.split('(')[0].trim();
                                }

                                extractedExecutives.push({
                                    full_name: name,
                                    title: targetTitle,
                                    source: "Wikipedia Infobox API",
                                    confidence: 90
                                });
                            }
                        }
                    });
                }
            });
        }

        return NextResponse.json({ status: "success", data: extractedExecutives });

    } catch (error: any) {
        console.error("Wiki API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to parse Wikipedia" }, { status: 500 });
    }
}
