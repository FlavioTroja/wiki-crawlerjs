// noinspection NpmUsedModulesInstalled
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

(async () => {
    dotenv.config();

    const DB_URI = process.env.DB_URI;
    const DB_NAME = process.env.DB_NAME;

    const client = new MongoClient(DB_URI, { useUnifiedTopology: true });

    try {
        await client.connect();
        console.log("Connected to database @ " + DB_URI);

        const posts = client.db(DB_NAME).collection("wp_posts");
        const categories = client.db(DB_NAME).collection("wp_categories");
        for await(const post of posts.find({})) {
            for (const catId of post.categories) {
                const category = await categories.findOne({ id: catId }).catch(() => null);
                process.stdout.write(`Aggregating post '${post.id}' with category '${category?.name}'`);
                delete category._id;
                delete category._links;
                await posts.updateOne({ _id: post._id }, {
                    $set: {
                        "categories.$[element]": category
                    }
                },
                { arrayFilters: [{ element: catId }]});
                process.stdout.write(" Done!\n");
            }

        }
    } finally {
        console.log("Closing connection with database");
        await client.close();
    }
})().catch(console.dir);