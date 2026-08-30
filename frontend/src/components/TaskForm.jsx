import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../axiosConfig';

const TaskForm = ({ tasks, setTasks, editingTask, setEditingTask }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cuisine: '',
    location: '',
    waitTime: 'Short',
    cost: '$',
    rating: 5,
    visitedAt: '',
  });

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description,
        cuisine: editingTask.cuisine,
        location: editingTask.location || '',
        waitTime: editingTask.waitTime || 'Short',
        cost: editingTask.cost || '$',
        rating: editingTask.rating || 5,
        visitedAt: editingTask.visitedAt,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        cuisine: '',
        location: '',
        waitTime: 'Short',
        cost: '$',
        rating: 5,
        visitedAt: '',
      });
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
      setFormData({
        title: '',
        description: '',
        cuisine: '',
        location: '',
        waitTime: 'Short',
        cost: '$',
        rating: 5,
        visitedAt: '',
      });
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
        type="text"
        placeholder="Cuisine"
        value={formData.cuisine}
        onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />

      <input
        type="text"
        placeholder="Location"
        value={formData.location}
        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />

      <select
        value={formData.waitTime}
        onChange={(e) => setFormData({ ...formData, waitTime: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      >
        <option value="Short">Short</option>
        <option value="Medium">Medium</option>
        <option value="Long">Long</option>
      </select>

      <select
        value={formData.cost}
        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      >
        <option value="$">$</option>
        <option value="$$">$$</option>
        <option value="$$$">$$$</option>
      </select>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setFormData({ ...formData, rating: star })}
              className={`text-2xl ${star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <input
        type="date"
        value={formData.visitedAt}
        onChange={(e) => setFormData({ ...formData, visitedAt: e.target.value })}
        className="w-full mb-4 p-2 border rounded"
      />

      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
        {editingTask ? 'Update Review' : 'Add Review'}
      </button>
    </form>
  );
};

export default TaskForm;
