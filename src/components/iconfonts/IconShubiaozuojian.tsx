/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconShubiaozuojian: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M491.808 101.536v384c-158.4-19.104-241.088-37.056-248.096-53.824-4.8-11.52-31.744-134.848 52.032-246.016 35.776-47.488 101.12-75.552 196.064-84.16z"
        fill={getIconColor(color, 0, '#4B91F3')}
      />
      <path
        d="M550.4 76.8a243.2 243.2 0 0 1 243.2 243.2v332.8a294.4 294.4 0 1 1-588.8 0V320A243.2 243.2 0 0 1 448 76.8h102.4zM256 471.424V652.8a243.2 243.2 0 0 0 486.304 6.912l0.096-6.912v-179.2c-144.416 58.88-306.88 57.952-486.4-2.176zM550.4 128H448a192 192 0 0 0-191.904 185.792L256 320v97.28c183.328 64.832 345.056 64.768 486.4 0.576V320a192 192 0 0 0-185.792-191.904L550.4 128z"
        fill={getIconColor(color, 1, '#7A7A7A')}
      />
      <path
        d="M499.2 192c13.12 0 23.936 7.904 25.44 18.08l0.16 2.4v163.84c0 11.296-11.456 20.48-25.6 20.48-13.12 0-23.936-7.904-25.44-18.08l-0.16-2.4V212.48c0-11.296 11.456-20.48 25.6-20.48z"
        fill={getIconColor(color, 2, '#7A7A7A')}
      />
      <path
        d="M65.728 226.208l1.472 0.32 98.432 28.192c6.784 1.952 10.336 10.432 7.904 18.912-2.272 7.904-8.896 13.024-15.264 12.16l-1.472-0.32-98.432-28.192c-6.784-1.952-10.336-10.432-7.904-18.912 2.272-7.904 8.896-13.024 15.264-12.16z m52.256-114.72l1.12 0.992 72.416 72.416c4.992 4.992 3.968 14.112-2.24 20.352-5.824 5.824-14.08 7.104-19.264 3.264l-1.12-0.992-72.416-72.416c-4.992-4.992-3.968-14.112 2.24-20.352 5.824-5.824 14.08-7.104 19.264-3.264zM196.384 10.24l0.8 1.28 49.632 89.536c3.424 6.176-0.064 14.656-7.776 18.944-7.2 4-15.488 2.944-19.392-2.176l-0.832-1.28L169.184 27.008C165.76 20.8 169.248 12.32 176.96 8.032c7.2-4 15.488-2.944 19.392 2.176z"
        fill={getIconColor(color, 3, '#4B91F3')}
      />
    </svg>
  );
};

IconShubiaozuojian.defaultProps = {
  size: 18,
};

export default IconShubiaozuojian;
