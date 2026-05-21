"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getProject,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateProject,
  getFacultyUsers,
} from "@/lib/api";
import {
  Button,
  LoadingSpinner,
  Alert,
  useToast,
  AppLayout,
  PageHeader,
  PageContainer,
  Badge,
  EmptyState,
  Input,
  TextArea,
  Select,
} from "@/components";
import {
  Calendar,
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";

interface FacultySummary {
  user_id: number;
  full_name: string;
  email: string;
}

interface Project {
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  main_deadline: string | null;
  owner_user_id: number;
  course_code: string | null;
  faculty_supervisor_id: number | null;
  faculty_supervisor?: FacultySummary | null;
}

interface Task {
  task_id: number;
  title: string;
  description: string | null;
  type: string;
  due_date: string | null;
  status: string;
  priority: string;
  estimated_minutes: number | null;
}

const STATUS_VARIANTS: Record<
  string,
  "success" | "warning" | "info" | "secondary" | "danger"
> = {
  planning: "info",
  in_progress: "success",
  submitted: "info",
  completed: "success",
  archived: "secondary",
  not_started: "secondary",
  done: "success",
  overdue: "danger",
};

const PRIORITY_VARIANTS: Record<string, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

const PROJECT_STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const formatStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const { user, isLoading, isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<FacultySummary[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Project edit state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectFormData, setProjectFormData] = useState<Partial<Project>>({});
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState("");

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("reading");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!user || Number.isNaN(projectId)) return;

    const fetchData = async () => {
      const [projectResponse, facultyResponse] = await Promise.all([
        getProject(projectId),
        getFacultyUsers(),
      ]);

      if (projectResponse.data) {
        setProject(projectResponse.data);
        setProjectFormData(projectResponse.data);
      }

      if (facultyResponse.data) {
        setFacultyUsers(facultyResponse.data);
      }

      setProjectLoading(false);

      const tasksResponse = await getTasks(projectId);
      if (tasksResponse.data) {
        setTasks(tasksResponse.data);
      }
      setTasksLoading(false);
    };

    fetchData();
  }, [projectId, user]);

  const handleSaveProject = async () => {
    if (!projectFormData.title?.trim()) {
      setProjectError("Project title is required");
      return;
    }

    setProjectSaving(true);
    setProjectError("");

    const response = await updateProject(projectId, {
      title: projectFormData.title?.trim(),
      description: projectFormData.description?.trim() || undefined,
      course_code: projectFormData.course_code?.trim() || undefined,
      status: projectFormData.status,
      main_deadline: projectFormData.main_deadline || undefined,
      faculty_supervisor_id: projectFormData.faculty_supervisor_id || undefined,
    });

    if (response.error) {
      setProjectError(response.error);
      addToast(response.error, "error");
      setProjectSaving(false);
      return;
    }

    // Update the local project state
    setProject({ ...project, ...projectFormData } as Project);
    setIsEditingProject(false);
    setProjectSaving(false);
    addToast("Project updated successfully", "success");
  };

  const cancelProjectEdit = () => {
    setIsEditingProject(false);
    setProjectFormData(project || {});
    setProjectError("");
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError("");
    setTaskLoading(true);

    if (!taskTitle.trim()) {
      setTaskError("Task title is required");
      setTaskLoading(false);
      return;
    }

    const response = await createTask<Task>(projectId, {
      title: taskTitle,
      description: taskDescription,
      type: taskType,
      due_date: taskDueDate || undefined,
      priority: taskPriority,
    });

    if (response.error) {
      setTaskError(response.error);
      addToast(response.error, "error");
      setTaskLoading(false);
      return;
    }

    if (response.data) {
      setTasks([...tasks, response.data]);
      setTaskTitle("");
      setTaskDescription("");
      setTaskType("reading");
      setTaskPriority("medium");
      setTaskDueDate("");
      setShowTaskForm(false);
      addToast("Task added successfully", "success");
    }
    setTaskLoading(false);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskType(task.type);
    setTaskPriority(task.priority);
    setTaskDueDate(task.due_date ? task.due_date.split("T")[0] : "");
    setShowTaskForm(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    setTaskError("");
    setTaskLoading(true);

    if (!taskTitle.trim()) {
      setTaskError("Task title is required");
      setTaskLoading(false);
      return;
    }

    const response = await updateTask<Task>(projectId, editingTask.task_id, {
      title: taskTitle,
      description: taskDescription,
      type: taskType,
      due_date: taskDueDate || undefined,
      priority: taskPriority,
    });

    if (response.error) {
      setTaskError(response.error);
      addToast(response.error, "error");
      setTaskLoading(false);
      return;
    }

    if (response.data) {
      setTasks(
        tasks.map((t) => (t.task_id === editingTask.task_id ? response.data! : t))
      );
      resetTaskForm();
      addToast("Task updated successfully", "success");
    }
    setTaskLoading(false);
  };

  const handleDeleteTask = async (taskId: number) => {
    setDeletingTaskId(taskId);

    const response = await deleteTask(projectId, taskId);

    if (response.error) {
      addToast(response.error, "error");
      setDeletingTaskId(null);
      return;
    }

    setTasks(tasks.filter((t) => t.task_id !== taskId));
    addToast("Task deleted successfully", "success");
    setDeletingTaskId(null);
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskType("reading");
    setTaskPriority("medium");
    setTaskDueDate("");
    setShowTaskForm(false);
    setEditingTask(null);
    setTaskError("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <PageHeader
          title="Project Not Found"
          backHref="/projects"
          backLabel="Projects"
        />
        <PageContainer>
          <EmptyState
            icon={<AlertCircle className="h-7 w-7 text-muted-foreground" />}
            title="Project not found"
            description="The project you are looking for does not exist or has been deleted"
            action={
              <Link href="/projects">
                <Button variant="primary">Back to Projects</Button>
              </Link>
            }
          />
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={isEditingProject ? "Edit Project" : project.title}
        backHref="/projects"
        backLabel="Projects"
        actions={
          !isEditingProject ? (
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[project.status] || "secondary"}>
                {formatStatus(project.status)}
              </Badge>
              <Button
                onClick={() => setIsEditingProject(true)}
                variant="outline"
                size="sm"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          ) : null
        }
      />

      <PageContainer>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info / Edit Form */}
            <div className="card p-6">
              {projectError && (
                <Alert
                  type="error"
                  message={projectError}
                  onClose={() => setProjectError("")}
                  className="mb-4"
                />
              )}

              {isEditingProject ? (
                <div className="space-y-4">
                  <Input
                    id="project-title"
                    label="Project Title"
                    type="text"
                    value={projectFormData.title || ""}
                    onChange={(e) =>
                      setProjectFormData({
                        ...projectFormData,
                        title: e.target.value,
                      })
                    }
                    required
                  />

                  <TextArea
                    id="project-description"
                    label="Description"
                    value={projectFormData.description || ""}
                    onChange={(e) =>
                      setProjectFormData({
                        ...projectFormData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe your project..."
                    rows={4}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="project-course"
                      label="Course Code"
                      type="text"
                      value={projectFormData.course_code || ""}
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          course_code: e.target.value,
                        })
                      }
                      placeholder="e.g., CS101"
                    />

                    <Select
                      id="project-status"
                      label="Status"
                      value={projectFormData.status || "planning"}
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          status: e.target.value,
                        })
                      }
                      options={PROJECT_STATUS_OPTIONS}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="project-deadline"
                      label="Main Deadline"
                      type="date"
                      value={
                        projectFormData.main_deadline
                          ? projectFormData.main_deadline.split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          main_deadline: e.target.value,
                        })
                      }
                    />

                    <Select
                      id="project-supervisor"
                      label="Faculty Supervisor"
                      value={
                        projectFormData.faculty_supervisor_id?.toString() || ""
                      }
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          faculty_supervisor_id: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      options={[
                        { value: "", label: "No supervisor" },
                        ...facultyUsers.map((f) => ({
                          value: f.user_id.toString(),
                          label: f.full_name,
                        })),
                      ]}
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      onClick={handleSaveProject}
                      disabled={projectSaving}
                      loading={projectSaving}
                      variant="primary"
                    >
                      <Check className="h-4 w-4" />
                      Save Changes
                    </Button>
                    <Button
                      onClick={cancelProjectEdit}
                      variant="ghost"
                      disabled={projectSaving}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {project.description && (
                    <p className="text-muted-foreground mb-4">
                      {project.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm">
                    {project.course_code && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Course:</span>
                        <span className="font-medium text-foreground">
                          {project.course_code}
                        </span>
                      </div>
                    )}
                    {project.main_deadline && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Due:</span>
                        <span className="font-medium text-foreground">
                          {new Date(project.main_deadline).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {project.faculty_supervisor && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Supervisor:</span>
                        <span className="font-medium text-foreground">
                          {project.faculty_supervisor.full_name}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Tasks Section */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
                <Button
                  onClick={() => {
                    if (showTaskForm) {
                      resetTaskForm();
                    } else {
                      setShowTaskForm(true);
                    }
                  }}
                  variant={showTaskForm ? "outline" : "primary"}
                  size="sm"
                >
                  {showTaskForm ? (
                    <>
                      <X className="h-4 w-4" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Task
                    </>
                  )}
                </Button>
              </div>

              {showTaskForm && (
                <form
                  onSubmit={editingTask ? handleUpdateTask : handleAddTask}
                  className="mb-6 p-5 bg-secondary/50 rounded-xl border border-border animate-fade-in"
                >
                  <h3 className="text-sm font-medium text-foreground mb-4">
                    {editingTask ? "Edit Task" : "Add New Task"}
                  </h3>
                  {taskError && (
                    <Alert
                      type="error"
                      message={taskError}
                      onClose={() => setTaskError("")}
                      className="mb-4"
                    />
                  )}

                  <div className="space-y-4">
                    <Input
                      id="task-title"
                      label="Task Title"
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Enter task title"
                      required
                    />

                    <TextArea
                      id="task-description"
                      label="Description"
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Task description (optional)"
                      rows={3}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Select
                        id="task-type"
                        label="Type"
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value)}
                        options={[
                          { value: "reading", label: "Reading" },
                          { value: "analysis", label: "Analysis" },
                          { value: "writing", label: "Writing" },
                          { value: "meeting", label: "Meeting" },
                          { value: "admin", label: "Admin" },
                          { value: "other", label: "Other" },
                        ]}
                      />

                      <Select
                        id="task-priority"
                        label="Priority"
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        options={[
                          { value: "low", label: "Low" },
                          { value: "medium", label: "Medium" },
                          { value: "high", label: "High" },
                        ]}
                      />

                      <Input
                        id="task-due-date"
                        label="Due Date"
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={taskLoading}
                        loading={taskLoading}
                        variant="primary"
                      >
                        {taskLoading
                          ? editingTask
                            ? "Updating..."
                            : "Adding..."
                          : editingTask
                            ? "Update Task"
                            : "Add Task"}
                      </Button>
                      <Button type="button" onClick={resetTaskForm} variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {tasksLoading ? (
                <div className="py-8 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No tasks yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add tasks to track your project progress
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div
                      key={task.task_id}
                      className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-foreground">
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={PRIORITY_VARIANTS[task.priority] || "secondary"}
                          >
                            {task.priority}
                          </Badge>
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit task"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.task_id)}
                            disabled={deletingTaskId === task.task_id}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="Delete task"
                          >
                            {deletingTaskId === task.task_id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                        <span className="px-2 py-1 bg-secondary rounded-md text-muted-foreground capitalize">
                          {task.type}
                        </span>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="font-semibold text-foreground mb-4">
                Start Conversation
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Chat with TIA about this project to get research assistance
              </p>
              <Link
                href={`/conversations?project_id=${projectId}`}
                className="block"
              >
                <Button variant="primary" fullWidth>
                  <MessageSquare className="h-4 w-4" />
                  Chat with TIA
                </Button>
              </Link>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-foreground mb-4">Project Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Tasks</span>
                  <span className="font-medium text-foreground">
                    {tasks.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium text-foreground">
                    {
                      tasks.filter(
                        (t) => t.status === "done" || t.status === "completed"
                      ).length
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">High Priority</span>
                  <span className="font-medium text-foreground">
                    {tasks.filter((t) => t.priority === "high").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
