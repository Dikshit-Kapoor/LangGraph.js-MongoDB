import { MongoClient } from "mongodb";
import express from "express";
const app = express();
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function startserver(){
    await client.connect()
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));
    await client.db("Cluster1").command({ ping: 1 })
    console.log("MongoDB ping successful");
    app.get("/",(req,res)=>{
        res.send("LangGraph API is running");
    })
    const PORT=process.env.port || 3000;    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startserver();