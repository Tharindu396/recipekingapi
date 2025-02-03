const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./models/UserModel');
const Recipe = require('./models/ProductModel');
const app = express();

app.use(cors({
  origin: ["https://frontend-eight-ivory.vercel.app"],
  methods:["POST","GET","UPDATE","DELETE"],
  credentials:true
}));
app.use(express.json());

const JWT_SECRET = 'your_jwt_secret'; 

// Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

// User routes
app.post('/signup', async (req, res) => {
  const { username, password, image, bio } = req.body;

  const user = new User({
    username,
    password,  
    image,
    bio,
  });

  try {
    const savedUser = await user.save();
    res.status(200).json(savedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: 'Username or password is wrong' });

  if (password !== user.password) return res.status(400).json({ message: 'Invalid password' });

  const token = jwt.sign({ _id: user._id }, JWT_SECRET);
  res.header('Authorization', token).json({ token });
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password'); 
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Recipe routes
app.get('/Recipe', async (req, res) => {
  try {
    const recipes = await Recipe.find({});
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/Recipe/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id).populate('userId');
    res.status(200).json(recipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/Recipe', authenticate, async (req, res) => {
  try {
    const recipe = new Recipe({
      ...req.body,
      userId: req.user._id,
    });
    const savedRecipe = await recipe.save();
    res.status(200).json(savedRecipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/Recipe/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (recipe.userId.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const updatedRecipe = await Recipe.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json(updatedRecipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/Recipe/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (recipe.userId.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const deletedRecipe = await Recipe.findByIdAndDelete(id);
    res.status(200).json(deletedRecipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to handle rating
app.post('/Recipe/:id/rate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Check if the user is trying to rate their own recipe
    if (recipe.userId.toString() === req.user._id) {
      return res.status(400).json({ message: 'You cannot rate your own recipe' });
    }

    // Find the user
    const user = await User.findById(req.user._id);

    // Check if the user has already rated this recipe
    const existingRating = user.ratings.find(r => r.recipeId.toString() === id);
    if (existingRating) {
      return res.status(400).json({ message: 'You have already rated this recipe' });
    }

    // Add the rating to the user's ratings array
    user.ratings.push({
      recipeId: id,
      rating,
    });

    await user.save();
    
    
    const owner = await User.findById(recipe.userId);
    const feedbackCount = owner.ratings.length;
    const totalRating = owner.ratings.reduce((sum, rating) => sum + rating.rating, 0);
    recipe.rating = totalRating / feedbackCount;

    await recipe.save();

    res.status(200).json({ message: 'Rating submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.post('/users/:id/follow', authenticate, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToFollow.followers.includes(currentUser._id)) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    userToFollow.followers.push(currentUser._id);
    currentUser.following.push(userToFollow._id);

    await userToFollow.save();
    await currentUser.save();

    res.status(200).json({ message: 'Followed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/users/:id/unfollow', authenticate, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!userToUnfollow.followers.includes(currentUser._id)) {
      return res.status(400).json({ message: 'You are not following this user' });
    }

    userToUnfollow.followers = userToUnfollow.followers.filter(followerId => !followerId.equals(currentUser._id));
    currentUser.following = currentUser.following.filter(followingId => !followingId.equals(userToUnfollow._id));

    await userToUnfollow.save();
    await currentUser.save();

    res.status(200).json({ message: 'Unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Route to handle comments
app.post('/Recipe/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Find the owner of the recipe
    const owner = await User.findById(recipe.userId);

    if (!owner) {
      return res.status(404).json({ message: 'Recipe owner not found' });
    }

    // Push the comment to the owner's feedback
    owner.feedback.push({
      comment,
      userId: req.user._id,
      createdAt: new Date()
    });

    await owner.save();

    res.status(200).json({ message: 'Comment submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get('/myRecipes', async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.user._id });
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get('/followedRecipes', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('following');
    const followedUserIds = user.following.map(followingUser => followingUser._id);
    
    const recipes = await Recipe.find({ userId: { $in: followedUserIds } });
    res.status(200).json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});





mongoose.connect('mongodb+srv://admin:recipe@recipekingapi.1xklfwh.mongodb.net/Node-api?retryWrites=true&w=majority&appName=RecipeKingapi')
  .then(() => {
    app.listen(3000, () => {
      console.log('Node API is running on port 3000');
    });
    console.log('Connected to MongoDB');
  }).catch((error) => {
    console.log(error);
  });
