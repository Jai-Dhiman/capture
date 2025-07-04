import { useCallback, useState } from 'react';

export interface UndoRedoState<T> {
  history: T[];
  currentIndex: number;
}

export interface UndoRedoActions<T> {
  pushState: (state: T) => void;
  undo: () => T | undefined;
  redo: () => T | undefined;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  getCurrentState: () => T | undefined;
}

export function useUndoRedo<T>(initialState: T, maxHistorySize = 50): UndoRedoActions<T> {
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState<T>>({
    history: [initialState],
    currentIndex: 0,
  });

  const pushState = useCallback(
    (newState: T) => {
      setUndoRedoState((prevState) => {
        // Remove any future states if we're not at the end
        const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);

        // Add the new state
        newHistory.push(newState);

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          return {
            history: newHistory,
            currentIndex: newHistory.length - 1,
          };
        }

        return {
          history: newHistory,
          currentIndex: newHistory.length - 1,
        };
      });
    },
    [maxHistorySize],
  );

  const undo = useCallback((): T | undefined => {
    let result: T | undefined;

    setUndoRedoState((prevState) => {
      if (prevState.currentIndex > 0) {
        const newIndex = prevState.currentIndex - 1;
        result = prevState.history[newIndex];
        return {
          ...prevState,
          currentIndex: newIndex,
        };
      }
      return prevState;
    });

    return result;
  }, []);

  const redo = useCallback((): T | undefined => {
    let result: T | undefined;

    setUndoRedoState((prevState) => {
      if (prevState.currentIndex < prevState.history.length - 1) {
        const newIndex = prevState.currentIndex + 1;
        result = prevState.history[newIndex];
        return {
          ...prevState,
          currentIndex: newIndex,
        };
      }
      return prevState;
    });

    return result;
  }, []);

  const clear = useCallback(() => {
    setUndoRedoState({
      history: [undoRedoState.history[undoRedoState.currentIndex]],
      currentIndex: 0,
    });
  }, [undoRedoState.history, undoRedoState.currentIndex]);

  const getCurrentState = useCallback((): T | undefined => {
    return undoRedoState.history[undoRedoState.currentIndex];
  }, [undoRedoState.history, undoRedoState.currentIndex]);

  const canUndo = undoRedoState.currentIndex > 0;
  const canRedo = undoRedoState.currentIndex < undoRedoState.history.length - 1;

  return {
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    getCurrentState,
  };
}
