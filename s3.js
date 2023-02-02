// noinspection NpmUsedModulesInstalled
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import fetch from "node-fetch";
import dotenv from "dotenv";

(async () => {
    dotenv.config();

    // MONGODB CLIENT
    const DB_URI = process.env.DB_URI;
    const DB_NAME = process.env.DB_NAME;
    const mongoClient = new MongoClient(DB_URI, { useUnifiedTopology: true });

    // AWS S3 CLIENT
    const S3_REGION = process.env.S3_REGION;
    const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
    const AWS_KEY_ID = process.env.AWS_KEY_ID;
    const AWS_KEY_SECRET = process.env.AWS_KEY_SECRET;

    try {

        await mongoClient.connect();
        console.log("Connected to database @ " + DB_URI);

        const s3Client = new S3Client({
            region: S3_REGION,
            credentials:{
                accessKeyId: AWS_KEY_ID,
                secretAccessKey: AWS_KEY_SECRET
            }
        });
        console.log("Connected to S3 @ " + S3_REGION);

        const posts = mongoClient.db(DB_NAME).collection("wp_posts");

        for await(const post of posts.find({ "featured_media.source_url": { $not: { $regex: /https:\/\/affissioni.s3.eu-central-1.amazonaws.com.*/} } })) {

            if (!!post.featured_media?.source_url) {
                process.stdout.write(`Processing image '${post.featured_media?.source_url}' in S3`);

                try {
                    const fileStream = await fetch(post.featured_media?.source_url);
                    const fileName = Date.now() + "-" + post.featured_media?.source_url.substring(post.featured_media?.source_url.lastIndexOf('/') + 1);

                    await s3Client.send(new PutObjectCommand({
                        Bucket: S3_BUCKET_NAME,
                        // Add the required 'Key' parameter using the 'path' module.
                        Key: fileName,
                        // Add the required 'Body' parameter
                        Body: await fileStream.arrayBuffer(),
                        ContentType: fileStream.headers.get("content-type"),
                    }));

                    await posts.updateOne({_id: post._id}, {
                        $set: {
                            "featured_media.source_url": `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${fileName}`
                        }
                    });
                    process.stdout.write(" Done!\n");
                } catch (e) {
                    process.stderr.write(" Error!\n");
                }
            }
        }
    } finally {
        console.log("Closing connection with database");
        await mongoClient.close();
    }
})().catch(console.dir);