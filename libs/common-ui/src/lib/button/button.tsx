import { ReactNode } from 'react';
import styles from './button.module.scss';

/* eslint-disable-next-line */
export interface IOwnButtonProps {
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
  onClick?: () => void;
}

export function OwnButton({ children, type, onClick }: IOwnButtonProps) {
  return (
    <button className={styles.buttonCommon} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

export default OwnButton;
