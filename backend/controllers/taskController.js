const Task = require('../models/Task');

const getTasks = async (req,res) => {
    try {
        const tasks = await Task.find({userId: req.user.id});

        res.json(tasks);
    } catch(error){
        res.status(500).json({message: error.message});
    }
};
const getAllReviews = async (req,res) => {
    try {
        // Sort tasks by rating in descending order, (-1 = highest rating first)
        const tasks = (await Task.find()).sort({ rating: -1});
        res.json(tasks);
    } catch(error){
        res.status(500).json({message: error.message});
    }
}
const addTask = async (req,res) => {
    const { title, description, cuisine, location, waitTime, cost, rating, visitedAt } = req.body;
try {
    const task = await Task.create({ 
        userId: req.user.id, title, description, cuisine, location, waitTime, cost, rating, visitedAt });
    res.status(201).json(task);
} catch (error) {
    res.status(500).json({ message: error.message });
}
};

const updateTask = async (req,res) => {
const { title, description, cuisine, location, waitTime, cost, rating, visitedAt } = req.body;
try {
const task = await Task.findById(req.params.id);
if (!task) return res.status(404).json({ message: 'Task not found' });
task.title = title || task.title;
task.description = description || task.description;
task.cuisine = cuisine || task.cuisine;
task.location = location || task.location;
task.waitTime = waitTime || task.waitTime;
task.cost = cost || task.cost;
task.rating = rating || task.rating;
task.visitedAt = visitedAt || task.visitedAt;
const updatedTask = await task.save();
res.json(updatedTask);
} catch (error) {
res.status(500).json({ message: error.message });
}
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isOwner = task.userId.toString() === req.user.id.toString();
    const isAdmin = req.user.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }
    await task.remove();
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTasks, getAllReviews, addTask, updateTask, deleteTask };