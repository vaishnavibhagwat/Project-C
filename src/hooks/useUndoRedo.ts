import { useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { redoLayoutChange, undoLayoutChange } from '@/store/actions';
import { useLayoutHistory, type HistoryState } from '@/store/history';

export interface UndoRedo extends HistoryState {
  undo: () => void;
  redo: () => void;
}

/**
 * Undo and redo layout changes with a toast for each outcome. Shared by the workspace toolbar
 * buttons and the Ctrl+Z / Ctrl+Shift+Z shortcuts so both behave the same.
 */
export function useUndoRedo(): UndoRedo {
  const state = useLayoutHistory();
  const notify = useToast();

  const undo = useCallback(() => {
    try {
      const entry = undoLayoutChange();
      notify(entry ? { message: `Undid: ${entry.label}` } : { message: 'Nothing to undo' });
    } catch {
      notify({ message: 'Could not undo the last change', tone: 'error' });
    }
  }, [notify]);

  const redo = useCallback(() => {
    try {
      const entry = redoLayoutChange();
      notify(entry ? { message: `Redid: ${entry.label}` } : { message: 'Nothing to redo' });
    } catch {
      notify({ message: 'Could not redo the change', tone: 'error' });
    }
  }, [notify]);

  return { ...state, undo, redo };
}
