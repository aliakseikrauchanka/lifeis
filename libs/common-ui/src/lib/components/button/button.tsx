import { CSSProperties, ReactNode, MouseEvent } from 'react';
import styles from './button.module.scss';

/* eslint-disable-next-line */
export interface IOwnButtonProps {
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties | undefined;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function OwnButton({ children, type, onClick, style }: IOwnButtonProps) {
  return (
    <button className={styles.buttonCommon} onClick={onClick} type={type} style={style}>
      {children}
    </button>
  );
}

export default OwnButton;
