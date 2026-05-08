import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:5000/api');
const STATUS_OPTIONS = ['Todo', 'In Progress', 'Done'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];
const REVIEW_OPTIONS = ['Pending', 'Approved', 'Rejected'];

const emptyProject = { name: '', description: '', members: [] };
const emptyTask = {
  title: '',
  description: '',
  project: '',
  assignedTo: '',
  priority: 'Medium',
  status: 'Todo',
  completionReview: 'Pending',
  dueDate: ''
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [taskFilter, setTaskFilter] = useState({ project: '', status: '' });
  const [profileOpen, setProfileOpen] = useState(false);

  const api = useMemo(() => {
    return async (path, options = {}) => {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    };
  }, [token]);

  const handleAuth = (payload) => {
    setToken(payload.token);
    setUser(payload.user);
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Task Manager</h1>
        </div>
        <button className="profile-card" onClick={() => setProfileOpen((open) => !open)}>
          <div>
            <p>{user.name}</p>
            <Badge label={user.role} />
          </div>
          <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
        </button>
        {profileOpen && (
          <div className="profile-menu">
            <h3>User Details</h3>
            <dl>
              <dt>Name</dt>
              <dd>{user.name}</dd>
              <dt>Role</dt>
              <dd>{user.role}</dd>
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>User Id</dt>
              <dd>{user.id}</dd>
            </dl>
            <button className="logout" onClick={logout}>Log out</button>
          </div>
        )}
        <nav>
          {['dashboard', 'projects', 'tasks', 'team'].map((item) => (
            <button key={item} className={view === item || (item === 'projects' && view === 'projectDetail') ? 'active' : ''} onClick={() => setView(item)}>
              {titleCase(item)}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span>Team workspace</span>
            <strong>{view === 'projectDetail' ? 'Project details' : titleCase(view)}</strong>
          </div>
          <div className="topbar-user">
            <span>{user.name}</span>
            <Badge label={user.role} />
          </div>
        </header>
        {view === 'dashboard' && <Dashboard api={api} />}
        {view === 'projects' && (
          <Projects
            api={api}
            user={user}
            onOpenProject={(projectId) => {
              setSelectedProjectId(projectId);
              setView('projectDetail');
            }}
          />
        )}
        {view === 'projectDetail' && (
          <ProjectDetail
            api={api}
            user={user}
            projectId={selectedProjectId}
            onBack={() => setView('projects')}
          />
        )}
        {view === 'tasks' && <Tasks api={api} user={user} filter={taskFilter} setFilter={setTaskFilter} />}
        {view === 'team' && <Team api={api} />}
      </main>
    </div>
  );
}

function AuthPage({ onAuth }) {
  const resetParams = new URLSearchParams(window.location.search);
  const initialResetToken = resetParams.get('resetToken') || '';
  const initialResetEmail = resetParams.get('email') || '';
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login');
  const [form, setForm] = useState({
    name: '',
    email: initialResetEmail,
    password: '',
    resetToken: initialResetToken,
    role: 'Member'
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to continue');
    return data;
  };

  const resetFeedback = () => {
    setError('');
    setMessage('');
    setResetLink('');
  };

  const submit = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/signup';
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await request(path, body);
      onAuth(data);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'API is not reachable. Check the backend deployment or API URL.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    resetFeedback();
    setLoading(true);

    try {
      const data = await request('/auth/forgot-password/request', { email: form.email });
      setMessage(data.message);
      setResetLink(data.resetUrl || '');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'API is not reachable. Check the backend deployment or API URL.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);

    try {
      const data = await request('/auth/forgot-password/reset', {
        email: form.email,
        token: form.resetToken,
        password: form.password
      });
      onAuth(data);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'API is not reachable. Check the backend deployment or API URL.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    resetFeedback();
    setForm((current) => ({ ...current, password: '', resetToken: nextMode === 'reset' ? current.resetToken : '' }));
  };

  const title = {
    login: 'Login',
    signup: 'Create account',
    forgot: 'Reset password',
    reset: 'Choose new password'
  }[mode];

  return (
    <main className="auth-page">
      <section className="auth-box">
        <h1>{title}</h1>
        <GoogleSignIn role={form.role} onAuth={onAuth} onError={setError} />
        <div className="auth-divider"><span>or</span></div>

        {(mode === 'login' || mode === 'signup') && <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </>
          )}

          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

          {mode === 'signup' && (
            <>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>Member</option>
                <option>Admin</option>
              </select>
            </>
          )}

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button type="submit" disabled={loading}>{mode === 'login' ? 'Login' : 'Sign up'}</button>
        </form>}

        {mode === 'forgot' && (
          <div className="auth-stack">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            {resetLink && <a className="reset-link" href={resetLink}>Open reset link</a>}
            <button type="button" disabled={loading} onClick={requestPasswordReset}>Send reset email</button>
          </div>
        )}

        {mode === 'reset' && (
          <form onSubmit={resetPassword}>
            <label>Email</label>
            <input type="email" value={form.email} readOnly />
            <input type="hidden" value={form.resetToken} readOnly />
            <label>New password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            <button type="submit" disabled={loading}>Reset password</button>
          </form>
        )}

        <div className="auth-links">
          {mode !== 'login' && <button className="link-button" onClick={() => switchMode('login')}>Back to login</button>}
          {mode !== 'signup' && <button className="link-button" onClick={() => switchMode('signup')}>Create account</button>}
          {mode !== 'forgot' && <button className="link-button" onClick={() => switchMode('forgot')}>Forgot password?</button>}
        </div>
      </section>
    </main>
  );
}

function GoogleSignIn({ role, onAuth, onError }) {
  const buttonRef = useRef(null);
  const [serverClientId, setServerClientId] = useState('');
  const [configMessage, setConfigMessage] = useState('');
  const [configLoaded, setConfigLoaded] = useState(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID));
  const [googleMessage, setGoogleMessage] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || serverClientId;

  useEffect(() => {
    if (import.meta.env.VITE_GOOGLE_CLIENT_ID) return;

    fetch(`${API_URL}/auth/config`)
      .then((res) => res.json())
      .then((data) => {
        setServerClientId(data.googleClientId || '');
        setConfigMessage(data.googleOAuthMessage || '');
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigMessage('Google sign-in config could not be loaded from the backend.');
        setConfigLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const renderButton = () => {
      if (!window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            onError('');
            setGoogleMessage('');
            const res = await fetch(`${API_URL}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential, role })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (data.code === 'GOOGLE_EMAIL_EXISTS') {
                setGoogleMessage(data.message);
              }
              throw new Error(data.message || 'Google sign-in failed');
            }
            onAuth(data);
          } catch (err) {
            onError(err.message === 'Failed to fetch' ? 'API is not reachable. Check the backend deployment or API URL.' : err.message);
          }
        }
      });

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 360
      });
    };

    if (window.google) {
      renderButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    script.onerror = () => onError('Google sign-in script could not be loaded');
    document.head.appendChild(script);
  }, [clientId, onAuth, onError, role]);

  if (!configLoaded) {
    return <p className="auth-note">Checking Google sign-in...</p>;
  }

  if (!clientId) {
    return <p className="auth-note">{configMessage || 'Add GOOGLE_CLIENT_ID in the backend env to enable Google sign-in.'}</p>;
  }

  const chooseAnotherAccount = () => {
    setGoogleMessage('');
    onError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    buttonRef.current?.querySelector('[role="button"]')?.click();
  };

  return (
    <div className="google-auth-block">
      <div className="google-button" ref={buttonRef} />
      {googleMessage && (
        <div className="google-conflict">
          <p>{googleMessage}</p>
          <button type="button" className="secondary full-width" onClick={chooseAnotherAccount}>
            Choose another Gmail
          </button>
        </div>
      )}
    </div>
  );
}

function Dashboard({ api }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api('/dashboard').then(setData).catch((err) => setError(err.message));
  };

  useEffect(load, [api]);

  if (error) return <Panel title="Dashboard"><p className="error">{error}</p></Panel>;
  if (!data) return <Panel title="Dashboard"><p>Loading...</p></Panel>;

  return (
    <section>
      <PageTitle title="Dashboard" action={<button className="secondary" onClick={load}>Refresh</button>} />
      <div className="stats">
        <Stat label="Projects" value={data.totalProjects} />
        <Stat label="Tasks" value={data.totalTasks} />
        <Stat label="Overdue" value={data.overdue} />
        <Stat label="Done" value={data.byStatus.done} />
      </div>
      <Panel title="Status">
        <div className="status-row">
          <Badge label={`Todo: ${data.byStatus.todo}`} />
          <Badge label={`In progress: ${data.byStatus.inProgress}`} />
          <Badge label={`Done: ${data.byStatus.done}`} />
        </div>
      </Panel>
      <Panel title="Nearest due tasks">
        <TaskTable tasks={data.upcoming} compact />
      </Panel>
    </section>
  );
}

function Projects({ api, user, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => {
    setMessage('');
    Promise.all([api('/projects'), api('/auth/users')])
      .then(([projectData, userData]) => {
        setProjects(projectData);
        setUsers(userData);
      })
      .catch((err) => setMessage(err.message));
  };

  useEffect(load, [api]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await api(editingId ? `/projects/${editingId}` : '/projects', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });
      setForm(emptyProject);
      setEditingId('');
      setShowForm(false);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const startEdit = (project) => {
    setEditingId(project._id);
    setForm({
      name: project.name,
      description: project.description || '',
      members: project.members.map((member) => member._id)
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeProject = async (project) => {
    if (!confirm(`Delete project "${project.name}" and all of its tasks?`)) return;
    try {
      await api(`/projects/${project._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const toggleMember = (id) => {
    setForm((current) => ({
      ...current,
      members: current.members.includes(id)
        ? current.members.filter((memberId) => memberId !== id)
        : [...current.members, id]
    }));
  };

  return (
    <section>
      <PageTitle
        title="Projects"
        subtitle="Live projects and assigned team members."
        action={user.role === 'Admin' && (
          <button
            className="primary-action"
            onClick={() => {
              if (showForm && !editingId) {
                setForm(emptyProject);
                setShowForm(false);
                return;
              }

              setEditingId('');
              setForm(emptyProject);
              setShowForm(true);
            }}
          >
            {showForm && !editingId ? 'Hide Form' : '+ New Project'}
          </button>
        )}
      />
      {user.role === 'Admin' && showForm && (
        <Panel title={editingId ? 'Edit project' : 'New project'}>
          <form className="grid-form" onSubmit={submit}>
            <input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="checks">
              {users.map((item) => (
                <label key={item._id}>
                  <input type="checkbox" checked={form.members.includes(item._id)} onChange={() => toggleMember(item._id)} />
                  {item.name} ({item.role})
                </label>
              ))}
            </div>
            <div className="actions">
              <button type="submit">{editingId ? 'Save project' : 'Create project'}</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId('');
                  setForm(emptyProject);
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
          {message && <p className="error">{message}</p>}
        </Panel>
      )}

      {message && user.role !== 'Admin' && <p className="error">{message}</p>}
      <div className="list">
        {projects.map((project) => (
          <article className="item project-card" key={project._id}>
            <button className="card-open" onClick={() => onOpenProject(project._id)}>
              <div className="item-head">
                <h3>{project.name}</h3>
                <Badge label={`${project.members.length} member(s)`} />
              </div>
              <p>{project.description || 'No description added'}</p>
              <div className="member-list">
                {project.members.map((member) => <span key={member._id}>{member.name}</span>)}
              </div>
              <small className="open-hint">Open project tasks</small>
            </button>
            {user.role === 'Admin' && (
              <div className="actions">
                <button className="secondary" onClick={() => startEdit(project)}>Edit</button>
                <button className="danger" onClick={() => removeProject(project)}>Delete</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectDetail({ api, user, projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');

  const load = () => {
    if (!projectId) return;
    setMessage('');
    Promise.all([api(`/projects/${projectId}`), api(`/tasks?project=${projectId}`)])
      .then(([projectData, taskData]) => {
        setProject(projectData);
        setTasks(taskData);
      })
      .catch((err) => setMessage(err.message));
  };

  useEffect(load, [api, projectId]);

  const updateStatus = async (task, status) => {
    try {
      await api(`/tasks/${task._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const updateReview = async (task, completionReview) => {
    try {
      await api(`/tasks/${task._id}`, {
        method: 'PUT',
        body: JSON.stringify({ completionReview })
      });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (!projectId) {
    return (
      <Panel title="Project details">
        <p className="muted">Select a project to view its details.</p>
      </Panel>
    );
  }

  if (message && !project) {
    return (
      <Panel title="Project details">
        <p className="error">{message}</p>
        <button className="secondary" onClick={onBack}>Back to projects</button>
      </Panel>
    );
  }

  if (!project) {
    return <Panel title="Project details"><p className="muted">Loading...</p></Panel>;
  }

  const done = tasks.filter((task) => task.status === 'Done').length;
  const inProgress = tasks.filter((task) => task.status === 'In Progress').length;
  const overdue = tasks.filter(isOverdue).length;

  return (
    <section>
      <PageTitle
        title={project.name}
        subtitle="Project details and related tasks"
        action={<button className="secondary" onClick={onBack}>Back to projects</button>}
      />

      <div className="detail-grid">
        <Panel title="Project details">
          <p className="detail-text">{project.description || 'No description added'}</p>
          <div className="detail-list">
            <span>Created by</span>
            <strong>{project.createdBy?.name || '-'}</strong>
            <span>Members</span>
            <strong>{project.members.length}</strong>
            <span>Created on</span>
            <strong>{formatDate(project.createdAt)}</strong>
          </div>
        </Panel>

        <Panel title="Members">
          <div className="member-list large">
            {project.members.map((member) => (
              <span key={member._id}>{member.name} ({member.role})</span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="stats">
        <Stat label="Tasks" value={tasks.length} />
        <Stat label="In Progress" value={inProgress} />
        <Stat label="Overdue" value={overdue} />
        <Stat label="Done" value={done} />
      </div>

      <Panel title="Associated tasks">
        {message && <p className="error">{message}</p>}
        <TaskTable
          tasks={tasks}
          user={user}
          onStatus={updateStatus}
          onReview={user.role === 'Admin' ? updateReview : null}
        />
      </Panel>
    </section>
  );
}

function Tasks({ api, user, filter, setFilter }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyTask);

  const load = () => {
    setMessage('');
    const params = new URLSearchParams();
    if (filter.project) params.set('project', filter.project);
    if (filter.status) params.set('status', filter.status);

    Promise.all([api(`/tasks${params.toString() ? `?${params}` : ''}`), api('/projects'), api('/auth/users')])
      .then(([taskData, projectData, userData]) => {
        setTasks(taskData);
        setProjects(projectData);
        setUsers(userData);
      })
      .catch((err) => setMessage(err.message));
  };

  useEffect(load, [api, filter.project, filter.status]);

  const selectedProject = projects.find((project) => project._id === form.project);
  const filteredProject = projects.find((project) => project._id === filter.project);
  const possibleAssignees = selectedProject?.members?.length ? selectedProject.members : users;

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await api(editingId ? `/tasks/${editingId}` : '/tasks', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });
      setForm(emptyTask);
      setEditingId('');
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const startEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title,
      description: task.description || '',
      project: task.project?._id || '',
      assignedTo: task.assignedTo?._id || '',
      priority: task.priority,
      status: task.status,
      completionReview: task.completionReview || 'Pending',
      dueDate: toDateInput(task.dueDate)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateStatus = async (task, status) => {
    try {
      await api(`/tasks/${task._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const updateReview = async (task, completionReview) => {
    try {
      await api(`/tasks/${task._id}`, {
        method: 'PUT',
        body: JSON.stringify({ completionReview })
      });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const removeTask = async (task) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api(`/tasks/${task._id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <section>
      <PageTitle
        title="Tasks"
        subtitle={filteredProject ? `Showing tasks for ${filteredProject.name}` : 'Assign work, track status, and monitor deadlines.'}
      />

      {user.role === 'Admin' && (
        <Panel title={editingId ? 'Edit task' : 'New task'}>
          <form className="grid-form" onSubmit={submit}>
            <Field label="Task title">
              <input placeholder="Example: Design dashboard" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Description">
              <input placeholder="Short details about the work" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Project">
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value, assignedTo: '' })}>
                <option value="">Select project</option>
                {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
            </Field>
            <Field label="Assign to">
              <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">Select team member</option>
                {possibleAssignees.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
              </select>
            </Field>
            <Field label="Priority" help="Choose how important this task is.">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITY_OPTIONS.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </Field>
            <Field label="Current status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Admin completion check" help="Use this after a member marks the task as Done.">
              <select
                value={form.status === 'Done' ? form.completionReview : 'Pending'}
                disabled={form.status !== 'Done'}
                onChange={(e) => setForm({ ...form, completionReview: e.target.value })}
              >
                {REVIEW_OPTIONS.map((review) => <option key={review}>{review}</option>)}
              </select>
            </Field>
            <Field label="Due date" help="Pick the deadline for this task.">
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
            <div className="actions">
              <button type="submit">{editingId ? 'Save task' : 'Create task'}</button>
              {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(''); setForm(emptyTask); }}>Cancel</button>}
            </div>
          </form>
          {message && <p className="error">{message}</p>}
        </Panel>
      )}

      <Panel title="Task list">
        <div className="toolbar">
          <select value={filter.project} onChange={(e) => setFilter({ ...filter, project: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
          </select>
          <button className="secondary" onClick={load}>Refresh</button>
          {(filter.project || filter.status) && (
            <button className="secondary" onClick={() => setFilter({ project: '', status: '' })}>Clear filters</button>
          )}
        </div>
        {message && user.role !== 'Admin' && <p className="error">{message}</p>}
        <TaskTable
          tasks={tasks}
          user={user}
          onStatus={updateStatus}
          onReview={user.role === 'Admin' ? updateReview : null}
          onEdit={user.role === 'Admin' ? startEdit : null}
          onDelete={user.role === 'Admin' ? removeTask : null}
        />
      </Panel>
    </section>
  );
}

function Team({ api }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/auth/users').then(setUsers).catch((err) => setError(err.message));
  }, [api]);

  return (
    <section>
      <PageTitle title="Team" subtitle="Registered users available for project membership and task assignment." />
      {error && <p className="error">{error}</p>}
      <div className="list">
        {users.map((item) => (
          <article className="item compact" key={item._id}>
            <div className="item-head">
              <h3>{item.name}</h3>
              <Badge label={item.role} />
            </div>
            <p>{item.email}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaskTable({ tasks, user, onStatus, onReview, onEdit, onDelete, compact = false }) {
  if (!tasks.length) return <p className="muted">No tasks found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>Project</th>
          <th>Assigned</th>
          <th>Status</th>
          <th>Admin check</th>
          <th>Due</th>
          {!compact && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const canUpdateStatus = user?.role === 'Admin' || task.assignedTo?._id === user?.id;
          return (
            <tr key={task._id}>
              <td>
                <strong>{task.title}</strong>
                <small>
                  <Badge label={task.priority} />
                  {task.description ? ` ${task.description}` : ''}
                </small>
              </td>
              <td>{task.project?.name || '-'}</td>
              <td>{task.assignedTo?.name || '-'}</td>
              <td>
                {compact || !onStatus ? (
                  <Badge label={task.status} />
                ) : (
                  <select value={task.status} disabled={!canUpdateStatus} onChange={(e) => onStatus(task, e.target.value)}>
                    {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                  </select>
                )}
              </td>
              <td>
                {onReview ? (
                  <select
                    value={task.completionReview || 'Pending'}
                    disabled={task.status !== 'Done'}
                    onChange={(e) => onReview(task, e.target.value)}
                  >
                    {REVIEW_OPTIONS.map((review) => <option key={review}>{review}</option>)}
                  </select>
                ) : (
                  <Badge label={task.status === 'Done' ? task.completionReview || 'Pending' : 'Not ready'} />
                )}
              </td>
              <td className={isOverdue(task) ? 'overdue' : ''}>{formatDate(task.dueDate)}</td>
              {!compact && (
                <td>
                  <div className="actions">
                    {onEdit && <button className="secondary" onClick={() => onEdit(task)}>Edit</button>}
                    {onDelete && <button className="danger" onClick={() => onDelete(task)}>Delete</button>}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PageTitle({ title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className={`stat stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function Badge({ label }) {
  return <span className={`badge ${badgeClass(label)}`}>{label}</span>;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function isOverdue(task) {
  return task.status !== 'Done' && task.dueDate && new Date(task.dueDate) < new Date();
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function badgeClass(label) {
  const text = String(label).toLowerCase();
  const key = text.replace(/\s+/g, '-');
  if (text.startsWith('in progress')) return 'badge-in-progress';
  if (text.startsWith('done')) return 'badge-done';
  if (text.startsWith('overdue')) return 'badge-rejected';
  if (text.startsWith('todo')) return 'badge-todo';
  if ([
    'todo',
    'in-progress',
    'done',
    'pending',
    'approved',
    'rejected',
    'admin',
    'member',
    'not-ready',
    'low',
    'medium',
    'high'
  ].includes(key)) {
    return `badge-${key}`;
  }
  return '';
}

createRoot(document.getElementById('root')).render(<App />);
