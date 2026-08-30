import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../axiosConfig';

const TaskForm = ({ tasks, setTasks, editingTask, setEditingTask }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ title: '', description: '', cuisine: '', visitedAt: '' });

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description,
        cuisine: editingTask.cuisine,
        visitedAt: editingTask.visitedAt,
      });
    } else {
      setFormData({ title: '', description: '', cuisine: '', visitedAt: '' });
    }
  }, [editingTask]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        const response = await axiosInstance.put(`/api/tasks/${editingTask._id}`, formData, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setTasks(tasks.map((task) => (task._id === response.data._id ? response.data : task)));
      } else {
        const response = await axiosInstance.post('/api/tasks', formData, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setTasks([...tasks, response.data]);
      }
      setEditingTask(null);
      setFormData({ title: '', description: '', cuisine: '', visitedAt: '' });
    } catch (error) {
      alert('Failed to save task.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 shadow-md rounded mb-6">
      <h1 className="text-2xl font-bold mb-4">{editingTask ? 'Edit Review' : 'Add Review'}</h1>
      <input
        type="text"
        placeholder="Restaurant Name"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />
      <textarea
        placeholder="Your review..."
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        className="w-full mb-4 p-2 border rounded min-h-[120px] resize-y"
      />
      <input
        type="date"
        placeholder="Visited At"
        value={formData.visitedAt}
        onChange={(e) => setFormData({ ...formData, visitedAt: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />
      <input
        type="text"
        placeholder="Cuisine"
        value={formData.cuisine}
        onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />
      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
        {editingTask ? 'Update Review' : 'Add Review'}
      </button>
    </form>
  );
};

export default TaskForm;
