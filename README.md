# NodeJS Employee Data Generator

This project is a Node.js application designed to generate synthetic employee data and seed it into a MongoDB database. It leverages Google Generative AI for generating realistic employee records and LangChain for structured data parsing and embeddings.

## Features

- **Synthetic Data Generation**: Automatically generates realistic employee records with fields like personal details, job details, skills, performance reviews, and more.
- **MongoDB Integration**: Seeds the generated data into a MongoDB database for further use.
- **Google Generative AI**: Utilizes Google's Gemini model for generating data and embeddings.
- **Schema Validation**: Ensures data integrity using `zod` schemas.
- **Employee Summaries**: Creates concise summaries of employee data for reporting or display.

## Prerequisites

- Node.js (v16 or higher)
- MongoDB instance (local or cloud-based)
- Google Cloud API Key with access to Generative AI
