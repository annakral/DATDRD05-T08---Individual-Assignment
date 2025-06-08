"""
cooking_assistant.py

This script serves as the core backend of the Cooking Assistant application, providing a hybrid AI chatbot 
to support beginner cooks. It integrates a local large language model (LLM) with a vector database and an 
online fallback to Google's Gemini API to generate helpful and friendly cooking advice.

Main Responsibilities:
- Load and run the Mistral 7B Instruct model locally using llama.cpp
- Generate sentence embeddings with SentenceTransformers for semantic search
- Search a vector database of cooking content for relevant context using FAISS
- Generate chatbot responses using the local model or fallback to Gemini when necessary
- Communicate with the Electron frontend by reading user queries from stdin and writing responses to stdout

Technologies used:
- Llama.cpp for running the Mistral LLM locally
- SentenceTransformers for efficient embedding generation
- FAISS for fast similarity search in the recipe knowledge base
- Google Generative AI (Gemini) for handling longer or complex queries
- Dotenv for secure API key management

This module is designed to be run as a background process, connected to the Electron.js frontend,
responding to user input with helpful cooking guidance.

Author: Anna Královcová
Date: 06/2025
"""

import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os
from llama_cpp import Llama
import google.generativeai as genai
from dotenv import load_dotenv
from vector_db import VectorDatabase

# Function to get the absolute path of a file relative to this script
def get_absolute_path(relative_path):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, relative_path)

# Build the full absolute path to the model
model_path = get_absolute_path("../models/mistral-7b-instruct-v0.1.Q4_K_M.gguf")

# Loading local LLM, embedding model, and vector database
try:
    # Loading local LLM (Mistral 7B Instruct)
    llm = Llama(model_path=model_path, n_ctx=2048, n_threads=8)
    llm_loaded = True
except Exception as e:
    print(f"Error loading Mistral model: {e}", file=sys.stderr)
    llm_loaded = False

try:
    # Embedding model
    embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    embed_loaded = True
except Exception as e:
    print(f"Error loading embedding model: {e}", file=sys.stderr)
    embed_loaded = False

try:
    # Vector DB
    db = VectorDatabase()
    db.load_index()
    db_loaded = True
except Exception as e:
    print(f"Error loading vector database: {e}", file=sys.stderr)
    db_loaded = False

# Set Google API key - from .env file
try:
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        gemini_loaded = True
    else:
        print("Google API key not found in environment", file=sys.stderr)
        gemini_loaded = False
except Exception as e:
    print(f"Error configuring Gemini: {e}", file=sys.stderr)
    gemini_loaded = False

# function for answering the query from user
def ask(question, k=5, max_tokens=256, use_fallback=True):
    # Check if components are loaded
    if not embed_loaded or not db_loaded:
        return {
            "answer": "I'm sorry, but my knowledge system is currently unavailable. Please try again later.",
            "source": "error"
        }
    
    try:
        # Embed query and search vector DB
        query_embedding = embed_model.encode(question)
        results = db.search(np.array(query_embedding), k=k)

        # Prepare context and prompt
        context = "\n\n".join([r["content"] for r in results])
        # Check if question is too long (more than 15 words)
        word_count = len(question.split())
        if word_count > 15:
            print(f"Question has {word_count} words, falling back to Gemini", file=sys.stderr)
            if gemini_loaded:
                gemini_answer = ask_gemini(question, context, max_tokens)
                return {
                    "answer": gemini_answer,
                    "source": "gemini"
                }
            else:
                return{
                    "answer": "Your question is quite long. Please try a shorter question or check your Gemini configuration.",
                    "source": "error"
                }
            
        prompt = f"""<s>[INST] You are a friendly cooking assistant helping someone
                    who may be a beginner cook. Always be encouraging, patient,
                    and explain cooking concepts in a simple, easy-to-understand way.
                    Use these relevant pieces of information (context below) to answer
                    the question:

        Context:
        {context}

        User's question: {question}
        [/INST]</s>
        """

        # Try local Mistral model if loaded
        if llm_loaded:
            try:
                response = llm(prompt, max_tokens=max_tokens, stop=["</s>"])
                answer = response["choices"][0]["text"].strip()

                # Check if the answer is empty or too vague
                if not answer or any(phrase in answer.lower() for phrase in [
                    "I don't know", 
                    "I don't have enough information",
                    "I cannot provide",
                    "I'm not sure",
                    "insufficient information"
                ]):
                    raise ValueError("Low confidence from local model.")
                
                return {
                    "answer": answer,
                    "source": "mistral"
                }
            except Exception as e:
                print(f"Mistral model error: {e}", file=sys.stderr)
                if not use_fallback:
                    raise e
        
        # Fall back to Gemini if enabled and available
        if use_fallback and gemini_loaded:
            gemini_answer = ask_gemini(question, context, max_tokens)
            return {
                "answer": gemini_answer,
                "source": "gemini"
            }
        else:
            return {
                "answer": "I'm sorry, I don't have enough information to answer that question.",
                "source": "error"
            }
    
    except Exception as e:
        print(f"Error in ask function: {e}", file=sys.stderr)
        return {
            "answer": "I'm sorry, there was an error processing your question. Please try again.",
            "source": "error"
        }
        
def ask_gemini(question, context, max_tokens=768):
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        full_prompt=f"""You are a friendly cooking assistant helping someone who may be a beginner cook. 
                    Always be encouraging, patient, and explain cooking concepts in a simple, easy-to-understand way.
                    Please provide a concise, friendly, and helpful answer.
                    Use these relevant pieces of information (context below) to answer the question:

        Context:
        {context}

        User's question: {question}

        Answer:"""
        
        response = model.generate_content(full_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Gemini error: {e}", file=sys.stderr)
        return "I'm sorry, I couldn't generate an answer at the moment. Please try again later."

# Main process for communication with Electron
def main():
    # Initial startup message
    startup_status = {
        "status": "ready",
        "components": {
            "mistral": llm_loaded,
            "embeddings": embed_loaded,
            "vectordb": db_loaded,
            "gemini": gemini_loaded
        }
    }
    print(json.dumps(startup_status), flush=True)
    
    # Keep reading from stdin and processing messages
    for line in sys.stdin:
        try:
            # Parse the JSON message
            message = json.loads(line)
            
            # Extract the question
            question = message.get('question', '')
            
            if question:
                # Process the query and get a response
                result = ask(question, max_tokens=512)
                
                # Send the response back to stdout as JSON
                print(json.dumps(result), flush=True)
            else:
                print(json.dumps({'error': 'No question provided'}), flush=True)
                
        except json.JSONDecodeError:
            print(json.dumps({'error': 'Invalid JSON'}), flush=True)
        except Exception as e:
            print(json.dumps({'error': str(e)}), flush=True)

if __name__ == "__main__":
    main()