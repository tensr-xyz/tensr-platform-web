import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, ProjectUpload } from '@/types/project';
import useAuth from '@/hooks/api/use-auth';
import { getAccessToken } from '@/utils/auth';

// API Base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface UseProjectProps {
  projectId?: string;
  initialLoad?: boolean;
}

export const useProject = ({ projectId, initialLoad = true }: UseProjectProps = {}) => {
  // State for managing projects
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const auth = useAuth();

  // Use a ref to track if initial load has happened
  const initialLoadDoneRef = useRef(false);

  // Get token with fallback to localStorage if auth context doesn't have it
  const getToken = useCallback((): string => {
    // Get token directly from localStorage via helper function
    const token = getAccessToken();
    return token || '';
  }, []);

  // Get all projects
  const getProjects = useCallback(async (): Promise<Project[]> => {
    const token = getToken();
    if (!token) {
      const errorMessage = new Error('Authentication required. Please log in again.');
      setError(errorMessage);
      throw errorMessage;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Projects API response:', data);

      // Check if the response has a projects property that's an array
      if (data && data.projects && Array.isArray(data.projects)) {
        // Map API response properties to match component expectations
        const mappedProjects = data.projects.map((p: Project) => ({
          name: p.projectName, // Map projectName to name
          projectId: p.projectId,
          id: p.projectId, // Also provide as id for components that use that
          status: p.status,
          updatedAt: p.updatedAt,
          lastModified: p.updatedAt,
          // Add other fields with reasonable defaults
          metadata: {
            analysisTypes: [],
            dataPoints: 0,
          },
        }));

        setProjects(mappedProjects);
        return mappedProjects;
      } else if (Array.isArray(data)) {
        // If the response is already an array, use it directly
        setProjects(data);
        return data;
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Unexpected API response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error(String(err));
      setError(errorMessage);
      console.error('Project fetch error details:', err);
      throw errorMessage;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Get a single project
  const getProject = useCallback(
    async (id: string): Promise<Project> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch project: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('Project API response:', data);

        // Transform the API response to match component expectations
        const transformedProject = {
          ...data,
          // Add properties expected by components
          id: data.projectId,
          name: data.projectName,
          path: data.projectId, // Use projectId as path if not available
        };

        setProject(transformedProject);
        return transformedProject;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  // Create a new project
  const createProject = useCallback(
    async (projectData: Partial<Project>): Promise<Project> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create project: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Update projects list
        setProjects(prev => [...prev, data]);

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  // Update a project
  const updateProject = useCallback(
    async (id: string, projectData: Partial<Project>): Promise<Project> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update project: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Update local state
        setProjects(prev => prev.map(p => (p.projectId === id ? data : p)));
        if (project && project.projectId === id) {
          setProject(data);
        }

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [project, getToken]
  );

  // Delete a project
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete project: ${response.status} ${errorText}`);
        }

        // Update local state
        setProjects(prev => prev.filter(p => p.projectId !== id));
        if (project && project.projectId === id) {
          setProject(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [project, getToken]
  );

  // Get a project upload URL
  const getUploadUrl = useCallback(
    async (id: string, fileName: string): Promise<ProjectUpload> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/projects/${id}/upload-url?fileName=${encodeURIComponent(fileName)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get upload URL: ${response.status} ${errorText}`);
        }

        return await response.json();
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  // Complete a project upload
  const completeUpload = useCallback(
    async (id: string): Promise<Project> => {
      const token = getToken();
      if (!token) {
        const errorMessage = new Error('Authentication required. Please log in again.');
        setError(errorMessage);
        throw errorMessage;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/projects/${id}/complete-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to complete upload: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Update local state
        setProjects(prev => prev.map(p => (p.projectId === id ? data : p)));
        if (project && project.projectId === id) {
          setProject(data);
        }

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error(String(err));
        setError(errorMessage);
        throw errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [project, getToken]
  );

  // Load initial data if requested - FIXED TO PREVENT INFINITE LOOP
  useEffect(() => {
    // Only proceed if initialLoad is true and we haven't already done the initial load
    if (initialLoad && !initialLoadDoneRef.current) {
      const token = getToken();

      if (token) {
        console.log('Initial data load: token available');
        initialLoadDoneRef.current = true; // Mark initial load as done

        // Load the specific project if ID is provided
        if (projectId) {
          getProject(projectId).catch(err => console.error('Error loading project:', err));
        }

        // Load all projects
        getProjects().catch(err => console.error('Error loading projects:', err));
      } else {
        console.warn('No authentication token available - skipping initial project load');
      }
    }
  }, [initialLoad, projectId, getProject, getProjects, getToken]);

  // Add a separate useEffect to handle auth changes after initial load
  useEffect(() => {
    // Only refresh data if auth changes and we're already past the initial load
    if (initialLoadDoneRef.current && auth.isAuthenticated) {
      console.log('Auth changed, refreshing project data');

      if (projectId) {
        getProject(projectId).catch(err => console.error('Error refreshing project:', err));
      }

      getProjects().catch(err => console.error('Error refreshing projects:', err));
    }
  }, [auth.isAuthenticated, projectId, getProject, getProjects]);

  return {
    // State
    project,
    projects,
    isLoading,
    error,

    // Methods
    getProject,
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getUploadUrl,
    completeUpload,
  };
};
