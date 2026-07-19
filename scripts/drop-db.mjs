import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexusdesk";
await mongoose.connect(uri);
const name = mongoose.connection.db.databaseName;
await mongoose.connection.dropDatabase();
console.log(`Dropped database: ${name}`);
await mongoose.disconnect();
