import { ReactNode } from 'react';
import styles from './button.module.scss';

/* eslint-disable-next-line */
export interface IOwnButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export function OwnButton({ children, onClick }: IOwnButtonProps) {
  return (
    <button className={styles.buttonCommon} onClick={onClick}>
      {children}
    </button>
  );
}

export default OwnButton;
