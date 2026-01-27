'use client';

/**
 * Loading Spinner Component
 */

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      {message && (
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}






