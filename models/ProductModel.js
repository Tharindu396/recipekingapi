const mongoose = require('mongoose');

const RecipeSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter a Recipe Name"]
  },
  ingredients: {
    type: [String],
    required: true
  },
  image: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ["Healthy", "Party"]
  },
  steps: {
    type: [String],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Recipe = mongoose.model('Recipe', RecipeSchema);
module.exports = Recipe;
