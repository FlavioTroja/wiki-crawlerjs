// noinspection NpmUsedModulesInstalled
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { load } from "cheerio";

const thumbToImage = (img) => {
    try {
        img = img.replace("thumb/", "");
        return img.substring(0, img.lastIndexOf("/"));
    } catch (e) {
        return img;
    }
}

(async () => {
    dotenv.config();

    const DB_URI = process.env.DB_URI;
    const DB_NAME = process.env.DB_NAME;

    const client = new MongoClient(DB_URI, { useUnifiedTopology: true });

    try {
        await client.connect();
        console.log("Connected to database @ " + DB_URI);

        const cities = client.db(DB_NAME).collection("cities");

        for await(const city of cities.find({})) {
            const url = city.wiki?.url ? city.wiki.url : `https://it.wikipedia.org/wiki/${city.name.replaceAll(" ", "_")}`;
            process.stdout.write(`Crawling city '${city.name}' by ${url}`);
            const response = await fetch(url);
            const body = await response.text();
            const $ = load(body);
            const list = [];
            const children = [ ...$(".mw-parser-output").children() ];
            const index = children.findIndex(c => c.attribs.class === "toc");
            const range = children.slice(0, index).filter(e => e.name === "p");
            const description = range.map(p => $(p).text()
                .replace(/\([^()]*\)/g, "")
                .replace(/\([^()]*\)/g, "")
                .replace(/\[.*?\]/g, "")
                .replaceAll("  ", " ")).join(" ");

            const images = $("img");
            let pics = [];
            for (const image of images) {
                if ($(image).attr('width') > 100 && $(image).attr('src')?.toLowerCase()?.endsWith(".jpg")) {
                    pics.push(thumbToImage(`https:${$(image).attr('src')}`));
                }
            }
            const coordinates = $("span.geo")?.html()?.split(";")?.map( Number );
            const flag= thumbToImage(`https:${$("td.sinottico_testo_centrale > div > div > span > a.mw-file-description > img")?.first()?.attr("src")}`);
            const website = $('span:contains("Sito ufficiale")').parents().attr('href')?.replace("http:", "https:");
            await cities.updateOne({ _id: city._id }, {
                $set: {
                    wiki: {
                        url,
                        description,
                        flag,
                        pics
                    },
                    website,
                    location: {
                        type: "Point",
                        coordinates
                    }
                }
            }, { w: 1 });
            process.stdout.write(" Done!\n");
        }
    } finally {
        console.log("Closing connection with database");
        await client.close();
    }
})().catch(console.dir);