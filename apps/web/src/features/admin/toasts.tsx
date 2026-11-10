import type { ReactNode } from 'react';
import { Toast } from '@base-ui/react/toast';
import { cx } from '../../styles/modules.ts';

/** Base UI's toast manager, kept as the one way the editor reports a save or a failure. */
export function useToasts() {
  return Toast.useToastManager();
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className={cx('toast')} data-type={t.type}>
      <Toast.Title className={cx('toast-title')} />
      <Toast.Description className={cx('toast-text')} />
      <Toast.Close className={cx('toast-close')} aria-label="Dismiss">
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
        <Toast.Viewport className={cx('toast-viewport')}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
