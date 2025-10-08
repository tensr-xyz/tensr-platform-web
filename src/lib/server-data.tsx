import { Suspense } from 'react';
import { apiClient } from './api-client';

// Server-side data fetching functions
export async function getServerSideFiles(filters?: { context?: string; organizationId?: string }) {
  try {
    // This would be called on the server side
    // For now, we'll structure it for when we implement actual SSR
    return {
      files: [],
      context: null,
      total: 0,
    };
  } catch (error) {
    console.error('Failed to fetch files on server:', error);
    return {
      files: [],
      context: null,
      total: 0,
    };
  }
}

export async function getServerSideProjects() {
  try {
    return [];
  } catch (error) {
    console.error('Failed to fetch projects on server:', error);
    return [];
  }
}

export async function getServerSideUser() {
  try {
    return null;
  } catch (error) {
    console.error('Failed to fetch user on server:', error);
    return null;
  }
}

// Parallel data fetching wrapper
export async function getParallelData() {
  try {
    // Fetch all data in parallel for better performance
    const [files, projects, user] = await Promise.allSettled([
      getServerSideFiles(),
      getServerSideProjects(),
      getServerSideUser(),
    ]);

    return {
      files: files.status === 'fulfilled' ? files.value : { files: [], context: null, total: 0 },
      projects: projects.status === 'fulfilled' ? projects.value : [],
      user: user.status === 'fulfilled' ? user.value : null,
    };
  } catch (error) {
    console.error('Failed to fetch parallel data:', error);
    return {
      files: { files: [], context: null, total: 0 },
      projects: [],
      user: null,
    };
  }
}

// Suspense boundary components for progressive loading
export function FilesSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading files...</div>}>{children}</Suspense>;
}

export function ProjectsSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading projects...</div>}>{children}</Suspense>;
}

export function UserSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading user...</div>}>{children}</Suspense>;
}
