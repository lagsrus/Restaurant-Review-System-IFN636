const Task = require('../models/Task');

const getTasks = async (req,res) => {
    try {
        const tasks = await Task.find({userId: req.user.id});

        res.json(tasks);
    } catch(error){
        res.status(500).json({message: error.message});
    }
};

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

const deleteTask = async (
req,
res) => {
try {
const task = await Task.findById(req.params.id);
if (!task) return res.status(404).json({ message: 'Task not found' });
await task.remove();
res.json({ message: 'Task deleted' });
} catch (error) {
res.status(500).json({ message: error.message });
}
};
module.exports = { getTasks, addTask, updateTask, deleteTask };