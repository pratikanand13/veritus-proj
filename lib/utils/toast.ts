/**
 * Toast notification utility
 * Centralized toast functions for consistent error/warning/info handling
 * NEVER use alert(), console.error, or blocking modals - use these instead
 */

import { toast as sonnerToast } from 'sonner'

export const toast = {
  /**
   * Show error toast
   */
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 5000,
    })
  },

  /**
   * Show warning toast
   */
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 4000,
    })
  },

  /**
   * Show success toast
   */
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 3000,
    })
  },

  /**
   * Show info toast
   */
  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 3000,
    })
  },

  /**
   * Show loading toast (returns dismiss function)
   */
  loading: (message: string) => {
    return sonnerToast.loading(message)
  },

  /**
   * Dismiss toast by ID
   */
  dismiss: (toastId: string | number) => {
    sonnerToast.dismiss(toastId)
  },
}

