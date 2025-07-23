import { MongoClient } from "mongodb";
import express from "express";
import { callAgent } from "./agent";
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
        res.send("LangGraph Server is running");
    })
    app.post("",async(req,res)=>{
        const initialMessage = req.body.message;
        const threadId = Date.now().toString(); //Simple Thread ID generation
        try{
            const response=await callAgent(client, initialMessage, threadId);
            res.json({
                threadId: threadId,
                response: response
            });
        }
        catch{
            res.status(500).send("Error processing the request");
        }
    })
        // API endpoint to send a message in an existing conversation
    // curl -X POST -H "Content-Type: application/json" -d '{"message": "What team members did you recommend?"}' http://localhost:3000/chat/123456789
    app.post('/chat/:threadId', async (req, res) => {
        const { threadId } = req.params;
        const { message } = req.body;
        try {
          const response = await callAgent(client, message, threadId);
          res.json({ response });
        } catch (error) {
          console.error('Error in chat:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    const PORT=process.env.port || 3000;    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startserver();