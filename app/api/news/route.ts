import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

async function fetchGoogleNewsRSS(query: string): Promise<string> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
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

        const extractedExecutives: any[] = [];

        // For each required title, query the latest News RSS
        for (const title of titles) {
            const articleXml = await fetchGoogleNewsRSS(`"${company}" "${title}"`);

            if (!articleXml) continue;

            const $ = cheerio.load(articleXml, { xmlMode: true });
            const items = $('item');

            let foundInNews = false;

            items.each((_, item) => {
                const articleTitle = $(item).find('title').text() || '';
                const articleDescription = $(item).find('description').text() || '';

                const combinedText = (articleTitle + " " + articleDescription).toLowerCase();
                const targetTitleLower = title.toLowerCase();

                // If article headline mentions "Company CEO..."
                if (combinedText.includes(company.toLowerCase()) &&
                    (combinedText.includes(` ${targetTitleLower} `) || combinedText.includes(` chief executive `))) {

                    // Complex NLP regex fallback: Attempting to grab "Title personName" or "personName, Title"
                    // We extract potential nouns before or after the title

                    // Simple heuristic: Take the words surrounding the title in the headline
                    const titleWordMatch = new RegExp(`([A-Z][a-z]+ [A-Z][a-z]+)\\s+(?:is|named)?\\s*${targetTitleLower}`, "i");
                    const titleWordMatchReverse = new RegExp(`${targetTitleLower}(?:,| -)?\\s+([A-Z][a-z]+ [A-Z][a-z]+)`, "i");

                    const matchA = articleTitle.match(titleWordMatch);
                    const matchB = articleTitle.match(titleWordMatchReverse);

                    let nameFound = null;
                    if (matchA && matchA[1] && !matchA[1].toLowerCase().includes("the")) {
                        nameFound = matchA[1];
                    } else if (matchB && matchB[1] && !matchB[1].toLowerCase().includes("the")) {
                        nameFound = matchB[1];
                    }

                    if (nameFound) {
                        extractedExecutives.push({
                            full_name: nameFound.trim(),
                            title: title,
                            source: "Global News RSS Parsing",
                            confidence: 85
                        });
                        foundInNews = true;
                        return false; // Break loop for this title once found
                    }
                }
            });
        }

        return NextResponse.json({ status: "success", data: extractedExecutives });

    } catch (error: any) {
        console.error("News API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to parse News" }, { status: 500 });
    }
}
