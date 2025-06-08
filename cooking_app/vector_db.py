"""
vector_db.py

This file defines the VectorDatabase class, which manages semantic search functionality for the Cooking Assistant application.
It handles the creation, saving, loading, and querying of a FAISS vector index built from recipe embeddings.

Main Responsibilities:
- Load pre-computed sentence embeddings for cooking-related data
- Build and store a FAISS index for efficient similarity search
- Load metadata and recipe content for retrieval
- Perform vector similarity search to return relevant content based on user queries

Technologies used:
- FAISS (Facebook AI Similarity Search) for high-speed vector search using L2 distance
- NumPy for handling dense embedding arrays
- JSON for storing and accessing recipe metadata and text
- OS utilities for cross-platform file path handling

Author: Anna Královcová
Date: 06/2025
"""


import json
import numpy as np
import faiss
import os

# Making a class that can be called later
class VectorDatabase:

    # Function to get the absolute path of a file relative to this script
    def get_absolute_path(relative_path):
       base_dir = os.path.dirname(os.path.abspath(__file__))
       return os.path.join(base_dir, relative_path)
    
    index_path = get_absolute_path('data/faiss_index')

    def __init__(self, index_path=index_path):
        self.index_path = index_path
        self.index = None
        self.ids = []
        self.combined_data = []
    
    # Building a FAISS index from the embeddings
    def build_index(self, embeddings_path=get_absolute_path('embeddings/embeddings_array.npy'), 
                   ids_path=get_absolute_path('embeddings/ids.json'),
                   data_path=get_absolute_path('data/sample_combined_data.json')):
    
        # Loading data
        print("Loading embeddings...")
        embeddings = np.load(embeddings_path)

        with open(ids_path, 'r') as f:
            self.ids = json.load(f)
        with open(data_path, 'r') as f:
            self.combined_data = json.load(f)
        
        # Directory for the index if it doesn't exist
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        
        # Create and add to FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)  # simple L2 distance index
        self.index.add(embeddings)  # add vectors to the index
        
        # Save the index
        faiss.write_index(self.index, f"{self.index_path}.idx")
        
        # Save the IDs and data paths for later loading
        with open(f"{self.index_path}_metadata.json", 'w') as f:
            json.dump({
                'ids_path': ids_path,
                'data_path': data_path
            }, f)
        
        print(f"Built FAISS index with {self.index.ntotal} vectors")
        return self.index
    
    # Load a previously built FAISS index
    def load_index(self):
        
        # Load saved index and metadata
        self.index = faiss.read_index(f"{self.index_path}.idx")

        with open(f"{self.index_path}_metadata.json", 'r') as f:
            metadata = json.load(f)
        with open(metadata['ids_path'], 'r') as f:
            self.ids = json.load(f)
        
        # Load sample of combined data
        with open(metadata['data_path'], 'r') as f:
            self.combined_data = json.load(f)
        
        print(f"Loaded FAISS index with {self.index.ntotal} vectors")
        return self.index
    
    # Function for searching the index for similar vectors
    def search(self, query_embedding, k=5):

        if self.index is None:
            self.load_index()
        
        # Make sure the query embedding is in the right shape
        if len(query_embedding.shape) == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # Search the index
        distances, indices = self.index.search(query_embedding, k)
        
        # Get the corresponding data
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.ids):  # Ensure index is valid
                item_id = self.ids[idx]
                
                # Find the corresponding item in combined_data
                item_data = next((item for item in self.combined_data if item['id'] == item_id), None)
                
                if item_data:
                    results.append({
                        'id': item_id,
                        'distance': float(distances[0][i]),
                        'content': item_data['content'],
                        'metadata': item_data['metadata']
                    })
        
        return results

if __name__ == "__main__":
    # Initialize the vector database
    vector_db = VectorDatabase()
    
    # Build the index
    vector_db.build_index()
    
    print("Vector database setup complete!")