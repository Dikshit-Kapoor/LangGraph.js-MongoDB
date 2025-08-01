import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import "dotenv/config";

export async function callAgent(client, query, thread_id) {
    // Define the MongoDB database and collection
    const dbName = "hr_database";
    const db = client.db(dbName);
    const collection = db.collection("employees");
  
    // Define the graph state
    const GraphState = Annotation.Root({
      messages: Annotation({
        reducer: (x, y) => x.concat(y),
      }),
    });
  
    // Define the tools for the agent to use
    const employeeLookupTool = tool(
      async ({ query, n = 10 }) => {
        console.log("Employee lookup tool called");
  
        const dbConfig = {
          collection: collection,
          indexName: "vector_index",
          textKey: "embedding_text",
          embeddingKey: "embedding",
        };
  
        // Initialize vector store
        const vectorStore = new MongoDBAtlasVectorSearch(
          new GoogleGenerativeAIEmbeddings(),
          dbConfig
        );
  
        const result = await vectorStore.similaritySearchWithScore(query, n);
        return JSON.stringify(result);
      },
      {
        name: "employee_lookup",
        description: "Gathers employee details from the HR database",
        schema: z.object({
          query: z.string().describe("The search query"),
          n: z
            .number()
            .optional()
            .default(10)
            .describe("Number of results to return"),
        }),
      }
    );
  
    const tools = [employeeLookupTool];
    
    // We can extract the state typing via `GraphState.State`
    const toolNode = new ToolNode<typeof GraphState.State>(tools);
  
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: 'gemini-1.5-flash',
      temperature: 0.7,
    }).bindTools(tools);
  
    // Define the function that determines whether to continue or not
    function shouldContinue(state) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] ;
  
      // If the LLM makes a tool call, then we route to the "tools" node
      if (lastMessage.tool_calls?.length) {
        return "tools";
      }
      // Otherwise, we stop (reply to the user)
      return "__end__";
    }
  
    // Define the function that calls the model
    async function callModel(state) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are a helpful AI assistant, collaborating with other assistants. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
        ],
        new MessagesPlaceholder("messages"),
      ]);
  
      const formattedPrompt = await prompt.formatMessages({
        system_message: "You are helpful HR Chatbot Agent.",
        time: new Date().toISOString(),
        tool_names: tools.map((tool) => tool.name).join(", "),
        messages: state.messages,
      });
  
      const result = await model.invoke(formattedPrompt);
  
      return { messages: [result] };
    }
  
    // Define a new graph
    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");
  
    // Initialize the MongoDB memory to persist state between graph runs
    const checkpointer = new MongoDBSaver({ client, dbName });
  
    // This compiles it into a LangChain Runnable.
    // Note that we're passing the memory when compiling the graph
    const app = workflow.compile({ checkpointer });
  
    // Use the Runnable
    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      { recursionLimit: 15, configurable: { thread_id: thread_id } }
    );
  
    // console.log(JSON.stringify(finalState.messages, null, 2));
    console.log(finalState.messages[finalState.messages.length - 1].content);
  
    return finalState.messages[finalState.messages.length - 1].content;
  }