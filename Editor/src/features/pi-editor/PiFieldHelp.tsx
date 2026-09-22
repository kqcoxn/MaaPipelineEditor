import { useId, type CSSProperties } from 'react';
import { Popover, theme } from 'antd';
import { getPiFieldHelp } from './fieldHelp';
import type { PiFieldHelp } from './fieldHelpCatalog';
import type { PiTab } from './types';
import styles from './PiForm.module.less';

function FieldHelp({ help }: { help: PiFieldHelp }) {
  const { token } = theme.useToken();
  return <div className={styles.fieldHelp} style={{ '--pi-muted': token.colorTextSecondary, '--pi-primary': token.colorPrimary, '--pi-border': token.colorBorderSecondary, '--pi-subtle': token.colorFillQuaternary, '--pi-text': token.colorText } as CSSProperties}>
    <div>{help.description}</div>
    {help.example && <div className={styles.helpExample}>
      <div>填写示例</div>
      <pre>{help.example}</pre>
    </div>}
  </div>;
}

export function PiFieldLabel({ label, help, descriptionId }: { label: string; help?: PiFieldHelp; descriptionId?: string }) {
  if (!help) return <strong className={styles.fieldLabel}>{label}</strong>;
  return <>
    <Popover placement="left" trigger={['hover', 'focus']} title={label} content={<FieldHelp help={help} />} fresh destroyOnHidden>
      <strong className={styles.fieldLabel} tabIndex={0} aria-describedby={descriptionId}>{label}</strong>
    </Popover>
    {descriptionId && <span id={descriptionId} className={styles.accessibleHelp}>{help.description}</span>}
  </>;
}

export function usePiFieldHelp(tab: PiTab, pointer: string, label: string) {
  const id = useId();
  const help = getPiFieldHelp(tab, pointer);
  return { help, descriptionId: help ? id : undefined, label: <PiFieldLabel label={label} help={help} descriptionId={id} /> };
}
