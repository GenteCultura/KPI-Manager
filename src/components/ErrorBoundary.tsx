import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            isFirestoreError = true;
            errorMessage = `Erro de permissão no Firestore (${parsedError.operationType}): ${parsedError.error}`;
          }
        }
      } catch (e) {
        // Not a JSON error message, use default
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="rounded-2xl bg-white p-8 shadow-xl max-w-md w-full border border-gray-100">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Ops! Algo deu errado</h1>
            <p className="mb-8 text-gray-600 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200"
            >
              <RefreshCcw className="h-5 w-5" />
              Recarregar Aplicativo
            </button>
            {isFirestoreError && (
              <p className="mt-6 text-xs text-gray-400">
                Se o problema persistir, entre em contato com o administrador para verificar suas permissões de acesso.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
