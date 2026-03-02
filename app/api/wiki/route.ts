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
            const blacklist = ['Chief', 'Executive', 'Officer', 'President', 'Secretary', 'Treasurer', 'Financial', 'Technology', 'Operating', 'Director', 'Board', 'Chairman', 'Name', 'Title', 'Age', 'Since', 'Year', 'Experience', 'Independent', 'Registered', 'Public', 'Counsel', 'General', 'Deputy', 'Assistant', 'Manager', 'Lead', 'Head', 'Associate', 'Senior', 'Junior', 'VP', 'EVP', 'SVP', 'AVP', 'Bank', 'Company', 'Corp', 'Inc', 'LLC', 'Ltd', 'Group', 'Partners', 'Capital', 'Management', 'Services', 'Systems', 'Global', 'National', 'International', 'Federal', 'State', 'City', 'County', 'Annual', 'Meeting', 'Report', 'Filing', 'Statement', 'Form', 'Schedule', 'Proxy', 'Notice', 'Shareholder', 'Stockholder', 'Investor', 'Audit', 'Compensation', 'Governance', 'Nominating', 'Committee', 'Trustee', 'Advisor', 'Consultant', 'Street', 'Avenue', 'Drive', 'Road', 'Lane', 'Way', 'Court', 'Circle', 'Suite', 'Floor', 'Level', 'Building', 'Plaza', 'Square', 'Center', 'Centre', 'Station', 'Park', 'West', 'East', 'North', 'South', 'Chicago', 'Phoenix', 'Arizona', 'Illinois', 'York', 'California', 'Texas', 'Florida', 'City', 'State', 'Zip', 'Phone', 'Email', 'Website', 'WWW', 'HTTP', 'HTTPS', 'COM', 'ORG', 'NET', 'EDU', 'GOV'];

            const bodyText = $('body').text();
            for (const targetTitle of titles) {
                if (!extractedExecutives.find(e => e.title === targetTitle)) {
                    let titleRegex = new RegExp(`${targetTitle}[^.]{1,120}`, 'i');
                    if (targetTitle === 'CEO') titleRegex = /Chief Executive Officer[^.]{1,120}/i;

                    const match = bodyText.match(titleRegex);
                    if (match) {
                        const potentialNames = match[0].match(/\b(?:Mc|Mac)?[A-Z][a-z]{1,20}(?:\s+(?:Mc|Mac)?[A-Z][a-z]{1,20}){1,2}\b/g) || [];
                        for (const nameCandidate of potentialNames) {
                            const words = nameCandidate.split(/\s+/);
                            const isBlacklisted = words.some(w => blacklist.some(b => w.toLowerCase() === b.toLowerCase()));
                            if (!isBlacklisted && words.length >= 2 && words.length <= 3) {
                                extractedExecutives.push({
                                    full_name: nameCandidate.trim(),
                                    title: targetTitle,
                                    source: "Wikipedia Body Search",
                                    confidence: 70
                                });
                                break;
                            }
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
