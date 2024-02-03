import { ReactNode } from 'react';
import styles from './button.module.scss';

/* eslint-disable-next-line */
export interface IButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: IButtonProps) {
  return (
    <button className={styles.buttonCommon} onClick={onClick}>
      {children}
    </button>
  );
}

export default Button;
