const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const protect = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { isObjectId, missingFields } = require('../utils/validators');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  const query =
    req.user.role === 'Admin'
      ? {}
      : { $or: [{ createdBy: req.user._id }, { members: req.user._id }] };

  const projects = await Project.find(query)
    .populate('members', 'name email role')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  res.json(projects);
});

router.post('/', requireRole('Admin'), async (req, res) => {
  const { name, description, members = [] } = req.body;
  const missing = missingFields(req.body, ['name']);

  if (missing.length) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(', ')}` });
  }

  if (!Array.isArray(members) || members.some((id) => !isObjectId(id))) {
    return res.status(400).json({ message: 'Members must be a list of valid users' });
  }

  const memberIds = [...new Set([req.user._id.toString(), ...members])];
  const validMemberCount = await User.countDocuments({ _id: { $in: memberIds } });
  if (validMemberCount !== memberIds.length) {
    return res.status(400).json({ message: 'Every project member must be an existing user' });
  }

  const project = await Project.create({
    name,
    description,
    members: memberIds,
    createdBy: req.user._id
  });

  const populated = await project.populate('members', 'name email role');
  res.status(201).json(populated);
});

router.get('/:id', async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  const project = await Project.findById(req.params.id)
    .populate('members', 'name email role')
    .populate('createdBy', 'name email');

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const belongsToProject = project.members.some((member) => member._id.equals(req.user._id));
  if (req.user.role !== 'Admin' && !belongsToProject && !project.createdBy._id.equals(req.user._id)) {
    return res.status(403).json({ message: 'You cannot view this project' });
  }

  res.json(project);
});

router.put('/:id', requireRole('Admin'), async (req, res) => {
  const { name, description, members } = req.body;

  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  if (members && (!Array.isArray(members) || members.some((id) => !isObjectId(id)))) {
    return res.status(400).json({ message: 'Members must be a list of valid users' });
  }

  const updates = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (members) {
    const memberIds = [...new Set([req.user._id.toString(), ...members])];
    const validMemberCount = await User.countDocuments({ _id: { $in: memberIds } });
    if (validMemberCount !== memberIds.length) {
      return res.status(400).json({ message: 'Every project member must be an existing user' });
    }
    updates.members = memberIds;
  }

  const project = await Project.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  }).populate('members', 'name email role');

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  res.json(project);
});

router.delete('/:id', requireRole('Admin'), async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid project id' });
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  await Task.deleteMany({ project: project._id });
  await project.deleteOne();

  res.json({ message: 'Project deleted' });
});

module.exports = router;
