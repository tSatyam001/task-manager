const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const protect = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { isObjectId, missingFields } = require('../utils/validators');

const router = express.Router();
const STATUS_OPTIONS = ['Todo', 'In Progress', 'Done'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const REVIEW_OPTIONS = ['Pending', 'Approved', 'Rejected'];

router.use(protect);

const canUseProject = async (projectId, user) => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const isMember = project.members.some((id) => id.equals(user._id));
  if (user.role === 'Admin' || isMember || project.createdBy.equals(user._id)) {
    return project;
  }

  return false;
};

router.get('/', async (req, res) => {
  const query = {};

  if (req.query.project) {
    if (!isObjectId(req.query.project)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }
    query.project = req.query.project;
  }

  if (req.query.status) {
    if (!STATUS_OPTIONS.includes(req.query.status)) {
      return res.status(400).json({ message: 'Invalid task status' });
    }
    query.status = req.query.status;
  }

  if (req.user.role !== 'Admin') {
    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { members: req.user._id }]
    }).select('_id');

    query.$or = [
      { assignedTo: req.user._id },
      { project: { $in: projects.map((project) => project._id) } }
    ];
  }

  const tasks = await Task.find(query)
    .populate('project', 'name')
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email')
    .sort({ dueDate: 1 });

  res.json(tasks);
});

router.post('/', requireRole('Admin'), async (req, res) => {
  const { title, description, project, assignedTo, status, priority, dueDate, completionReview } = req.body;
  const missing = missingFields(req.body, ['title', 'project', 'assignedTo', 'dueDate']);

  if (missing.length) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(', ')}` });
  }

  if (!isObjectId(project) || !isObjectId(assignedTo)) {
    return res.status(400).json({ message: 'Project and assignee must be valid' });
  }

  if (status && !STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ message: 'Invalid task status' });
  }

  if (priority && !PRIORITY_OPTIONS.includes(priority)) {
    return res.status(400).json({ message: 'Invalid task priority' });
  }

  if (completionReview && !REVIEW_OPTIONS.includes(completionReview)) {
    return res.status(400).json({ message: 'Invalid admin completion check' });
  }

  const parsedDueDate = new Date(dueDate);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ message: 'Due date must be valid' });
  }

  const projectRecord = await canUseProject(project, req.user);
  if (!projectRecord) {
    return res.status(projectRecord === null ? 404 : 403).json({ message: 'Project is not available' });
  }

  const assigneeInProject = projectRecord.members.some((id) => id.toString() === assignedTo);
  if (!assigneeInProject) {
    return res.status(400).json({ message: 'Assignee must be a project member' });
  }

  const assignee = await User.findById(assignedTo);
  if (!assignee) {
    return res.status(400).json({ message: 'Assignee must be an existing user' });
  }

  const task = await Task.create({
    title,
    description,
    project,
    assignedTo,
    status,
    completionReview: status === 'Done' ? completionReview || 'Pending' : 'Pending',
    priority,
    dueDate: parsedDueDate,
    createdBy: req.user._id
  });

  const populated = await task.populate([
    { path: 'project', select: 'name' },
    { path: 'assignedTo', select: 'name email role' },
    { path: 'createdBy', select: 'name email' }
  ]);

  res.status(201).json(populated);
});

router.put('/:id', async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task id' });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const project = await canUseProject(task.project, req.user);
  if (!project) {
    return res.status(403).json({ message: 'You cannot update this task' });
  }

  const isAssignee = task.assignedTo.equals(req.user._id);
  const updates = {};

  if (req.user.role === 'Admin') {
    if (req.body.status !== undefined && !STATUS_OPTIONS.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid task status' });
    }

    if (req.body.priority !== undefined && !PRIORITY_OPTIONS.includes(req.body.priority)) {
      return res.status(400).json({ message: 'Invalid task priority' });
    }

    if (req.body.completionReview !== undefined && !REVIEW_OPTIONS.includes(req.body.completionReview)) {
      return res.status(400).json({ message: 'Invalid admin completion check' });
    }

    if (req.body.dueDate !== undefined) {
      const parsedDueDate = new Date(req.body.dueDate);
      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({ message: 'Due date must be valid' });
      }
      updates.dueDate = parsedDueDate;
    }

    ['title', 'description', 'status', 'priority', 'dueDate', 'completionReview'].forEach((field) => {
      if (field === 'dueDate') return;
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.assignedTo !== undefined) {
      if (!isObjectId(req.body.assignedTo)) {
        return res.status(400).json({ message: 'Assignee must be valid' });
      }

      const assigneeInProject = project.members.some((id) => id.toString() === req.body.assignedTo);
      if (!assigneeInProject) {
        return res.status(400).json({ message: 'Assignee must be a project member' });
      }

      const assignee = await User.findById(req.body.assignedTo);
      if (!assignee) {
        return res.status(400).json({ message: 'Assignee must be an existing user' });
      }

      updates.assignedTo = req.body.assignedTo;
    }
  } else if (isAssignee && req.body.status) {
    if (!STATUS_OPTIONS.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid task status' });
    }
    updates.status = req.body.status;
  } else {
    return res.status(403).json({ message: 'Members can only update their assigned task status' });
  }

  const nextStatus = updates.status || task.status;
  if (nextStatus !== 'Done') {
    updates.completionReview = 'Pending';
  }

  const updatedTask = await Task.findByIdAndUpdate(task._id, updates, {
    new: true,
    runValidators: true
  })
    .populate('project', 'name')
    .populate('assignedTo', 'name email role');

  res.json(updatedTask);
});

router.delete('/:id', requireRole('Admin'), async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid task id' });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  await task.deleteOne();
  res.json({ message: 'Task deleted' });
});

module.exports = router;
