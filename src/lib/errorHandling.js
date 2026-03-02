import { toast } from 'sonner';

export const getErrorMessage = (error, fallback = 'Something went wrong') => (
  error?.message || fallback
);

export const handleAsyncError = (
  error,
  {
    fallback = 'Something went wrong',
    context = null,
    showToast = true,
  } = {}
) => {
  if (context) {
    console.error(`${context}:`, error);
  } else {
    console.error(error);
  }

  const message = getErrorMessage(error, fallback);
  if (showToast) {
    toast.error(message);
  }

  return message;
};
