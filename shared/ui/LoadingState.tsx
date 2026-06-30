import React from "react";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return <div className="p-6 text-center text-slate-500">{message}</div>;
}
