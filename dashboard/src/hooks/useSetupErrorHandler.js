import { useState, useCallback } from 'react';

const useSetupErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [retryableErrors, setRetryableErrors] = useState([]);

  const categorizeError = useCallback((error, context = '') => {
    const errorMessage = error?.message || error || 'Unknown error';
    const errorCode = error?.code || error?.error || '';
    
    // Categorize based on error patterns
    let category = 'general';
    let isRetryable = false;
    let suggestion = '';
    
    if (errorMessage.includes('AADSTS')) {
      category = 'authentication';
      
      if (errorMessage.includes('AADSTS50020')) {
        suggestion = 'Please verify your email address and try again';
      } else if (errorMessage.includes('AADSTS65001')) {
        suggestion = 'User consent is required. Please grant permissions when prompted';
      } else if (errorMessage.includes('AADSTS70008')) {
        suggestion = 'Authorization code has expired. Please restart the authentication process';
        isRetryable = true;
      } else if (errorMessage.includes('AADSTS50011')) {
        suggestion = 'Invalid redirect URI. Please check your application configuration';
      } else if (errorMessage.includes('AADSTS7000215')) {
        suggestion = 'Invalid client secret. Please verify your application credentials';
      }
    } else if (errorMessage.includes('insufficient_scope') || errorMessage.includes('Insufficient privileges')) {
      category = 'permissions';
      suggestion = 'Global Administrator privileges required for automatic setup';
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('fetch')) {
      category = 'network';
      suggestion = 'Network connectivity issue. Please check your internet connection';
      isRetryable = true;
    } else if (errorMessage.includes('Application already exists')) {
      category = 'duplicate';
      suggestion = 'An application with this name already exists. Please use a different name or update the existing app';
    } else if (errorMessage.includes('Token expired') || errorMessage.includes('401')) {
      category = 'token';
      suggestion = 'Authentication token has expired. Please re-authenticate';
      isRetryable = true;
    } else if (errorMessage.includes('Service principal') || errorMessage.includes('servicePrincipal')) {
      category = 'service_principal';
      suggestion = 'Issue with service principal creation. This may resolve automatically on retry';
      isRetryable = true;
    }
    
    return {
      originalError: error,
      message: errorMessage,
      code: errorCode,
      category,
      context,
      isRetryable,
      suggestion,
      timestamp: new Date().toISOString()
    };
  }, []);

  const addError = useCallback((error, context = '') => {
    const categorizedError = categorizeError(error, context);
    
    setErrors(prev => [...prev, categorizedError]);
    
    if (categorizedError.isRetryable) {
      setRetryableErrors(prev => [...prev, categorizedError]);
    }
  }, [categorizeError]);

  const addWarning = useCallback((warning, context = '') => {
    const warningObj = {
      message: warning?.message || warning || 'Unknown warning',
      context,
      timestamp: new Date().toISOString()
    };
    
    setWarnings(prev => [...prev, warningObj]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setRetryableErrors([]);
  }, []);

  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  const clearAll = useCallback(() => {
    clearErrors();
    clearWarnings();
  }, [clearErrors, clearWarnings]);

  const getErrorsByCategory = useCallback((category) => {
    return errors.filter(error => error.category === category);
  }, [errors]);

  const hasRetryableErrors = retryableErrors.length > 0;
  const hasAuthenticationErrors = errors.some(e => e.category === 'authentication');
  const hasPermissionErrors = errors.some(e => e.category === 'permissions');
  const hasNetworkErrors = errors.some(e => e.category === 'network');

  const getRecoveryInstructions = useCallback(() => {
    const instructions = [];
    
    if (hasAuthenticationErrors) {
      instructions.push({
        type: 'authentication',
        title: 'Authentication Issues',
        steps: [
          'Verify you are signing in with a Global Administrator account',
          'Clear browser cache and cookies',
          'Try using an incognito/private browser window',
          'Ensure your account has the required permissions'
        ]
      });
    }
    
    if (hasPermissionErrors) {
      instructions.push({
        type: 'permissions',
        title: 'Permission Issues',
        steps: [
          'Ensure you have Global Administrator role',
          'Verify your account can create applications in Azure AD',
          'Check that your tenant allows application registrations',
          'Contact your Azure AD administrator if needed'
        ]
      });
    }
    
    if (hasNetworkErrors) {
      instructions.push({
        type: 'network',
        title: 'Network Issues',
        steps: [
          'Check your internet connection',
          'Verify you can access login.microsoftonline.com',
          'Check if corporate firewall is blocking requests',
          'Try again in a few minutes'
        ]
      });
    }
    
    return instructions;
  }, [hasAuthenticationErrors, hasPermissionErrors, hasNetworkErrors]);

  const getSummary = useCallback(() => {
    return {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      retryableErrors: retryableErrors.length,
      categories: {
        authentication: getErrorsByCategory('authentication').length,
        permissions: getErrorsByCategory('permissions').length,
        network: getErrorsByCategory('network').length,
        general: getErrorsByCategory('general').length
      },
      hasIssues: errors.length > 0 || warnings.length > 0,
      canRetry: hasRetryableErrors
    };
  }, [errors, warnings, retryableErrors, getErrorsByCategory, hasRetryableErrors]);

  return {
    errors,
    warnings,
    retryableErrors,
    addError,
    addWarning,
    clearErrors,
    clearWarnings,
    clearAll,
    getErrorsByCategory,
    getRecoveryInstructions,
    getSummary,
    hasRetryableErrors,
    hasAuthenticationErrors,
    hasPermissionErrors,
    hasNetworkErrors
  };
};

export default useSetupErrorHandler;