import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LiveAssessment } from '../types/workspace';

/**
 * Versioned persistence key. Bump the version when the persisted shape
 * changes so stale payloads are discarded instead of mis-hydrated.
 */
const STORAGE_KEY = 'mara_assessments:v1';

function loadPersisted(): LiveAssessment[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Defensive: only accept an array of objects shaped like LiveAssessment.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is LiveAssessment =>
        typeof a === 'object' && a !== null && typeof a.thread_id === 'string',
    );
  } catch {
    // Corrupted payload (or unavailable storage) — start clean.
    return [];
  }
}

function persist(assessments: LiveAssessment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
  } catch {
    // Quota exceeded or storage unavailable — persistence is best-effort.
  }
}

interface AssessmentContextType {
  assessments: LiveAssessment[];
  addAssessment: (assessment: LiveAssessment) => void;
  updateAssessment: (threadId: string, patch: Partial<LiveAssessment>) => void;
  removeAssessment: (threadId: string) => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: ReactNode }) {
  // Hydrate once on mount; survives tab close via localStorage.
  const [assessments, setAssessments] = useState<LiveAssessment[]>(loadPersisted);

  useEffect(() => {
    persist(assessments);
  }, [assessments]);

  function addAssessment(assessment: LiveAssessment) {
    setAssessments((prev) => [assessment, ...prev]);
  }

  function updateAssessment(threadId: string, patch: Partial<LiveAssessment>) {
    setAssessments((prev) =>
      prev.map((a) => (a.thread_id === threadId ? { ...a, ...patch } : a)),
    );
  }

  function removeAssessment(threadId: string) {
    setAssessments((prev) => prev.filter((a) => a.thread_id !== threadId));
  }

  return (
    <AssessmentContext.Provider value={{ assessments, addAssessment, updateAssessment, removeAssessment }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessments() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessments must be used within an AssessmentProvider');
  }
  return context;
}
