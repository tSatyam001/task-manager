const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const protect = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  const now = new Date();
  let taskQuery = {};
  let projectQuery = {};

  if (req.user.role !== 'Admin') {
    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { members: req.user._id }]
    }).select('_id');

    const projectIds = projects.map((project) => project._id);
    taskQuery = {
      $or: [{ assignedTo: req.user._id }, { project: { $in: projectIds } }]
    };
    projectQuery = { _id: { $in: projectIds } };
  }

  const [totalProjects, totalTasks, todo, inProgress, done, overdue, upcoming] = await Promise.all([
    Project.countDocuments(projectQuery),
    Task.countDocuments(taskQuery),
    Task.countDocuments({ ...taskQuery, status: 'Todo' }),
    Task.countDocuments({ ...taskQuery, status: 'In Progress' }),
    Task.countDocuments({ ...taskQuery, status: 'Done' }),
    Task.countDocuments({ ...taskQuery, status: { $ne: 'Done' }, dueDate: { $lt: now } }),
    Task.find({ ...taskQuery, status: { $ne: 'Done' } })
      .populate('project', 'name')
      .populate('assignedTo', 'name')
      .sort({ dueDate: 1 })
      .limit(6)
  ]);

  res.json({
    totalProjects,
    totalTasks,
    byStatus: {
      todo,
      inProgress,
      done
    },
    overdue,
    upcoming
  });
});

module.exports = router;
