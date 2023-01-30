// noinspection NpmUsedModulesInstalled
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
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
    const COGNITO_COGNITO_IDENTITY_POOL_ID = process.env.COGNITO_IDENTITY_POOL_ID;
    const s3Client = new S3Client({
        region: S3_REGION,
        credentials: fromCognitoIdentityPool({
            client: new CognitoIdentityClient({ region: S3_REGION }),
            identityPoolId: COGNITO_COGNITO_IDENTITY_POOL_ID, // IDENTITY_POOL_ID
        })
    });

    try {
        await mongoClient.connect();
        console.log("Connected to database @ " + DB_URI);

        const posts = mongoClient.db(DB_NAME).collection("wp_posts");

        for await(const post of posts.find({id: 41127})) {

            if (!!post.featured_media?.source_url) {
                process.stdout.write(`Uploading image '${post.featured_media?.source_url}' in S3`);

                const fileStream = await fetch(post.featured_media?.source_url).then(response => response.blob());
                const uploadParams = {
                    Bucket: S3_BUCKET_NAME,
                    // Add the required 'Key' parameter using the 'path' module.
                    Key: "./",
                    // Add the required 'Body' parameter
                    Body: fileStream,
                };

                const data = await s3Client.send(new PutObjectCommand(uploadParams));
                console.log("Success", data);

                process.stdout.write(" Done!\n");
            }
        }
    } finally {
        console.log("Closing connection with database");
        await mongoClient.close();
    }
})().catch(console.dir);