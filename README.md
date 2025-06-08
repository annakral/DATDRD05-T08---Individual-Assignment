# DATDRD05-T08---Individual-Assignment
This repository contains files for Individual Assignment, part of minor Data Driven Decision Making in Business.

Project Structure:

.

├── cooking_app/ # Electron app with Python backend


├── local_llm_development/ # Jupyter notebook for building the LLM and original datasets

├── models/ # Link to the Mistral model

└── README.md

---

## Cooking Assistant App with Local LLM
A smart desktop cooking assistant that helps users manage recipes and ask cooking-related questions. Built with **Electron.js** and **Python**, powered by a **local language model (LLM)** with optional fallback to **Google Gemini**. Works offline with vector-based retrieval from a recipe dataset. 

Installation and usage guide can be found in the documentation (Appendix A). 

---
## Local LLM Development (and Gemini Fallback)
The local_llm_development/ folder includes a jupyter notebook with the whole process of building the RAG system for the local LLM and Gemini fallback. It follows the CRIPS-DM process:

- Data Understaning: Loading and cleaning datasets with cooking knowledge and recipes.

- Data Preparation: Converting the format into structured JSON. Generating embeddings.

- Vector Search: Using FAISS to build a local vector database.

- Query Handling (Modeling): Answer questions using local LLMs or Gemini fallback.

- Testing: Manual evaluation and prompt engineering

- Deployment: The model and RAG system is used in the application. The application is still in the development process and cannot be deployed yet.

---
## Models Folder
The local model (Mistral 7B Instruct) was too large to upload directly into GitHub, so in this folder a file with a link to download it can be found.
