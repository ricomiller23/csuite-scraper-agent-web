import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

async function safeGoogleSearch(query: string): Promise<string> {
    try {
        const url = `https://www.google.com/search?q=${query}&hl=en`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            next: { revalidate: 3600 }
        });
        if (!res.ok) return '';
        return await res.text();
    } catch (e) {
        console.error(`Failed to fetch Google Search:`, e);
        return '';
    }
}

async function safeGet(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            next: { revalidate: 3600 }
        });
        if (!res.ok) return '';
        return await res.text();
    } catch (e) {
        console.error(`Failed to fetch ${url}:`, e);
        return '';
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { target_url, action } = body;

        let content = '';

        if (action === "google") {
            content = await safeGoogleSearch(target_url);
        } else {
            content = await safeGet(target_url);
        }

        return NextResponse.json({ status: "success", data: content });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to execute proxy proxy" }, { status: 500 });
    }
}
