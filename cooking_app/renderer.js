/**
 * renderer.js
 * 
 * Handles the UI interactions for the cooking assistant app:
 * - Manages chat modal and messaging with the Python backend via IPC
 * - Provides fallback cooking tips if AI response fails
 * - Manages recipe operations with localStorage persistence
 * - Controls display logic for chat, recipes, and recipe form
 * 
 * Author: Anna Královcová
 * Date: 06/2025
 */


// DOM Elements
const cat = document.getElementById('cat');
const cookbook = document.getElementById('cookbook');
const chatModal = document.getElementById('chat-modal');
const recipesModal = document.getElementById('recipes-modal');
const recipeFormModal = document.getElementById('recipe-form-modal');
const closeChat = document.getElementById('close-chat');
const closeRecipes = document.getElementById('close-recipes');
const closeRecipeForm = document.getElementById('close-recipe-form');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message');
const addRecipeBtn = document.getElementById('add-recipe');
const recipeList = document.getElementById('recipe-list');
const recipeForm = document.getElementById('recipe-form');
const recipeFormTitle = document.getElementById('recipe-form-title');

const { ipcRenderer } = require('electron');

// Recipe Storage
let recipes = JSON.parse(localStorage.getItem('recipes') || '[]');
let chatInitialized = false;

// Open chat modal when clicking on the cat
cat.addEventListener('click', () => {
    chatModal.style.display = 'block';
    
    // Add welcome message when opening chat
      if (!chatInitialized) {
        addMessageToChat("Hello! I'm your cooking assistant. How can I help you in the kitchen today?", 'bot');
        chatInitialized = true;
    }
});

// Open recipes modal when clicking on the cookbook
cookbook.addEventListener('click', () => {
    recipesModal.style.display = 'block';
    displayRecipes();
});

// Close modals
closeChat.addEventListener('click', () => {
    chatModal.style.display = 'none';
});

closeRecipes.addEventListener('click', () => {
    recipesModal.style.display = 'none';
});

closeRecipeForm.addEventListener('click', () => {
    recipeFormModal.style.display = 'none';
});

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === chatModal) {
        chatModal.style.display = 'none';
    }
    if (event.target === recipesModal) {
        recipesModal.style.display = 'none';
    }
    if (event.target === recipeFormModal) {
        recipeFormModal.style.display = 'none';
    }
});

// Send message in chat
sendMessageBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const message = chatInput.value.trim();
    if (message === '') return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    chatInput.value = '';

    // Show loading indicator
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('message', 'bot-message', 'loading');
    loadingElement.textContent = "Thinking...";
    chatMessages.appendChild(loadingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // First try the AI backend
        const response = await ipcRenderer.invoke('ask-cooking-question', message);
        
        // Remove loading indicator
        chatMessages.removeChild(loadingElement);
        
        // Add bot response to chat
        addMessageToChat(response.answer, 'bot');
    } catch (error) {
        // If the AI backend fails, fall back to the simple response function
        console.error('Error getting AI response:', error);
        
        // Remove loading indicator
        chatMessages.removeChild(loadingElement);
        
        // Fall back to simple responses
        const fallbackResponse = getCookingResponse(message);
        addMessageToChat(fallbackResponse, 'bot');
    }
}

function addMessageToChat(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    messageElement.textContent = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Simple cooking assistant responses
function getCookingResponse(message) {
    message = message.toLowerCase();
    
    // Very basic response logic - in a real app, you could use a more sophisticated chatbot or API
    if (message.includes('boil') || message.includes('water')) {
        return "To boil water, fill a pot with water, place it on the stove, and turn the heat to high. It's ready when you see bubbles rapidly rising to the surface.";
    } else if (message.includes('fry') || message.includes('pan')) {
        return "For pan frying, heat your pan on medium, add a little oil, and wait until it shimmers before adding your food.";
    } else if (message.includes('chop') || message.includes('cut')) {
        return "When chopping, use a sharp knife on a stable cutting board. Curl your fingers under while holding the food to protect your fingertips.";
    } else if (message.includes('temperature') || message.includes('done')) {
        return "Most meats are done when they reach specific internal temperatures: Chicken (165°F), Beef medium-rare (135°F), Pork (145°F).";
    } else if (message.includes('hi') || message.includes('hello')) {
        return "Hello! I'm your cooking assistant. What would you like to know about cooking?";
    } else {
        return "I'm here to help with cooking questions. Could you be more specific about what you'd like to know?";
    }
}

// Recipe Management
addRecipeBtn.addEventListener('click', () => {
    // Reset form for new recipe
    recipeForm.reset();
    document.getElementById('recipe-id').value = '';
    recipeFormTitle.textContent = 'Add New Recipe';
    recipeFormModal.style.display = 'block';
});

// Handle recipe form submission
recipeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const recipeId = document.getElementById('recipe-id').value;
    const recipeName = document.getElementById('recipe-name').value;
    const ingredients = document.getElementById('recipe-ingredients').value;
    const instructions = document.getElementById('recipe-instructions').value;
    
    if (recipeId) {
        // Update existing recipe
        const index = recipes.findIndex(recipe => recipe.id === recipeId);
        if (index !== -1) {
            recipes[index] = {
                id: recipeId,
                name: recipeName,
                ingredients,
                instructions
            };
        }
    } else {
        // Add new recipe
        const newRecipe = {
            id: Date.now().toString(),
            name: recipeName,
            ingredients,
            instructions
        };
        recipes.push(newRecipe);
    }
    
    // Save and update display
    saveRecipes();
    displayRecipes();
    recipeFormModal.style.display = 'none';
});

// Display all recipes
function displayRecipes() {
    recipeList.innerHTML = '';
    
    if (recipes.length === 0) {
        recipeList.innerHTML = '<p>No recipes yet. Add your first recipe!</p>';
        return;
    }
    
    recipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.classList.add('recipe-card');
        
        recipeCard.innerHTML = `
            <h3>${recipe.name}</h3>
            <div class="recipe-actions">
                <button class="edit-recipe" data-id="${recipe.id}">Edit</button>
                <button class="delete-recipe" data-id="${recipe.id}">Delete</button>
            </div>
        `;
        
        recipeList.appendChild(recipeCard);
    });
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-recipe').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            editRecipe(id);
        });
    });
    
    document.querySelectorAll('.delete-recipe').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            deleteRecipe(id);
        });
    });
}

// Edit recipe
function editRecipe(id) {
    const recipe = recipes.find(recipe => recipe.id === id);
    if (recipe) {
        document.getElementById('recipe-id').value = recipe.id;
        document.getElementById('recipe-name').value = recipe.name;
        document.getElementById('recipe-ingredients').value = recipe.ingredients;
        document.getElementById('recipe-instructions').value = recipe.instructions;
        
        recipeFormTitle.textContent = 'Edit Recipe';
        recipeFormModal.style.display = 'block';
    }
}

// Delete recipe
function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        recipes = recipes.filter(recipe => recipe.id !== id);
        saveRecipes();
        displayRecipes();
    }
}

// Save recipes to localStorage
function saveRecipes() {
    localStorage.setItem('recipes', JSON.stringify(recipes));
}

// Initialize
function init() {
    // Display any saved recipes
    displayRecipes();
}

// Run initialization
init();