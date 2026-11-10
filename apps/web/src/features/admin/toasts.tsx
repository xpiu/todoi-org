import type { ReactNode } from 'react';
import { Toast } from '@base-ui/react/toast';

/** Base UI's toast manager, kept as the one way the editor reports a save or a failure. */
export function useToasts() {
  return Toast.useToastManager();
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className="toast" data-type={t.type}>
      <Toast.Title className="toast-title" />
      <Toast.Description className="toast-text" />
      <Toast.Close className="toast-close" aria-label="Dismiss">
        ×
      </Toast.Close>
    </Toast.Root>
  ));
}

export function ToastHost({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={6000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
