import styles from './button.module.scss';

/* eslint-disable-next-line */
export interface ButtonProps {}

export function Button(props: ButtonProps) {
  return (
    <button className={styles["button-common"]}>
      Super puper button yay!
    </button>
  );
}

export default Button;
