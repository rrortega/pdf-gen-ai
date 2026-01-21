import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    const domain = process.env.NEXT_PUBLIC_DOMAIN || "https://pdfgen.ai";

    return [
        {
            url: domain,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${domain}/auth/login`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${domain}/auth/register`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
    ];
}
