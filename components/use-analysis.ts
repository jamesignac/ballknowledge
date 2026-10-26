"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/advanced";

export function useAnalysis<T>(path: string, body: unknown, enabled = true) {
  const key = JSON.stringify(body);
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    const timer = setTimeout(() => {
      apiRequest<T>(path, JSON.parse(key), controller.signal)
        .then((data) => {
          if (!controller.signal.aborted)
            setState({ data, loading: false, error: "" });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({ data: null, loading: false, error: error.message });
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, key, attempt, enabled]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
