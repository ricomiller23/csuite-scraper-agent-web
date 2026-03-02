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

                if (headerText.includes('key people')) {
                    const dataHtml = $(row).find('td').html() || '';
                    const peopleParts = dataHtml.split(/<br\s*\/?>/i);

                    peopleParts.forEach(part => {
                        const personText = cheerio.load(part).text().trim().replace(/\[\d+\]/g, '');
                        for (const targetTitle of titles) {
                            const normalizedPart = personText.toLowerCase();
                            const normalizedTarget = targetTitle.toLowerCase();

                            if (normalizedPart.includes(normalizedTarget) ||
                                (normalizedTarget === 'ceo' && normalizedPart.includes('chief executive officer'))) {

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

        // Fallback: Scan body for "Leadership" or "Management" section if no execs found for a title
        if (extractedExecutives.length < titles.length) {
            const bodyText = $('body').text();
            for (const targetTitle of titles) {
                // If this title isn't already found
                if (!extractedExecutives.find(e => e.title === targetTitle)) {
                    let titleRegex = new RegExp(`${targetTitle}[^.]{1,60}`, 'i');
                    if (targetTitle === 'CEO') titleRegex = /Chief Executive Officer[^.]{1,60}/i;

                    const match = bodyText.match(titleRegex);
                    if (match) {
                        const nameMatch = match[0].match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
                        if (nameMatch) {
                            extractedExecutives.push({
                                full_name: nameMatch[1],
                                title: targetTitle,
                                source: "Wikipedia Body Search",
                                confidence: 70
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: "success", data: extractedExecutives });

    } catch (error: any) {
        console.error("Wiki API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to parse Wikipedia" }, { status: 500 });
    }
}
