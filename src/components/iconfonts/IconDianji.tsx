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

const IconDianji: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M277.333 341.333a106.667 106.667 0 0 1 213.334 0V640h-85.334V341.333a21.333 21.333 0 1 0-42.666 0V640h-85.334V341.333z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M405.333 512a106.667 106.667 0 0 1 213.334 0v128h-85.334V512a21.333 21.333 0 1 0-42.666 0v128h-85.334V512z"
        fill={getIconColor(color, 1, '#333333')}
      />
      <path
        d="M533.333 554.667a106.667 106.667 0 0 1 213.334 0V640h-85.334v-85.333a21.333 21.333 0 1 0-42.666 0V640h-85.334v-85.333z"
        fill={getIconColor(color, 2, '#333333')}
      />
      <path
        d="M661.333 597.333a106.667 106.667 0 0 1 213.334 0V640h-85.334v-42.667a21.333 21.333 0 1 0-42.666 0V640h-85.334v-42.667zM362.667 640c0 117.824 95.509 213.333 213.333 213.333S789.333 757.824 789.333 640h85.334c0 164.95-133.718 298.667-298.667 298.667S277.333 804.949 277.333 640h85.334z"
        fill={getIconColor(color, 3, '#333333')}
      />
      <path
        d="M384 170.667A149.333 149.333 0 0 0 234.667 320h-85.334C149.333 190.4 254.4 85.333 384 85.333S618.667 190.4 618.667 320h-85.334A149.333 149.333 0 0 0 384 170.667z"
        fill={getIconColor(color, 4, '#0078FF')}
      />
    </svg>
  );
};

IconDianji.defaultProps = {
  size: 18,
};

export default IconDianji;
