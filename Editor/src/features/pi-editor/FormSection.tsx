import { useId, type ReactNode } from 'react';
import styles from './PiForm.module.less';

export function FormSection({ title, description, children, extra }: {
  title: string; description?: string; children: ReactNode; extra?: ReactNode;
}) {
  const id = useId();
  return <section className={styles.section} aria-labelledby={id}>
    <div className={styles.sectionHeading}>
      <div><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div>
      {extra}
    </div>
    <div className={styles.sectionBody}>{children}</div>
  </section>;
}
